import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";

const JournalRouter = express.Router();

const verifyTenant = async (req, res, next) => {
  try {
    const tenant_id = req.body?.tenant_id || req.query?.tenant_id;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No session token provided' });
    }

    const sessionToken = authHeader.split(' ')[1];
    
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("session_token", sessionToken)
      .single();

    if (userError || !user) {
      return res.status(401).json({ success: false, error: 'Invalid session token' });
    }

    if (tenant_id && user.tenant_id !== tenant_id) {
      return res.status(403).json({ success: false, error: 'Access denied to this tenant' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Tenant verification error:", err);
    res.status(500).json({ success: false, error: 'Tenant verification failed' });
  }
};

// GET /api/journals/search-customers - Search customers by phone, name, or ID
JournalRouter.get("/search-customers", verifyTenant, async (req, res) => {
  try {
    const { tenant_id, search } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    if (!search || search.length < 2) {
      return res.json({
        success: true,
        customers: []
      });
    }

    // Check if search is purely numeric
    const isNumeric = /^\d+$/.test(search);
    
    if (isNumeric) {
      // For numeric search, use the RPC function or fallback
      try {
        const { data: customers, error } = await supabaseAdmin
          .rpc('search_customers_by_number', {
            p_tenant_id: tenant_id,
            p_search: search
          });

        if (error) {
          // Fallback: only search mobile (text field)
          console.log("RPC function not found, using fallback");
          const { data: fallbackCustomers, error: fallbackError } = await supabaseAdmin
            .from("customers")
            .select("id, Firstname, Middlename, Surname, mobile, id_number, business_name")
            .eq("tenant_id", tenant_id)
            .ilike("mobile", `%${search}%`)
            .limit(10);

          if (fallbackError) throw fallbackError;

          const formattedCustomers = formatCustomers(fallbackCustomers || []);
          return res.json({
            success: true,
            customers: formattedCustomers
          });
        }

        const formattedCustomers = formatCustomers(customers || []);
        return res.json({
          success: true,
          customers: formattedCustomers
        });
      } catch (rpcError) {
        console.error('RPC error:', rpcError);
        // Fallback to mobile-only search
        const { data: fallbackCustomers, error: fallbackError } = await supabaseAdmin
          .from("customers")
          .select("id, Firstname, Middlename, Surname, mobile, id_number, business_name")
          .eq("tenant_id", tenant_id)
          .ilike("mobile", `%${search}%`)
          .limit(10);

        if (fallbackError) throw fallbackError;

        const formattedCustomers = formatCustomers(fallbackCustomers || []);
        return res.json({
          success: true,
          customers: formattedCustomers
        });
      }
    } else {
      // For text search, search in name fields only (not id_number)
      const { data: customers, error } = await supabaseAdmin
        .from("customers")
        .select("id, Firstname, Middlename, Surname, mobile, id_number, business_name")
        .eq("tenant_id", tenant_id)
        .or(`Firstname.ilike.%${search}%,Surname.ilike.%${search}%,Middlename.ilike.%${search}%,business_name.ilike.%${search}%,mobile.ilike.%${search}%`)
        .limit(10);

      if (error) throw error;

      const formattedCustomers = formatCustomers(customers || []);
      return res.json({
        success: true,
        customers: formattedCustomers
      });
    }
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search customers',
      details: error.message 
    });
  }
});

// Helper function to format customers
function formatCustomers(customers) {
  return customers.map(customer => ({
    id: customer.id,
    display_name: customer.business_name || 
                 `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim() ||
                 `Customer ${customer.id}`,
    phone: customer.mobile,
    id_number: customer.id_number,
    business_name: customer.business_name,
    first_name: customer.Firstname,
    surname: customer.Surname
  }));
}

// POST /api/journals - Create new pending journal
JournalRouter.post("/", verifyTenant, async (req, res) => {
  try {
    const {
      journal_type,
      account_type,
      amount,
      description,
      tenant_id,
      customer_id,
      customer_name
    } = req.body;

    if (!journal_type || !account_type || !amount || !tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: journal_type, account_type, amount, tenant_id'
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    if (!customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Customer selection is required'
      });
    }

    // Verify customer exists and belongs to this tenant
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", customer_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (customerError || !customer) {
      return res.status(400).json({
        success: false,
        error: 'Selected customer not found or does not belong to this tenant'
      });
    }

    const journalData = {
      customer_id: customer_id,
      journal_type,
      account_type,
      amount: parseFloat(amount),
      description,
      tenant_id,
      entry_date: new Date().toISOString().split('T')[0],
      created_by: req.user.id,
      status: 'pending'
    };

    const { data, error } = await supabaseAdmin
      .from("journals")
      .insert([journalData])
      .select(`
        *,
        customers:customer_id(Firstname, Middlename, Surname, mobile, business_name)
      `)
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Journal created successfully in pending status',
      journal: data
    });
  } catch (error) {
    console.error('Error creating journal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create journal',
      details: error.message 
    });
  }
});

// POST /api/journals/:id/post - Post journal to accounting AND update customer wallet
JournalRouter.post("/:id/post", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;

    const { data: journal, error: journalError } = await supabaseAdmin
      .from("journals")
      .select(`
        *,
        customers:customer_id(*)
      `)
      .eq("id", id)
      .eq("tenant_id", tenant_id)
      .single();

    if (journalError) throw journalError;

    if (journal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Journal cannot be posted. Current status: ${journal.status}`
      });
    }

    if (journal.journal_entry_id) {
      return res.status(400).json({
        success: false,
        error: 'Journal already has a journal entry'
      });
    }

    if (!journal.customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Journal must have a customer to be posted'
      });
    }

    // Create journal entry
    const journalEntry = {
      tenant_id,
      reference_type: 'journal',
      reference_id: id.toString(),
      description: journal.description || `Journal entry for ${journal.journal_type}`,
      entry_date: journal.entry_date || new Date().toISOString().split('T')[0],
      created_by: journal.created_by || req.user.id
    };

    const { data: entry, error: entryError } = await supabaseAdmin
      .from("journal_entries")
      .insert([journalEntry])
      .select()
      .single();

    if (entryError) throw entryError;

    // Fetch appropriate accounts for the tenant
    const { data: accounts } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id, account_type, account_name, account_code")
      .eq("tenant_id", tenant_id);

    if (!accounts || accounts.length === 0) {
      throw new Error('No chart of accounts found for this tenant');
    }

    const customerAccountId = journal.customers?.receivable_account_id;
    let debitAccountId, creditAccountId;

    switch (journal.journal_type.toLowerCase()) {
      case 'debit':
        debitAccountId = customerAccountId || 
                        accounts.find(a => a.account_type === 'asset' && 
                          (a.account_name.toLowerCase().includes('receivable') || a.account_code.startsWith('1')))?.id;
        creditAccountId = accounts.find(a => a.account_type === 'revenue')?.id;
        break;
      
      case 'credit':
        creditAccountId = customerAccountId || 
                         accounts.find(a => a.account_type === 'asset' && 
                           (a.account_name.toLowerCase().includes('receivable') || a.account_code.startsWith('1')))?.id;
        debitAccountId = accounts.find(a => a.account_type === 'revenue')?.id;
        break;
      
      default:
        debitAccountId = accounts.find(a => a.account_type === 'asset' && a.account_name.toLowerCase().includes('cash'))?.id;
        creditAccountId = accounts.find(a => a.account_type === 'equity')?.id;
    }

    if (!debitAccountId || !creditAccountId) {
      throw new Error('Could not determine accounts for journal type. Please set up chart of accounts.');
    }

    // Create journal entry lines
    const journalEntryLines = [
      {
        journal_entry_id: entry.id,
        account_id: debitAccountId,
        debit: journal.amount,
        credit: 0
      },
      {
        journal_entry_id: entry.id,
        account_id: creditAccountId,
        debit: 0,
        credit: journal.amount
      }
    ];

    const { error: linesError } = await supabaseAdmin
      .from("journal_entry_lines")
      .insert(journalEntryLines);

    if (linesError) throw linesError;

    // UPDATE CUSTOMER WALLET
    const walletEntry = {
      customer_id: journal.customer_id,
      tenant_id: tenant_id,
      type: journal.journal_type.toLowerCase(),
      amount: parseFloat(journal.amount),
      debit: journal.journal_type.toLowerCase() === 'debit' ? parseFloat(journal.amount) : 0,
      credit: journal.journal_type.toLowerCase() === 'credit' ? parseFloat(journal.amount) : 0,
      description: journal.description,
      narration: `Journal Entry: ${journal.description}`,
      transaction_type: 'journal_entry',
      billref: `JE-${entry.id}`
    };

    const { error: walletError } = await supabaseAdmin
      .from("customer_wallets")
      .insert([walletEntry]);

    if (walletError) {
      console.error('Error updating customer wallet:', walletError);
      throw new Error('Failed to update customer wallet: ' + walletError.message);
    }

    // Update journal status
    const { error: updateError } = await supabaseAdmin
      .from("journals")
      .update({
        journal_entry_id: entry.id,
        status: 'posted',
        approved_by: req.user.id,
        approved_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("tenant_id", tenant_id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Journal posted successfully and customer wallet updated',
      journal_entry_id: entry.id,
      journal_lines: journalEntryLines
    });
  } catch (error) {
    console.error('Error posting journal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to post journal',
      details: error.message 
    });
  }
});

// POST /api/journals/:id/approve
JournalRouter.post("/:id/approve", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, approval_note } = req.body;

    const { error: updateError } = await supabaseAdmin
      .from("journals")
      .update({
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
        approval_note
      })
      .eq("id", id)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending");

    if (updateError) {
      const { data: journal } = await supabaseAdmin
        .from("journals")
        .select("status")
        .eq("id", id)
        .single();

      if (journal?.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Journal cannot be approved. Current status: ${journal?.status}`
        });
      }
      throw updateError;
    }

    res.json({
      success: true,
      message: 'Journal approved successfully',
      journal_id: id
    });
  } catch (error) {
    console.error('Error approving journal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to approve journal',
      details: error.message 
    });
  }
});

// POST /api/journals/:id/reject
JournalRouter.post("/:id/reject", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({ 
        success: false,
        error: 'rejection_reason is required' 
      });
    }

    const { error: updateError } = await supabaseAdmin
      .from("journals")
      .update({
        status: 'rejected',
        rejected_by: req.user.id,
        rejected_at: new Date().toISOString(),
        rejection_reason
      })
      .eq("id", id)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending");

    if (updateError) {
      const { data: journal } = await supabaseAdmin
        .from("journals")
        .select("status")
        .eq("id", id)
        .single();

      if (journal?.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Journal cannot be rejected. Current status: ${journal?.status}`
        });
      }
      throw updateError;
    }

    res.json({
      success: true,
      message: 'Journal rejected successfully',
      journal_id: id
    });
  } catch (error) {
    console.error('Error rejecting journal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to reject journal',
      details: error.message 
    });
  }
});

// GET /api/journals - Get all journals for tenant
JournalRouter.get("/", verifyTenant, async (req, res) => {
  try {
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    const { data: journals, error } = await supabaseAdmin
      .from("journals")
      .select(`
        *,
        customers:customer_id(
          Firstname,
          Middlename,
          Surname,
          mobile,
          business_name
        ),
        creator:created_by(full_name),
        approver:approved_by(full_name),
        rejector:rejected_by(full_name)
      `)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Format customer names
    const formattedJournals = journals.map(journal => {
      const customer = journal.customers;
      let customerName = '';
      
      if (customer?.business_name) {
        customerName = customer.business_name;
      } else if (customer?.Firstname || customer?.Surname) {
        customerName = `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim();
      } else if (journal.customer_id) {
        customerName = `Customer ${journal.customer_id}`;
      }

      return {
        ...journal,
        customer_name: customerName,
        customer_phone: customer?.mobile,
        created_by_name: journal.creator?.full_name,
        approved_by_name: journal.approver?.full_name,
        rejected_by_name: journal.rejector?.full_name
      };
    });

    res.json({
      success: true,
      journals: formattedJournals
    });
  } catch (error) {
    console.error('Error fetching journals:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch journals',
      details: error.message 
    });
  }
});

// GET /api/journals/:id - Get single journal
JournalRouter.get("/:id", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id is required'
      });
    }

    const { data: journal, error } = await supabaseAdmin
      .from("journals")
      .select(`
        *,
        customers:customer_id(
          Firstname,
          Middlename,
          Surname,
          mobile,
          id_number,
          business_name
        ),
        creator:created_by(full_name),
        approver:approved_by(full_name),
        rejector:rejected_by(full_name),
        journal_entries:journal_entry_id(*,
          journal_entry_lines(*,
            account:account_id(account_code, account_name)
          )
        )
      `)
      .eq("id", id)
      .eq("tenant_id", tenant_id)
      .single();

    if (error) throw error;

    if (!journal) {
      return res.status(404).json({
        success: false,
        error: 'Journal not found'
      });
    }

    // Format customer info
    const customer = journal.customers;
    let customerName = '';
    
    if (customer?.business_name) {
      customerName = customer.business_name;
    } else if (customer?.Firstname || customer?.Surname) {
      customerName = `${customer.Firstname || ''} ${customer.Middlename || ''} ${customer.Surname || ''}`.trim();
    }

    const formattedJournal = {
      ...journal,
      customer_name: customerName,
      customer_phone: customer?.mobile,
      customer_id_number: customer?.id_number,
      created_by_name: journal.creator?.full_name,
      approved_by_name: journal.approver?.full_name,
      rejected_by_name: journal.rejector?.full_name
    };

    res.json({
      success: true,
      journal: formattedJournal
    });
  } catch (error) {
    console.error('Error fetching journal:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch journal',
      details: error.message 
    });
  }
});

export default JournalRouter;
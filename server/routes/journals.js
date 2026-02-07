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

    let query = supabaseAdmin
      .from("customers")
      .select("id, Firstname, Middlename, Surname, mobile, id_number, business_name")
      .eq("tenant_id", tenant_id)
      .limit(10);

    if (isNumeric) {
      // Search mobile (partial) OR id_number (exact) - using raw OR syntax for mixed types if needed, 
      // but mobile is text and id_number is bigint. 
      // Safest is to use the .or() filter with explicit casting or just string matching if Supabase handles it.
      // We will try the flexible string syntax: mobile.ilike.%search%,id_number.eq.search
      query = query.or(`mobile.ilike.%${search}%,id_number.eq.${search}`);
    } else {
      // Text search: Names or Business Name
      query = query.or(`Firstname.ilike.%${search}%,Surname.ilike.%${search}%,Middlename.ilike.%${search}%,business_name.ilike.%${search}%`);
    }

    const { data: customers, error } = await query;

    if (error) throw error;

    const formattedCustomers = formatCustomers(customers || []);
    return res.json({
      success: true,
      customers: formattedCustomers
    });

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
  return customers.map(customer => {
    // Construct full name
    const fname = customer.Firstname || '';
    const mname = customer.Middlename || '';
    const sname = customer.Surname || '';
    const fullName = `${fname} ${mname} ${sname}`.trim();

    // Display Name priority: Full Name > Business Name > Customer ID
    const displayName = fullName || customer.business_name || `Customer ${customer.id}`;

    return {
      id: customer.id,
      display_name: displayName,
      phone: customer.mobile,
      id_number: customer.id_number,
      business_name: customer.business_name,
      first_name: customer.Firstname,
      surname: customer.Surname
    };
  });
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
      recipient_id
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

    if (journal_type === 'transfer') {
      if (!recipient_id) {
        return res.status(400).json({
          success: false,
          error: 'Recipient is required for transfers'
        });
      }
      if (customer_id === recipient_id) {
        return res.status(400).json({
          success: false,
          error: 'Sender and recipient cannot be the same'
        });
      }
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

    if (recipient_id) {
      const { data: recipient, error: recipientError } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("id", recipient_id)
        .eq("tenant_id", tenant_id)
        .single();

      if (recipientError || !recipient) {
        return res.status(400).json({
          success: false,
          error: 'Recipient customer not found or does not belong to this tenant'
        });
      }
    }

    const journalData = {
      customer_id: customer_id,
      recipient_id: recipient_id || null,
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
        customers:customer_id(Firstname, Middlename, Surname, mobile, business_name),
        recipient:recipient_id(Firstname, Middlename, Surname, mobile, business_name)
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

// POST /api/journals/:id/approve
JournalRouter.post("/:id/approve", verifyTenant, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, approval_note } = req.body;

    // Check Permissions
    const allowedRoles = ['admin', 'superadmin', 'credit_analyst', 'credit_analyst_officer'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Credit Analyst role required.'
      });
    }

    // Fetch Journal
    const { data: journal, error: journalError } = await supabaseAdmin
      .from("journals")
      .select(`
        *,
        customers:customer_id(*),
        recipient:recipient_id(*)
      `)
      .eq("id", id)
      .eq("tenant_id", tenant_id)
      .single();

    if (journalError) throw journalError;

    if (journal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Journal cannot be approved. Current status: ${journal.status}`
      });
    }

    // Create Journal Entry (GL)
    const journalEntry = {
      tenant_id,
      reference_type: 'journal',
      reference_id: id.toString(),
      description: journal.description || `Journal entry for ${journal.journal_type}`,
      entry_date: journal.entry_date || new Date().toISOString().split('T')[0],
      created_by: journal.created_by
    };

    const { data: entry, error: entryError } = await supabaseAdmin
      .from("journal_entries")
      .insert([journalEntry])
      .select()
      .single();

    if (entryError) throw entryError;

    // Fetch Accounts
    const { data: accounts } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id, account_type, account_name, code")
      .eq("tenant_id", tenant_id);

    if (!accounts || accounts.length === 0) {
      throw new Error('No chart of accounts found for this tenant');
    }

    let debitAccountId, creditAccountId;
    const walletEntries = [];

    // --- LOGIC ---
    if (journal.journal_type === 'transfer') {
      // TRANSFER
      const walletControlAccount = accounts.find(a => a.code === '2000') || accounts.find(a => a.account_name === 'Customer Wallet Balances');
      if (!walletControlAccount) throw new Error("Customer Wallet Balances account (2000) not found");

      debitAccountId = walletControlAccount.id;
      creditAccountId = walletControlAccount.id;

      // Debit Sender
      walletEntries.push({
        customer_id: journal.customer_id,
        tenant_id,
        type: 'debit',
        amount: parseFloat(journal.amount),
        debit: parseFloat(journal.amount),
        credit: 0,
        description: `Transfer to ${journal.recipient?.display_name || 'Customer'}`,
        narration: journal.description,
        transaction_type: 'transfer_out',
        billref: `JE-${entry.id}`
      });

      // Credit Recipient
      walletEntries.push({
        customer_id: journal.recipient_id,
        tenant_id,
        type: 'credit',
        amount: parseFloat(journal.amount),
        debit: 0,
        credit: parseFloat(journal.amount),
        description: `Transfer from ${journal.customers?.display_name || 'Customer'}`,
        narration: journal.description,
        transaction_type: 'transfer_in',
        billref: `JE-${entry.id}`
      });

    } else if (journal.journal_type === 'credit') {
      // CREDIT / DEPOSIT
      debitAccountId = accounts.find(a => a.code === '1020')?.id ||
        accounts.find(a => a.account_type === 'Asset' && a.account_name.includes('Cash'))?.id;

      const walletControl = accounts.find(a => a.code === '2000') || accounts.find(a => a.account_name === 'Customer Wallet Balances');

      if (!debitAccountId) throw new Error("Cash/Bank Asset account not found");
      if (!walletControl) throw new Error("Customer Wallet Balances account not found");

      creditAccountId = walletControl.id;

      walletEntries.push({
        customer_id: journal.customer_id,
        tenant_id,
        type: 'credit',
        amount: parseFloat(journal.amount),
        debit: 0,
        credit: parseFloat(journal.amount),
        description: journal.description,
        narration: `Deposit: ${journal.description}`,
        transaction_type: 'deposit',
        billref: `JE-${entry.id}`
      });

    } else if (journal.journal_type === 'debit') {
      // DEBIT / WITHDRAWAL
      const walletControl = accounts.find(a => a.code === '2000') || accounts.find(a => a.account_name === 'Customer Wallet Balances');
      if (!walletControl) throw new Error("Customer Wallet Balances account not found");

      debitAccountId = walletControl.id;

      // Credit Income or Bank
      if (journal.account_type === 'Income' || journal.account_type === 'Revenue') {
        creditAccountId = accounts.find(a => a.account_type === 'Income')?.id;
      } else {
        creditAccountId = accounts.find(a => a.code === '1020')?.id; // MPesa/Bank
      }

      if (!creditAccountId) throw new Error("Offset account not found");

      walletEntries.push({
        customer_id: journal.customer_id,
        tenant_id,
        type: 'debit',
        amount: parseFloat(journal.amount),
        debit: parseFloat(journal.amount),
        credit: 0,
        description: journal.description,
        narration: `Withdrawal/Charge: ${journal.description}`,
        transaction_type: 'withdrawal',
        billref: `JE-${entry.id}`
      });
    }

    // Insert GL Lines
    const journalEntryLines = [
      {
        journal_entry_id: entry.id,
        account_id: debitAccountId,
        debit: parseFloat(journal.amount),
        credit: 0
      },
      {
        journal_entry_id: entry.id,
        account_id: creditAccountId,
        debit: 0,
        credit: parseFloat(journal.amount)
      }
    ];

    const { error: linesError } = await supabaseAdmin
      .from("journal_entry_lines")
      .insert(journalEntryLines);

    if (linesError) throw linesError;

    // Insert Wallet Entries
    if (walletEntries.length > 0) {
      const { error: walletError } = await supabaseAdmin
        .from("customer_wallets")
        .insert(walletEntries);

      if (walletError) throw new Error('Failed to update customer wallets: ' + walletError.message);
    }

    // Update Journal Status
    const { error: updateError } = await supabaseAdmin
      .from("journals")
      .update({
        journal_entry_id: entry.id,
        status: 'approved',
        approved_by: req.user.id,
        approved_at: new Date().toISOString(),
        approval_note
      })
      .eq("id", id)
      .eq("tenant_id", tenant_id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Journal approved and transactions posted successfully',
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

    const allowedRoles = ['admin', 'superadmin', 'credit_analyst', 'credit_analyst_officer'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

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

    if (updateError) throw updateError;

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
        recipient:recipient_id(
          Firstname,
          Middlename,
          Surname,
          mobile,
          business_name
        )
      `)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Manual join for user details
    const userIds = new Set();
    journals.forEach(j => {
      if (j.created_by) userIds.add(j.created_by);
      if (j.approved_by) userIds.add(j.approved_by);
      if (j.rejected_by) userIds.add(j.rejected_by);
    });

    const { data: usersMap } = await supabaseAdmin
      .from("users")
      .select("id, full_name")
      .in("id", Array.from(userIds));

    const userLookup = {};
    if (usersMap) {
      usersMap.forEach(u => { userLookup[u.id] = u.full_name; });
    }

    const formattedJournals = journals.map(journal => {
      // Helper to format name
      const formatName = (c) => {
        if (!c) return '';
        // Prioritize Firstname and Surname as requested
        const nameParts = [c.Firstname, c.Surname].filter(Boolean);
        if (nameParts.length > 0) return nameParts.join(' ');

        return c.business_name || '';
      };

      let displayCustomerName = '';
      const customerName = journal.customers ? formatName(journal.customers) : '';
      const recipientName = journal.recipient ? formatName(journal.recipient) : '';

      // Determine Display logic
      if (journal.journal_type === 'transfer' && journal.recipient) {
        displayCustomerName = `${customerName} ➔ ${recipientName}`;
      } else if (customerName) {
        displayCustomerName = customerName;
      } else {
        displayCustomerName = `Customer ${journal.customer_id}`;
      }

      return {
        ...journal,
        customer_name: displayCustomerName,
        customer_phone: journal.customers?.mobile,
        created_by_name: userLookup[journal.created_by] || 'Unknown',
        approved_by_name: userLookup[journal.approved_by] || '-',
        rejected_by_name: userLookup[journal.rejected_by] || '-'
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
        recipient:recipient_id(
           Firstname,
           Middlename,
           Surname,
           mobile,
           id_number,
           business_name
        ),
        journal_entries:journal_entry_id(*,
          journal_entry_lines(*,
            account:account_id(code, account_name)
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

    // Manual fetch for user details
    const userIds = new Set();
    if (journal.created_by) userIds.add(journal.created_by);
    if (journal.approved_by) userIds.add(journal.approved_by);
    if (journal.rejected_by) userIds.add(journal.rejected_by);

    const { data: usersMap } = await supabaseAdmin
      .from("users")
      .select("id, full_name")
      .in("id", Array.from(userIds));

    const userLookup = {};
    if (usersMap) {
      usersMap.forEach(u => { userLookup[u.id] = u.full_name; });
    }

    const formatName = (c) => {
      if (!c) return '';
      // Prioritize Firstname and Surname as requested
      const nameParts = [c.Firstname, c.Surname].filter(Boolean);
      if (nameParts.length > 0) return nameParts.join(' ');

      return c.business_name || '';
    };

    const formattedJournal = {
      ...journal,
      customer_name: formatName(journal.customers),
      customer_phone: journal.customers?.mobile,
      customer_id_number: journal.customers?.id_number,
      recipient_name: formatName(journal.recipient),
      recipient_phone: journal.recipient?.mobile,
      created_by_name: userLookup[journal.created_by] || 'Unknown',
      approved_by_name: userLookup[journal.approved_by] || '-',
      rejected_by_name: userLookup[journal.rejected_by] || '-'
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
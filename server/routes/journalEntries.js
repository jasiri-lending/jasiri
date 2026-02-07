import express from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { v4 as uuidv4 } from "uuid";

const JournalEntryRouter = express.Router();

const verifyTenant = async (req, res, next) => {
    try {
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

        req.user = user;
        next();
    } catch (err) {
        console.error("Tenant verification error:", err);
        res.status(500).json({ success: false, error: 'Tenant verification failed' });
    }
};

// POST /api/journal-entries - Create manual multi-line journal entry
JournalEntryRouter.post("/", verifyTenant, async (req, res) => {
    try {
        const { tenant_id, entry_date, reference, description, lines } = req.body;

        if (req.user.tenant_id !== tenant_id) {
            return res.status(403).json({ success: false, error: 'Unauthorized tenant access' });
        }

        // Validate Balance
        const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return res.status(400).json({ success: false, error: `Entries do not balance. Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}` });
        }

        // Create Journal Entry
        const { data: entry, error: entryError } = await supabaseAdmin
            .from("journal_entries")
            .insert([{
                tenant_id,
                reference_id: reference || `MANUAL-${Date.now()}`,
                reference_type: 'manual_journal',
                entry_date: entry_date || new Date().toISOString(),
                description: description || 'Manual Journal Entry',
                created_by: req.user.id
            }])
            .select()
            .single();

        if (entryError) throw entryError;

        // Prepare Lines
        const entryLines = lines.map(line => ({
            journal_entry_id: entry.id,
            account_id: line.account_id,
            description: line.description,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0
        }));

        const { error: linesError } = await supabaseAdmin
            .from("journal_entry_lines")
            .insert(entryLines);

        if (linesError) throw linesError;

        res.json({ success: true, message: "Journal entry created successfully", entry });

    } catch (error) {
        console.error("Error creating journal entry:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/journal-entries/upload - Bulk Upload from Excel
JournalEntryRouter.post("/upload", verifyTenant, async (req, res) => {
    try {
        const { tenant_id, entries } = req.body;

        if (req.user.tenant_id !== tenant_id) {
            return res.status(403).json({ success: false, error: 'Unauthorized tenant access' });
        }

        // 1. Fetch all accounts to validate codes
        const { data: accounts } = await supabaseAdmin
            .from("chart_of_accounts")
            .select("id, code")
            .eq("tenant_id", tenant_id);

        const accountMap = {}; // code -> id
        accounts.forEach(a => accountMap[a.code] = a.id);

        // 2. Group entries by Reference # (Assuming one Excel row = one line, grouped by Reference)
        // If Reference is missing, we might assume single line entries (bad) or treat whole file as one entry?
        // Let's assume unique Reference ID per transaction group.

        const groupedData = {};

        for (const row of entries) {
            // Normalize Keys (Handle Case Sensitivity from Excel)
            const keys = Object.keys(row);
            const getVal = (k) => row[keys.find(key => key.toLowerCase() === k.toLowerCase())];

            const ref = getVal('reference') || `BULK-${Date.now()}`;
            const date = getVal('date');
            const desc = getVal('description');
            const code = getVal('accountcode') || getVal('code'); // flexible
            const debit = parseFloat(getVal('debit') || 0);
            const credit = parseFloat(getVal('credit') || 0);

            if (!code || !accountMap[code.toString()]) {
                // Skip or Error? Let's skip invalid lines but warn? Or error entire batch.
                // For simplicity, erroring is safer.
                throw new Error(`Account code ${code} not found`);
            }

            if (!groupedData[ref]) {
                groupedData[ref] = {
                    tenant_id,
                    reference_id: ref,
                    reference_type: 'bulk_upload',
                    entry_date: date ? new Date(date).toISOString() : new Date().toISOString(),
                    description: desc || 'Bulk Upload',
                    created_by: req.user.id,
                    lines: []
                };
            }

            groupedData[ref].lines.push({
                account_id: accountMap[code.toString()],
                debit,
                credit,
                description: desc
            });
        }

        // 3. Process each group
        let successCount = 0;

        for (const ref in groupedData) {
            const group = groupedData[ref];
            // Validate Balance
            const totalDebit = group.lines.reduce((s, l) => s + l.debit, 0);
            const totalCredit = group.lines.reduce((s, l) => s + l.credit, 0);

            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                console.warn(`Skipping reference ${ref}: Out of balance (${totalDebit} vs ${totalCredit})`);
                continue;
            }

            // Create Entry
            const { data: entry, error: entryError } = await supabaseAdmin
                .from("journal_entries")
                .insert([{
                    tenant_id: group.tenant_id,
                    reference_id: group.reference_id,
                    reference_type: group.reference_type,
                    entry_date: group.entry_date,
                    description: group.description,
                    created_by: group.created_by
                }])
                .select()
                .single();

            if (entryError) throw entryError;

            // Create Lines
            const dbLines = group.lines.map(l => ({
                journal_entry_id: entry.id,
                account_id: l.account_id,
                debit: l.debit,
                credit: l.credit,
                description: l.description
            }));

            await supabaseAdmin.from("journal_entry_lines").insert(dbLines);
            successCount++;
        }

        res.json({ success: true, count: successCount, message: `Processed ${successCount} journal entries.` });

    } catch (error) {
        console.error("Error uploading entries:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default JournalEntryRouter;

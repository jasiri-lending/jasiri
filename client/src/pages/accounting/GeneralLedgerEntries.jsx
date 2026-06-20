import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrashIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/userAuth';
import { apiFetch } from '../../utils/api';
import { useToast } from '../../components/Toast';
import { SkeletonForm } from '../../components/Skeleton';

function GeneralLedgerEntries() {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    // State for manual entry
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState('');
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState([
        { account_id: '', account_code: '', description: '', debit: '', credit: '' },
        { account_id: '', account_code: '', description: '', debit: '', credit: '' }
    ]);

    // Account search state
    const [accounts, setAccounts] = useState([]);
    const [showAccountDropdown, setShowAccountDropdown] = useState(null); // Index of line being edited
    const [accountSearch, setAccountSearch] = useState('');

    // File upload state
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [uploadMode, setUploadMode] = useState(false);

    useEffect(() => {
        if (profile?.tenant_id) {
            fetchAccounts();
        }
    }, [profile?.tenant_id]);

    const fetchAccounts = async () => {
        try {
            const response = await apiFetch(`/api/chart-of-accounts?tenant_id=${profile?.tenant_id}`);
            const data = await response.json();
            if (data.success) {
                setAccounts(data.accounts || []);
            }
        } catch (error) {
            console.error("Error fetching accounts:", error);
        }
    };

    const addLine = () => {
        setLines([...lines, { account_id: '', account_code: '', description: '', debit: '', credit: '' }]);
    };

    const removeLine = (index) => {
        if (lines.length <= 2) {
            toast.error("Entry must have at least 2 lines");
            return;
        }
        const newLines = lines.filter((_, i) => i !== index);
        setLines(newLines);
    };

    const updateLine = (index, field, value) => {
        const newLines = [...lines];
        newLines[index][field] = value;

        // Auto-clear opposite field if one is entered
        if (field === 'debit' && value) newLines[index].credit = '';
        if (field === 'credit' && value) newLines[index].debit = '';

        setLines(newLines);
    };

    const handleAccountSelect = (index, account) => {
        const newLines = [...lines];
        newLines[index].account_id = account.id;
        newLines[index].account_code = account.code;
        newLines[index].account_name = account.account_name; // Store name for display
        setShowAccountDropdown(null);
        setAccountSearch('');
        setLines(newLines);
    };

    const calculateTotals = () => {
        const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
        return { totalDebit, totalCredit, difference: totalDebit - totalCredit };
    };

    const { totalDebit, totalCredit, difference } = calculateTotals();

    // Excel Upload Logic
    const handleFileUpload = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            setParsedData(data);
            toast.success(`Parsed ${data.length} rows`);
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleManualSubmit = async () => {
        if (Math.abs(difference) > 0.01) {
            toast.error(`Entries must balance. Difference: ${difference.toFixed(2)}`);
            return;
        }

        if (lines.some(l => !l.account_id)) {
            toast.error("All lines must have an account selected");
            return;
        }

        setLoading(true);
        try {
            const response = await apiFetch(`/api/journal-entries`, {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: profile?.tenant_id,
                    entry_date: entryDate,
                    reference,
                    description,
                    lines: lines.map(l => ({
                        account_id: l.account_id,
                        description: l.description || description, // Fallback to header description
                        debit: parseFloat(l.debit) || 0,
                        credit: parseFloat(l.credit) || 0
                    }))
                })
            });

            const data = await response.json();
            if (data.success) {
                toast.success("Journal Entry posted successfully");
                navigate("/accounting/journals");
            } else {
                toast.error(data.error || "Failed to post entry");
            }
        } catch (error) {
            console.error("Error posting journal:", error);
            toast.error("Server error");
        } finally {
            setLoading(false);
        }
    };

    const handleExcelSubmit = async () => {
        if (!parsedData || parsedData.length === 0) {
            toast.error("No data to upload");
            return;
        }

        setLoading(true);
        try {
            const response = await apiFetch(`/api/journal-entries/upload`, {
                method: 'POST',
                body: JSON.stringify({
                    tenant_id: profile?.tenant_id,
                    entries: parsedData
                })
            });

            const data = await response.json();
            if (data.success) {
                toast.success(`Successfully uploaded ${data.count} entries`);
                navigate("/accounting/journals");
            } else {
                toast.error(data.error || "Failed to upload entries");
            }
        } catch (error) {
            console.error("Error uploading excel:", error);
            toast.error("Server error");
        } finally {
            setLoading(false);
        }
    };

    const downloadTemplate = () => {
        const templateData = [
            {
                Date: new Date().toISOString().split('T')[0],
                Reference: 'JE-001',
                Description: 'Sample Entry - Office Supplies',
                AccountCode: '1001',
                Debit: 500.00,
                Credit: 0.00
            },
            {
                Date: new Date().toISOString().split('T')[0],
                Reference: 'JE-001',
                Description: 'Sample Entry - Cash',
                AccountCode: '1002',
                Debit: 0.00,
                Credit: 500.00
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "GL Template");
        XLSX.writeFile(wb, "GL_Entry_Template.xlsx");
        toast.success("Template downloaded!");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
                <div className="max-w-6xl mx-auto"><SkeletonForm fields={6} /></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate("/accounting/journals")}
                    className="mb-4 flex items-center gap-2 text-xs font-outfit text-muted hover:text-heading"
                >
                    <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Journals
                </button>

                <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
                    <div className="px-4 py-2 border-b border-border flex justify-between items-center bg-surface">
                        <div>
                            <h1 className="text-sm font-outfit text-heading">General Journal Entry</h1>
                            <p className="text-[8px] font-outfit text-muted">Log expenses, incomes, or adjustments manually</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={downloadTemplate}
                                className="px-3 py-1.5 rounded-md text-xs font-medium border border-brand-primary/20 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15 transition-colors flex items-center gap-2"
                            >
                                <TableCellsIcon className="w-4 h-4" /> Download Template
                            </button>
                            <button
                                onClick={() => setUploadMode(!uploadMode)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-2 ${uploadMode
                                        ? 'bg-brand-secondary text-white border-transparent'
                                        : 'bg-card text-body border-border hover:bg-surface'
                                    }`}
                            >
                                {uploadMode ? <PlusIcon className="w-4 h-4" /> : <ArrowUpTrayIcon className="w-4 h-4" />}
                                {uploadMode ? 'Switch to Manual Entry' : 'Import from Excel'}
                            </button>
                        </div>
                    </div>

                    {/* How to use Guide */}
                    <div className="px-6 py-4 bg-surface border-b border-border-light">
                        <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0 text-brand-primary">
                                <TableCellsIcon className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-heading mb-1">General Ledger Guide</h3>
                                <p className="text-xs text-body leading-relaxed max-w-4xl">
                                    Use this module to log manual journal entries or bulk import ledger transactions. Ensure your entries **balance** (Total Debits = Total Credits). 
                                    For Excel imports, download the template below to ensure columns like <span className="font-bold">AccountCode</span>, <span className="font-bold">Debit</span>, and <span className="font-bold">Credit</span> are correctly formatted.
                                </p>
                            </div>
                        </div>
                    </div>

                    {!uploadMode ? (
                        <div className="p-6">
                            {/* Header Fields */}
                            <div className="grid grid-cols-3 gap-6 mb-8">
                                <div>
                                    <label className="text-xs font-outfit text-muted mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={entryDate}
                                        onChange={(e) => setEntryDate(e.target.value)}
                                        className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none bg-card"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-outfit text-muted mb-1">Reference #</label>
                                    <input
                                        type="text"
                                        value={reference}
                                        placeholder="e.g. JE-2024-001"
                                        onChange={(e) => setReference(e.target.value)}
                                        className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none bg-card"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-outfit text-muted mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        placeholder="Brief description of the entry"
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none bg-card"
                                    />
                                </div>
                            </div>

                            {/* Lines Table */}
                            <div className="border border-border rounded-lg overflow-hidden mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-surface border-b border-border">
                                        <tr>
                                            <th className="text-left text-xs font-outfit text-heading px-4 py-3 w-1/3">Account</th>
                                            <th className="text-left text-xs font-outfit text-heading px-4 py-3 w-1/3">Line Description</th>
                                            <th className="text-right text-xs font-outfit text-heading px-4 py-3 w-32">Debit</th>
                                            <th className="text-right text-xs font-outfit text-heading px-4 py-3 w-32">Credit</th>
                                            <th className="w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light">
                                        {lines.map((line, index) => (
                                            <tr key={index} className="group hover:bg-surface">
                                                <td className="px-4 py-2 relative">
                                                    {line.account_id ? (
                                                        <div className="flex items-center justify-between p-2 bg-brand-primary/10 rounded border border-brand-primary/20 text-brand-primary">
                                                            <span>{line.account_code} - {line.account_name}</span>
                                                            <button onClick={() => {
                                                                const newLines = [...lines];
                                                                newLines[index].account_id = '';
                                                                newLines[index].account_code = '';
                                                                newLines[index].account_name = '';
                                                                setLines(newLines);
                                                            }}>
                                                                <XMarkIcon className="w-3.5 h-3.5 hover:text-danger" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Search account code or name..."
                                                                className="w-full border border-border rounded-lg px-2 py-1.5 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none bg-card"
                                                                value={showAccountDropdown === index ? accountSearch : ''}
                                                                onFocus={() => setShowAccountDropdown(index)}
                                                                onChange={(e) => setAccountSearch(e.target.value)}
                                                            />
                                                            {showAccountDropdown === index && (
                                                                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-card max-h-48 overflow-y-auto">
                                                                    {accounts
                                                                        .filter(a =>
                                                                            a.account_name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                                                                            a.code.includes(accountSearch)
                                                                        )
                                                                        .map(account => (
                                                                            <div
                                                                                key={account.id}
                                                                                onClick={() => handleAccountSelect(index, account)}
                                                                                className="px-3 py-2 cursor-pointer hover:bg-surface text-sm"
                                                                            >
                                                                                <span className="font-mono text-muted mr-2">{account.code}</span>
                                                                                {account.account_name}
                                                                            </div>
                                                                        ))
                                                                    }
                                                                    <div
                                                                        className="px-3 py-2 cursor-pointer text-muted hover:bg-surface text-xs border-t border-border-light"
                                                                        onClick={() => setShowAccountDropdown(null)}
                                                                    >
                                                                        Close
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        className="w-full border-transparent bg-transparent focus:border-border focus:bg-card rounded-lg px-2 py-1.5 outline-none"
                                                        placeholder={description || "Line description..."}
                                                        value={line.description}
                                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        className="w-full text-right border border-border rounded-lg px-2 py-1.5 outline-none focus:border-brand-primary bg-card"
                                                        value={line.debit}
                                                        onChange={(e) => updateLine(index, 'debit', e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        className="w-full text-right border border-border rounded-lg px-2 py-1.5 outline-none focus:border-brand-primary bg-card"
                                                        value={line.credit}
                                                        onChange={(e) => updateLine(index, 'credit', e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => removeLine(index)}
                                                        className="text-muted hover:text-danger transition-colors"
                                                        title="Remove line"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-surface font-medium">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3">
                                                <button
                                                    onClick={addLine}
                                                    className="flex items-center gap-1 text-xs text-brand-primary font-medium hover:underline"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5" /> Add Line
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {totalDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td></td>
                                        </tr>
                                        {difference !== 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-2 text-center bg-danger-fill text-danger-text text-xs">
                                                    Out of balance by: {difference.toFixed(2)}
                                                </td>
                                            </tr>
                                        )}
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={handleManualSubmit}
                                    className="f-btn"
                                >
                                    Post Journal Entry
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 flex flex-col items-center justify-center text-center">
                            <div className="w-full max-w-lg p-8 border-2 border-dashed border-border rounded-xl hover:border-brand-primary hover:bg-surface transition-all cursor-pointer bg-surface/50 relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <TableCellsIcon className="w-12 h-12 mx-auto text-muted mb-4" />
                                <h3 className="text-lg font-medium text-heading mb-2">Upload Excel or CSV</h3>
                                <p className="text-sm text-muted mb-6">
                                    Drag and drop your file here, or click to browse.
                                </p>
                                <p className="text-xs text-muted">
                                    Expected columns: <span className="font-mono bg-surface px-1 py-0.5 rounded">Date</span>, <span className="font-mono bg-surface px-1 py-0.5 rounded">Description</span>, <span className="font-mono bg-surface px-1 py-0.5 rounded">Reference</span>, <span className="font-mono bg-surface px-1 py-0.5 rounded">AccountCode</span>, <span className="font-mono bg-surface px-1 py-0.5 rounded">Debit</span>, <span className="font-mono bg-surface px-1 py-0.5 rounded">Credit</span>
                                </p>
                            </div>

                            {file && (
                                <div className="mt-8 w-full max-w-2xl text-left">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium text-heading">Preview ({parsedData.length} entries)</h3>
                                        <button
                                            onClick={handleExcelSubmit}
                                            className="f-btn"
                                        >
                                            Upload & Post
                                        </button>
                                    </div>
                                    <div className="border border-border rounded-lg max-h-60 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-surface sticky top-0">
                                                <tr>
                                                    {parsedData.length > 0 && Object.keys(parsedData[0]).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left text-muted font-medium">{key}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {parsedData.slice(0, 10).map((row, i) => (
                                                    <tr key={i}>
                                                        {Object.values(row).map((val, j) => (
                                                            <td key={j} className="px-3 py-2">{val}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {parsedData.length > 10 && (
                                            <div className="p-2 text-center text-xs text-muted bg-surface">
                                                ... and {parsedData.length - 10} more rows
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GeneralLedgerEntries;

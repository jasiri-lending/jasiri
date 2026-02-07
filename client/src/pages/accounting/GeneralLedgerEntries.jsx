import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Plus, ArrowLeft, Upload, FileSpreadsheet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/userAuth';
import { useToast } from '../../components/Toast';
import Spinner from '../../components/Spinner';
import { API_BASE_URL } from '../../../config';

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
            const sessionToken = localStorage.getItem('sessionToken');
            const response = await fetch(`${API_BASE_URL}/api/chart-of-accounts?tenant_id=${profile?.tenant_id}`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
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
            const sessionToken = localStorage.getItem('sessionToken');
            const response = await fetch(`${API_BASE_URL}/api/journal-entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
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
            const sessionToken = localStorage.getItem('sessionToken');
            const response = await fetch(`${API_BASE_URL}/api/journal-entries/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionToken}`
                },
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

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spinner text="Processing Journal Entry..." />
            </div>
        );
    }

    return (
        <div className="p-6 bg-brand-surface min-h-screen">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate("/accounting/journals")}
                    className="mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={16} /> Back to Journals
                </button>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-800">General Journal Entry</h1>
                            <p className="text-sm text-gray-500">Log expenses, incomes, or adjustments manually</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setUploadMode(!uploadMode)}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-2 ${uploadMode
                                    ? 'bg-brand-secondary text-white border-transparent'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                            >
                                {uploadMode ? <FileSpreadsheet size={16} /> : <Upload size={16} />}
                                {uploadMode ? 'Switch to Manual Entry' : 'Import from Excel'}
                            </button>
                        </div>
                    </div>

                    {!uploadMode ? (
                        <div className="p-6">
                            {/* Header Fields */}
                            <div className="grid grid-cols-3 gap-6 mb-8">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={entryDate}
                                        onChange={(e) => setEntryDate(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-brand-btn focus:border-brand-btn outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Reference #</label>
                                    <input
                                        type="text"
                                        value={reference}
                                        placeholder="e.g. JE-2024-001"
                                        onChange={(e) => setReference(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-brand-btn focus:border-brand-btn outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                                    <input
                                        type="text"
                                        value={description}
                                        placeholder="Brief description of the entry"
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-1 focus:ring-brand-btn focus:border-brand-btn outline-none"
                                    />
                                </div>
                            </div>

                            {/* Lines Table */}
                            <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="text-left px-4 py-3 w-1/3">Account</th>
                                            <th className="text-left px-4 py-3 w-1/3">Line Description</th>
                                            <th className="text-right px-4 py-3 w-32">Debit</th>
                                            <th className="text-right px-4 py-3 w-32">Credit</th>
                                            <th className="w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {lines.map((line, index) => (
                                            <tr key={index} className="group hover:bg-gray-50">
                                                <td className="px-4 py-2 relative">
                                                    {line.account_id ? (
                                                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-100 text-blue-800">
                                                            <span>{line.account_code} - {line.account_name}</span>
                                                            <button onClick={() => {
                                                                const newLines = [...lines];
                                                                newLines[index].account_id = '';
                                                                newLines[index].account_code = '';
                                                                newLines[index].account_name = '';
                                                                setLines(newLines);
                                                            }}>
                                                                <X size={14} className="hover:text-red-500" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Search account code or name..."
                                                                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:border-brand-btn focus:ring-1 focus:ring-brand-btn outline-none"
                                                                value={showAccountDropdown === index ? accountSearch : ''}
                                                                onFocus={() => setShowAccountDropdown(index)}
                                                                onChange={(e) => setAccountSearch(e.target.value)}
                                                            />
                                                            {showAccountDropdown === index && (
                                                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                                                                    {accounts
                                                                        .filter(a =>
                                                                            a.account_name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                                                                            a.code.includes(accountSearch)
                                                                        )
                                                                        .map(account => (
                                                                            <div
                                                                                key={account.id}
                                                                                onClick={() => handleAccountSelect(index, account)}
                                                                                className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                                                                            >
                                                                                <span className="font-mono text-gray-500 mr-2">{account.code}</span>
                                                                                {account.account_name}
                                                                            </div>
                                                                        ))
                                                                    }
                                                                    <div
                                                                        className="px-3 py-2 cursor-pointer text-gray-500 hover:bg-gray-100 text-xs border-t"
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
                                                        className="w-full border-transparent bg-transparent focus:border-gray-300 focus:bg-white rounded px-2 py-1.5 outline-none"
                                                        placeholder={description || "Line description..."}
                                                        value={line.description}
                                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        className="w-full text-right border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand-btn"
                                                        value={line.debit}
                                                        onChange={(e) => updateLine(index, 'debit', e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        className="w-full text-right border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-brand-btn"
                                                        value={line.credit}
                                                        onChange={(e) => updateLine(index, 'credit', e.target.value)}
                                                        placeholder="0.00"
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        onClick={() => removeLine(index)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                                        title="Remove line"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-medium">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-3">
                                                <button
                                                    onClick={addLine}
                                                    className="flex items-center gap-1 text-xs text-brand-primary font-medium hover:underline"
                                                >
                                                    <Plus size={14} /> Add Line
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
                                                <td colSpan={5} className="px-4 py-2 text-center bg-red-50 text-red-600 text-xs">
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
                                    className="px-6 py-2 bg-brand-primary text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Post Journal Entry
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-10 flex flex-col items-center justify-center text-center">
                            <div className="w-full max-w-lg p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary hover:bg-blue-50 transition-all cursor-pointer bg-gray-50 relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <FileSpreadsheet size={48} className="mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Excel or CSV</h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Drag and drop your file here, or click to browse.
                                </p>
                                <p className="text-xs text-gray-400">
                                    Expected columns: <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Date</span>, <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Description</span>, <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Reference</span>, <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">AccountCode</span>, <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Debit</span>, <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">Credit</span>
                                </p>
                            </div>

                            {file && (
                                <div className="mt-8 w-full max-w-2xl text-left">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium text-gray-700">Preview ({parsedData.length} entries)</h3>
                                        <button
                                            onClick={handleExcelSubmit}
                                            className="px-4 py-2 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                                        >
                                            Upload & Post
                                        </button>
                                    </div>
                                    <div className="border rounded max-h-60 overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    {parsedData.length > 0 && Object.keys(parsedData[0]).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left text-gray-500 font-medium">{key}</th>
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
                                            <div className="p-2 text-center text-xs text-gray-400 bg-gray-50">
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

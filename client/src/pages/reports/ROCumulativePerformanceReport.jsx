import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Filter, Search, RefreshCw, BarChart2, DollarSign, Activity, FileText } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d", "#ffc658"];

const MetricCard = ({ title, value, subtitle, icon: Icon, color = "blue" }) => {
    const colorMap = {
        blue: { bg: "bg-blue-50", border: "border-blue-100", iconBg: "bg-blue-100", iconColor: "text-blue-600", titleColor: "text-blue-700", valueColor: "text-blue-800" },
        emerald: { bg: "bg-emerald-50", border: "border-emerald-100", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", titleColor: "text-emerald-700", valueColor: "text-emerald-800" },
        orange: { bg: "bg-orange-50", border: "border-orange-100", iconBg: "bg-orange-100", iconColor: "text-orange-600", titleColor: "text-orange-700", valueColor: "text-orange-800" },
        purple: { bg: "bg-purple-50", border: "border-purple-100", iconBg: "bg-purple-100", iconColor: "text-purple-600", titleColor: "text-purple-700", valueColor: "text-purple-800" },
        red: { bg: "bg-red-50", border: "border-red-100", iconBg: "bg-red-100", iconColor: "text-red-600", titleColor: "text-red-700", valueColor: "text-red-800" },
        amber: { bg: "bg-amber-50", border: "border-amber-100", iconBg: "bg-amber-100", iconColor: "text-amber-600", titleColor: "text-amber-700", valueColor: "text-amber-800" },
    };

    const style = colorMap[color] || colorMap.blue;

    return (
        <div className={`${style.bg} ${style.border} border rounded-2xl shadow-sm p-6 flex flex-col justify-between h-full transition-all hover:shadow-md`}>
            <div className="flex justify-between items-start gap-4 mb-4">
                <div className="flex-1 min-w-0">
                    <p className={`text-xs sm:text-sm font-bold ${style.titleColor} uppercase tracking-wider truncate mb-1 opacity-80`}>
                        {title}
                    </p>
                    <h3 className={`text-lg sm:text-xl font-bold ${style.valueColor} break-words leading-tight`}>
                        {value}
                    </h3>
                </div>
                <div className={`p-3 sm:p-4 rounded-2xl flex-shrink-0 ${style.iconBg} ${style.iconColor} shadow-inner`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
            </div>
            {subtitle && (
                <div className="border-t border-current/10 pt-3 mt-auto">
                    <p className={`text-xs font-bold ${style.titleColor} opacity-70 flex items-center gap-1.5`}>
                        <span className="w-2 h-2 rounded-full bg-current opacity-40 animate-pulse"></span>
                        {subtitle}
                    </p>
                </div>
            )}
        </div>
    );
};

const ROCumulativePerformanceReport = () => {
    const [tenant] = useState(() => {
        try {
            const savedTenant = localStorage.getItem("tenant");
            return savedTenant ? JSON.parse(savedTenant) : null;
        } catch (e) {
            return null;
        }
    });
    const { profile } = useAuth();

    const [rawReports, setRawReports] = useState([]);
    const [branches, setBranches] = useState([]);
    const [regions, setRegions] = useState([]);
    const [loanOfficers, setLoanOfficers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [exportFormat, setExportFormat] = useState("csv");

    const [filters, setFilters] = useState({
        search: "",
        branch: "",
        region: "",
        loanOfficer: "",
        loanProduct: "",
        dateRange: "all",
    });

    const formatCurrency = (num) =>
        new Intl.NumberFormat("en-KE", {
            style: "currency",
            currency: "KES",
            minimumFractionDigits: 0,
        }).format(num || 0);

    const formatPercentage = (num) => `${Math.round(num * 10) / 10}%`;

    // Filter out unique products from data
    const availableProducts = useMemo(() => {
        const products = new Set(rawReports.map((r) => r.loan_product));
        return Array.from(products).filter(Boolean);
    }, [rawReports]);

    const loadData = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);

        try {
            // Apply RBAC Logic to queries
            let branchesQuery = supabase.from("branches").select("id, name, region_id").eq("tenant_id", tenant.id);
            let regionsQuery = supabase.from("regions").select("id, name").eq("tenant_id", tenant.id);
            let usersQuery = supabase.from("users").select("id, full_name").eq("role", "relationship_officer").eq("tenant_id", tenant.id);
            let loansQuery = supabase.from("loans").select(`
                id, booked_by, branch_id, region_id, product_type, product_name, created_at, status, repayment_state, scored_amount, total_payable, total_interest, is_new_loan
            `).eq("tenant_id", tenant.id);
            let installmentsQuery = supabase.from("loan_installments").select(`
                loan_id, status, due_date, due_amount, penalty_amount, paid_amount
            `).eq("tenant_id", tenant.id);
            let paymentsQuery = supabase.from("loan_payments").select(`
                loan_id, reversal_of, paid_amount, principal_paid, interest_paid, penalty_paid
            `).eq("tenant_id", tenant.id);

            // Role-based restrictions
            if (profile?.role === "relationship_officer") {
                loansQuery = loansQuery.eq("booked_by", profile.id);
                usersQuery = usersQuery.eq("id", profile.id);
            } else if (profile?.role === "branch_manager" || profile?.role === "customer_service_officer") {
                loansQuery = loansQuery.eq("branch_id", profile.branch_id);
                branchesQuery = branchesQuery.eq("id", profile.branch_id);
                usersQuery = usersQuery.eq("branch_id", profile.branch_id);
            } else if (profile?.role === "regional_manager") {
                loansQuery = loansQuery.eq("region_id", profile.region_id);
                regionsQuery = regionsQuery.eq("id", profile.region_id);
                branchesQuery = branchesQuery.eq("region_id", profile.region_id);
                usersQuery = usersQuery.eq("region_id", profile.region_id);
            }

            const [branchesRes, regionsRes, usersRes, loansRes, installmentsRes, paymentsRes] = await Promise.all([
                branchesQuery,
                regionsQuery,
                usersQuery,
                loansQuery,
                installmentsQuery,
                paymentsQuery
            ]);

            const branchesData = branchesRes.data || [];
            const regionsData = regionsRes.data || [];
            const usersData = usersRes.data || [];
            const loansData = loansRes.data || [];
            const installmentsData = installmentsRes.data || [];
            const paymentsData = paymentsRes.data || [];

            setBranches(branchesData);
            setRegions(regionsData);
            setLoanOfficers(usersData);

            const userMap = {};
            usersData.forEach(u => userMap[u.id] = u.full_name);

            const loanPayments = {};
            paymentsData.forEach(p => {
                if (p.reversal_of) return;
                if (!loanPayments[p.loan_id]) {
                    loanPayments[p.loan_id] = { total: 0, principal: 0, interest: 0, penalty: 0 };
                }
                loanPayments[p.loan_id].total += (Number(p.paid_amount) || 0);
                loanPayments[p.loan_id].principal += (Number(p.principal_paid) || 0);
                loanPayments[p.loan_id].interest += (Number(p.interest_paid) || 0);
                loanPayments[p.loan_id].penalty += (Number(p.penalty_paid) || 0);
            });

            const loanArrears = {};
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            installmentsData.forEach(i => {
                const dueDate = new Date(i.due_date);
                if (dueDate <= currentDate && (i.status === 'overdue' || i.status === 'partial')) {
                    if (!loanArrears[i.loan_id]) loanArrears[i.loan_id] = 0;
                    const dueParams = (Number(i.due_amount) || 0) + (Number(i.penalty_amount) || 0) - (Number(i.paid_amount) || 0);
                    loanArrears[i.loan_id] += dueParams;
                }
            });

            const rawData = loansData.filter(l => l.status === 'disbursed').map(l => {
                const bookedDate = new Date(l.created_at).toISOString();
                const payStats = loanPayments[l.id] || { total: 0, principal: 0, interest: 0, penalty: 0 };
                const arrAmount = loanArrears[l.id] || 0;
                const isActive = (['ongoing', 'partial', 'overdue'].includes(l.repayment_state)) ? 1 : 0;
                const isDisbursed = 1;

                let total_payable = Number(l.total_payable) || 0;
                let total_paid = payStats.total;
                let outstanding_balance = isActive === 1 ? Math.max(0, total_payable - total_paid) : 0;

                return {
                    relationship_officer_id: l.booked_by,
                    relationship_officer_name: userMap[l.booked_by] || 'Unknown',
                    branch_id: l.branch_id || '00000000-0000-0000-0000-000000000000',
                    region_id: l.region_id || '00000000-0000-0000-0000-000000000000',
                    loan_product: l.product_type || l.product_name || 'Unknown',
                    booked_date: bookedDate,

                    loan_count: 1,
                    is_new_loan_count: l.is_new_loan ? 1 : 0,
                    is_repeat_loan_count: l.is_new_loan ? 0 : 1,

                    is_disbursed: isDisbursed,
                    total_disbursed: isDisbursed === 1 ? (Number(l.scored_amount) || 0) : 0,

                    active_loans: isActive,
                    outstanding_balance: outstanding_balance,

                    total_payable: total_payable,
                    principal_payable: Number(l.scored_amount) || 0,
                    total_interest: Number(l.total_interest) || 0,

                    arrears_count: l.repayment_state === 'overdue' ? 1 : 0,
                    arrears_amount: arrAmount,

                    total_paid: total_paid,
                    principal_paid: payStats.principal,
                    interest_paid: payStats.interest,
                    penalties_paid: payStats.penalty
                };
            });

            setRawReports(rawData);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [tenant?.id, profile?.role, profile?.id, profile?.branch_id, profile?.region_id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRefreshView = async () => {
        setRefreshing(true);
        try {
            await loadData();
        } catch (err) {
            console.error(err);
        } finally {
            setRefreshing(false);
        }
    };

    const getDateRange = useCallback(() => {
        const now = new Date();
        const start = new Date();
        switch (filters.dateRange) {
            case "today":
                start.setHours(0, 0, 0, 0);
                return { start: start.toISOString(), end: now.toISOString() };
            case "this_month":
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                return { start: start.toISOString(), end: now.toISOString() };
            case "quarterly":
                const quarter = Math.floor(now.getMonth() / 3);
                start.setMonth(quarter * 3, 1);
                start.setHours(0, 0, 0, 0);
                return { start: start.toISOString(), end: now.toISOString() };
            case "yearly":
                // This year
                start.setMonth(0, 1);
                start.setHours(0, 0, 0, 0);
                return { start: start.toISOString(), end: now.toISOString() };
            default:
                return { start: null, end: null };
        }
    }, [filters.dateRange]);

    const filteredRawData = useMemo(() => {
        let result = [...rawReports];

        if (filters.search) {
            const q = filters.search.toLowerCase();
            result = result.filter(
                (r) =>
                    r.relationship_officer_name?.toLowerCase().includes(q) ||
                    r.loan_product?.toLowerCase().includes(q)
            );
        }

        if (filters.region) result = result.filter((r) => r.region_id === filters.region);
        if (filters.branch) result = result.filter((r) => r.branch_id === filters.branch);
        if (filters.loanOfficer) result = result.filter((r) => r.relationship_officer_id === filters.loanOfficer);
        if (filters.loanProduct) result = result.filter((r) => r.loan_product === filters.loanProduct);

        const dr = getDateRange();
        if (dr.start) {
            result = result.filter(r => {
                const d = new Date(r.booked_date);
                return d >= new Date(dr.start) && d <= new Date(dr.end);
            });
        }
        return result;
    }, [rawReports, filters, getDateRange]);

    const tableData = useMemo(() => {
        const grouped = {};
        filteredRawData.forEach(row => {
            const key = `${row.relationship_officer_id}`;
            if (!grouped[key]) {
                grouped[key] = {
                    officerName: row.relationship_officer_name,
                    regionName: regions.find(r => r.id === row.region_id)?.name || 'Unknown',
                    branchName: branches.find(b => b.id === row.branch_id)?.name || 'Unknown',
                    totalPayable: 0,
                    totalDisbursed: 0,
                    outstandingBalance: 0,
                    loanCount: 0,
                    newLoansCount: 0,
                    repeatLoansCount: 0,
                    totalInterest: 0,
                    principalPayable: 0,
                    totalPaid: 0,
                    arrearsAmount: 0,
                    arrearsCount: 0,
                };
            }

            grouped[key].loanCount += (row.loan_count || 0);
            grouped[key].newLoansCount += (row.is_new_loan_count || 0);
            grouped[key].repeatLoansCount += (row.is_repeat_loan_count || 0);
            grouped[key].totalDisbursed += (row.total_disbursed || 0);
            grouped[key].totalPayable += (row.total_payable || 0);
            grouped[key].totalInterest += (row.total_interest || 0);
            grouped[key].principalPayable += (row.principal_payable || 0);
            grouped[key].totalPaid += (row.total_paid || 0);
            grouped[key].arrearsAmount += (row.arrears_amount || 0);
            grouped[key].arrearsCount += (row.arrears_count || 0);
            grouped[key].outstandingBalance += (row.outstanding_balance || 0);
        });

        return Object.values(grouped).map(g => ({
            ...g,
            paymentRate: g.totalPayable > 0 ? (g.totalPaid / g.totalPayable) * 100 : 0,
        })).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
    }, [filteredRawData, regions, branches]);

    // Aggregate stats for KPIs
    const kpis = useMemo(() => {
        return tableData.reduce((acc, curr) => ({
            loanCount: acc.loanCount + curr.loanCount,
            totalDisbursed: acc.totalDisbursed + curr.totalDisbursed,
            arrearsAmount: acc.arrearsAmount + curr.arrearsAmount,
            arrearsCount: acc.arrearsCount + curr.arrearsCount,
            totalPaid: acc.totalPaid + curr.totalPaid,
            totalPayable: acc.totalPayable + curr.totalPayable,
        }), { loanCount: 0, totalDisbursed: 0, arrearsAmount: 0, arrearsCount: 0, totalPaid: 0, totalPayable: 0 });
    }, [tableData]);

    const overallPaymentRate = kpis.totalPayable > 0 ? (kpis.totalPaid / kpis.totalPayable) * 100 : 0;

    // Chart Data
    const disbursementByProduct = useMemo(() => {
        const prodMap = {};
        filteredRawData.forEach(r => {
            prodMap[r.loan_product] = (prodMap[r.loan_product] || 0) + r.total_disbursed;
        });
        return Object.entries(prodMap).map(([name, value]) => ({ name, value }));
    }, [filteredRawData]);

    const roRanking = useMemo(() => {
        return tableData.map(r => ({
            name: r.officerName,
            Disbursed: r.totalDisbursed,
            Collected: r.totalPaid
        })).slice(0, 10);
    }, [tableData]);

    const handleFilterChange = (k, v) => {
        setFilters(f => ({ ...f, [k]: v }));
    };

    const exportToCSV = () => {
        if (tableData.length === 0) return;
        const csvRows = [
            ["RO Name", "Region", "Branch", "Total Payable", "Total Disbursed", "Outstanding Loan Balance", "Loan Count", "New Loans", "Repeat Loans", "Interest", "Principal", "Amount Paid", "Amount in Arrears", "Arrears Count", "Payment Rate %"]
        ];
        tableData.forEach(r => {
            csvRows.push([
                r.officerName, r.regionName, r.branchName, r.totalPayable.toFixed(2), r.totalDisbursed.toFixed(2),
                r.outstandingBalance.toFixed(2), r.loanCount, r.newLoansCount, r.repeatLoansCount,
                r.totalInterest.toFixed(2), r.principalPayable.toFixed(2), r.totalPaid.toFixed(2),
                r.arrearsAmount.toFixed(2), r.arrearsCount, r.paymentRate.toFixed(2)
            ]);
        });
        const csvContent = "\\uFEFF" + csvRows.map(e => e.join(",")).join("\\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "RO_Cumulative_Performance.csv";
        link.click();
    };

    if (loading) {
        return <div className="min-h-screen bg-muted flex items-center justify-center"><Spinner text="Loading Cumulative Report..." /></div>;
    }

    return (
        <div className="min-h-screen bg-muted p-6">
            <div className="max-w-[1600px] mx-auto space-y-6">
                {/* Header */}
                <div className="bg-brand-secondary rounded-xl shadow-md border p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-sm font-bold text-stone-600 uppercase">{tenant?.company_name || ""}</h1>
                        <h2 className="text-xl font-semibold text-white mt-1">RO Cumulative Performance Report</h2>
                        <p className="text-xs text-stone-300 mt-1">Metrics compiled directly from underlying loan records.</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleRefreshView}
                            disabled={refreshing}
                            className="px-4 py-2 bg-brand-secondary hover:brightness-110 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing && 'animate-spin'}`} />
                            {refreshing ? 'Refreshing Data...' : 'Refresh Data'}
                        </button>
                        <button onClick={() => setShowFilters(!showFilters)} className="px-4 py-2 bg-white text-gray-800 rounded-lg text-sm font-medium flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Filters
                        </button>
                        <button onClick={exportToCSV} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium flex items-center gap-2">
                            <Download className="w-4 h-4" /> Export
                        </button>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-white p-5 rounded-xl border shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                        <input
                            type="text"
                            placeholder="Search RO or Product..."
                            value={filters.search}
                            onChange={e => handleFilterChange('search', e.target.value)}
                            className="border p-2 rounded-lg text-sm w-full"
                        />
                        {/* Hide Region filter if RM, BM, CSO, or RO */}
                        {profile?.role !== "regional_manager" && profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                            <select value={filters.region} onChange={e => handleFilterChange('region', e.target.value)} className="border p-2 rounded-lg text-sm w-full">
                                <option value="">All Regions</option>
                                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        )}
                        {/* Hide Branch filter if BM, CSO, or RO */}
                        {profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                            <select value={filters.branch} onChange={e => handleFilterChange('branch', e.target.value)} className="border p-2 rounded-lg text-sm w-full">
                                <option value="">All Branches</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        )}
                        {/* Hide Officer filter if RO */}
                        {profile?.role !== "relationship_officer" && (
                            <select value={filters.loanOfficer} onChange={e => handleFilterChange('loanOfficer', e.target.value)} className="border p-2 rounded-lg text-sm w-full">
                                <option value="">All Officers</option>
                                {loanOfficers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                        )}
                        <select value={filters.loanProduct} onChange={e => handleFilterChange('loanProduct', e.target.value)} className="border p-2 rounded-lg text-sm w-full">
                            <option value="">All Products</option>
                            {availableProducts.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={filters.dateRange} onChange={e => handleFilterChange('dateRange', e.target.value)} className="border p-2 rounded-lg text-sm w-full">
                            <option value="all">All Time</option>
                            <option value="today">Today</option>
                            <option value="this_month">This Month</option>
                            <option value="quarterly">This Quarter</option>
                            <option value="yearly">This Year</option>
                        </select>
                    </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <MetricCard title="Total Loans" value={kpis.loanCount} color="blue" icon={FileText} />
                    <MetricCard title="Principal Disbursed" value={formatCurrency(kpis.totalDisbursed)} color="emerald" icon={DollarSign} />
                    <MetricCard title="Total Payable" value={formatCurrency(kpis.totalPayable)} color="orange" icon={DollarSign} />
                    <MetricCard title="Total Paid" value={formatCurrency(kpis.totalPaid)} color="purple" icon={DollarSign} />
                    <MetricCard title="Arrears Total" value={formatCurrency(kpis.arrearsAmount)} subtitle={`${kpis.arrearsCount} loans`} color="red" icon={Activity} />
                    <MetricCard title="Repayment Rate" value={formatPercentage(overallPaymentRate)} color="amber" icon={BarChart2} />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border shadow-sm h-96">
                        <h3 className="font-bold text-gray-800 mb-4">Disbursement by Product</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={disbursementByProduct} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label={entry => entry.name}>
                                    {disbursementByProduct.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white p-5 rounded-xl border shadow-sm h-96">
                        <h3 className="font-bold text-gray-800 mb-4">Top RO Performance (Disbursed vs Collected)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roRanking} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={(val) => `${val / 1000}k`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Bar dataKey="Disbursed" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Collected" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b">
                        <h3 className="font-bold text-gray-800">Detailed Performance Table</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-gray-700">RO Name</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700">Region</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700">Branch</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total Payable</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Total Disbursed</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Outstanding Balance</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Loan Count</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">New Loans</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Repeat Loans</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Interest</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Principal</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Amount Paid</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-right">Amount in Arrears</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Arrears Count</th>
                                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">Payment Rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {tableData.map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-gray-800 font-medium">{row.officerName}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.regionName}</td>
                                        <td className="px-4 py-3 text-gray-600">{row.branchName}</td>
                                        <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(row.totalPayable)}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(row.totalDisbursed)}</td>
                                        <td className="px-4 py-3 text-right text-orange-600 font-medium">{formatCurrency(row.outstandingBalance)}</td>
                                        <td className="px-4 py-3 text-center font-medium">{row.loanCount}</td>
                                        <td className="px-4 py-3 text-center text-blue-600 font-medium">{row.newLoansCount}</td>
                                        <td className="px-4 py-3 text-center text-purple-600 font-medium">{row.repeatLoansCount}</td>
                                        <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(row.totalInterest)}</td>
                                        <td className="px-4 py-3 text-right text-gray-800 font-medium">{formatCurrency(row.principalPayable)}</td>
                                        <td className="px-4 py-3 text-right text-indigo-600 font-medium">{formatCurrency(row.totalPaid)}</td>
                                        <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(row.arrearsAmount)}</td>
                                        <td className="px-4 py-3 text-center text-red-600 font-medium">{row.arrearsCount}</td>
                                        <td className="px-4 py-3 text-center font-bold text-gray-700">
                                            <span className={`px-2 py-1 rounded inline-block w-16 ${row.paymentRate >= 90 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {formatPercentage(row.paymentRate)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {tableData.length === 0 && (
                                    <tr>
                                        <td colSpan="15" className="px-4 py-8 text-center text-gray-500">
                                            No performance data found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ROCumulativePerformanceReport;

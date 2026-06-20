import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Download, Filter, Search, RefreshCw, BarChart2, DollarSign, Activity, FileText, X } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
} from "docx";
import { saveAs } from "file-saver";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
    CartesianGrid, PieChart, Pie, Cell
} from "recharts";
import { SkeletonTable } from "../../components/Skeleton";
import { Pagination } from "../../components/Pagination";
import CustomSelect from "../../components/CustomSelect";

const COLORS = ["#1A7A4A", "#5DCAA5", "#0F1F17", "#1A4A30", "#FFBB28", "#6366f1", "#a855f7"];

const MetricCard = ({ title, value, subtitle, icon: Icon, color = "blue" }) => {
    const colorMap = {
        blue: { iconBg: "bg-brand/10", iconColor: "text-brand" },
        emerald: { iconBg: "bg-emerald-100 dark:bg-emerald-950/30", iconColor: "text-emerald-600" },
        orange: { iconBg: "bg-orange-100 dark:bg-orange-950/30", iconColor: "text-orange-600" },
        purple: { iconBg: "bg-purple-100 dark:bg-purple-950/30", iconColor: "text-purple-600" },
        red: { iconBg: "bg-rose-100 dark:bg-rose-950/30", iconColor: "text-rose-600" },
        amber: { iconBg: "bg-amber-100 dark:bg-amber-950/30", iconColor: "text-amber-600" },
    };

    const style = colorMap[color] || colorMap.blue;

    return (
        <div className="bg-card border border-border rounded-xl shadow-card p-6 flex flex-col justify-between h-full transition-all duration-200 hover:shadow-md">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wide truncate mb-1">
                        {title}
                    </p>
                    <h3 className="text-xl font-bold text-text-primary break-words leading-tight">
                        {value}
                    </h3>
                </div>
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${style.iconBg} ${style.iconColor}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            {subtitle && (
                <div className="border-t border-border-light pt-3 mt-4">
                    <p className="text-xs text-text-muted flex items-center gap-1.5 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
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
    const [currentPage, setCurrentPage] = useState(1);

    const itemsPerPage = 10;

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

    const formatPercentage = (num) => `${Math.round((num || 0) * 10) / 10}%`;

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
            } else if (profile?.role === "regional_manager") {
                loansQuery = loansQuery.eq("region_id", profile.region_id);
                regionsQuery = regionsQuery.eq("id", profile.region_id);
                branchesQuery = branchesQuery.eq("region_id", profile.region_id);
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
    }, [tenant?.id, profile]);

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

    // Pagination
    const pagination = useMemo(() => {
        const totalRows = tableData.length;
        const startIdx = (currentPage - 1) * itemsPerPage;
        const endIdx = Math.min(startIdx + itemsPerPage, totalRows);
        const currentData = tableData.slice(startIdx, endIdx);
        return { totalRows, startIdx, endIdx, currentData };
    }, [tableData, currentPage]);

    const handleFilterChange = (k, v) => {
        setFilters(f => ({ ...f, [k]: v }));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setFilters({
            search: "",
            branch: "",
            region: "",
            loanOfficer: "",
            loanProduct: "",
            dateRange: "all",
        });
        setCurrentPage(1);
    };

    const hasActiveFilters = useMemo(() => {
        return (
            filters.region !== "" ||
            filters.branch !== "" ||
            filters.loanOfficer !== "" ||
            filters.loanProduct !== "" ||
            filters.dateRange !== "all"
        );
    }, [filters]);

    // ========== Export Functions ==========
    const exportToPDF = () => {
        const doc = new jsPDF("l", "pt", "a4");
        const companyName = tenant?.company_name || "Jasiri";
        const reportTitle = "RO Cumulative Performance Report";

        autoTable(doc, {
            head: [
                [
                    "RO Name",
                    "Region",
                    "Branch",
                    "Total Payable",
                    "Total Disbursed",
                    "Outstanding Balance",
                    "Loan Count",
                    "New Loans",
                    "Repeat Loans",
                    "Amount Paid",
                    "Arrears Amount",
                    "Payment Rate %",
                ],
            ],
            body: tableData.map((r) => [
                r.officerName,
                r.regionName,
                r.branchName,
                formatCurrency(r.totalPayable),
                formatCurrency(r.totalDisbursed),
                formatCurrency(r.outstandingBalance),
                r.loanCount,
                r.newLoansCount,
                r.repeatLoansCount,
                formatCurrency(r.totalPaid),
                formatCurrency(r.arrearsAmount),
                formatPercentage(r.paymentRate),
            ]),
            didDrawPage: (data) => {
                doc.setFontSize(18);
                doc.setTextColor(40);
                doc.text(companyName, data.settings.margin.left, 40);
                doc.setFontSize(12);
                doc.text(reportTitle, data.settings.margin.left, 60);
                doc.setFontSize(10);
                doc.text(
                    `Generated on: ${new Date().toLocaleString()}`,
                    data.settings.margin.left,
                    80
                );
            },
            margin: { top: 100 },
            styles: { fontSize: 8, cellPadding: 5 },
            headStyles: { fillColor: [26, 122, 74], textColor: [255, 255, 255] },
        });

        doc.save(
            `${companyName.toLowerCase()}_ro_cumulative_performance_${new Date().toISOString().split("T")[0]}.pdf`
        );
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            tableData.map((r, i) => ({
                No: i + 1,
                "RO Name": r.officerName,
                Region: r.regionName,
                Branch: r.branchName,
                "Total Payable": r.totalPayable,
                "Total Disbursed": r.totalDisbursed,
                "Outstanding Balance": r.outstandingBalance,
                "Loan Count": r.loanCount,
                "New Loans": r.newLoansCount,
                "Repeat Loans": r.repeatLoansCount,
                Interest: r.totalInterest,
                Principal: r.principalPayable,
                "Amount Paid": r.totalPaid,
                "Amount in Arrears": r.arrearsAmount,
                "Arrears Count": r.arrearsCount,
                "Payment Rate (%)": r.paymentRate,
            }))
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
        XLSX.writeFile(
            workbook,
            `${tenant?.company_name || "Jasiri"}_ro_cumulative_performance_${new Date().toISOString().split("T")[0]}.xlsx`
        );
    };

    const exportToWord = async () => {
        const table = new Table({
            rows: [
                new TableRow({
                    children: ["RO Name", "Branch", "Total Disbursed", "Outstanding", "Amount Paid", "Arrears", "Payment Rate"].map(
                        (h) =>
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: [new TextRun({ text: h, bold: true })],
                                    }),
                                ],
                            })
                    ),
                }),
                ...tableData.map((r) =>
                    new TableRow({
                        children: [
                            r.officerName,
                            r.branchName,
                            formatCurrency(r.totalDisbursed),
                            formatCurrency(r.outstandingBalance),
                            formatCurrency(r.totalPaid),
                            formatCurrency(r.arrearsAmount),
                            formatPercentage(r.paymentRate),
                        ].map((v) => new TableCell({ children: [new Paragraph(v)] })),
                    })
                ),
            ],
        });

        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: tenant?.company_name || "Jasiri",
                                    bold: true,
                                    size: 32,
                                }),
                            ],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "RO Cumulative Performance Report", size: 24 })],
                        }),
                        new Paragraph({ text: `Generated on: ${new Date().toLocaleString()}` }),
                        new Paragraph({ text: "" }),
                        table,
                    ],
                },
            ],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(
            blob,
            `${tenant?.company_name || "Jasiri"}_ro_cumulative_performance_${new Date().toISOString().split("T")[0]}.docx`
        );
    };

    const exportToCSV = () => {
        if (tableData.length === 0) return;
        const csvRows = [
            ["RO Name", "Region", "Branch", "Total Payable", "Total Disbursed", "Outstanding Loan Balance", "Loan Count", "New Loans", "Repite Loans", "Interest", "Principal", "Amount Paid", "Amount in Arrears", "Arrears Count", "Payment Rate %"]
        ];
        tableData.forEach(r => {
            csvRows.push([
                r.officerName, r.regionName, r.branchName, r.totalPayable.toFixed(2), r.totalDisbursed.toFixed(2),
                r.outstandingBalance.toFixed(2), r.loanCount, r.newLoansCount, r.repeatLoansCount,
                r.totalInterest.toFixed(2), r.principalPayable.toFixed(2), r.totalPaid.toFixed(2),
                r.arrearsAmount.toFixed(2), r.arrearsCount, r.paymentRate.toFixed(2)
            ]);
        });
        const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        saveAs(blob, `ro_cumulative_performance_${new Date().toISOString().split("T")[0]}.csv`);
    };

    const handleExport = () => {
        switch (exportFormat) {
            case "pdf":
                exportToPDF();
                break;
            case "excel":
                exportToExcel();
                break;
            case "word":
                exportToWord();
                break;
            case "csv":
            default:
                exportToCSV();
                break;
        }
    };

    // Dropdown mappings
    const regionOptions = useMemo(() => {
        return [
            { value: "", label: "All Regions" },
            ...regions.map(r => ({ value: r.id, label: r.name }))
        ];
    }, [regions]);

    const branchOptions = useMemo(() => {
        const filteredBranches = branches.filter(
            (b) =>
                !filters.region ||
                regions.find((r) => r.id === filters.region)?.id === b.region_id
        );
        return [
            { value: "", label: "All Branches" },
            ...filteredBranches.map(b => ({ value: b.id, label: b.name }))
        ];
    }, [branches, filters.region, regions]);

    const officerOptions = useMemo(() => {
        return [
            { value: "", label: "All Officers" },
            ...loanOfficers.map(u => ({ value: u.id, label: u.full_name }))
        ];
    }, [loanOfficers]);

    const productOptions = useMemo(() => {
        return [
            { value: "", label: "All Products" },
            ...availableProducts.map(p => ({ value: p, label: p }))
        ];
    }, [availableProducts]);

    const dateRangeOptions = [
        { value: "all", label: "All Time" },
        { value: "today", label: "Today" },
        { value: "this_month", label: "This Month" },
        { value: "quarterly", label: "This Quarter" },
        { value: "yearly", label: "This Year" },
    ];

    const exportFormatOptions = [
        { value: "csv", label: "CSV" },
        { value: "excel", label: "Excel" },
        { value: "word", label: "Word" },
        { value: "pdf", label: "PDF" },
    ];

    return (
        <div className="min-h-screen bg-page p-5 md:p-8 space-y-6 font-outfit animate-fade-in">
            <div className="max-w-[1600px] mx-auto space-y-6">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted uppercase tracking-widest">
                      {tenant?.company_name || "Jasiri"}
                    </p>
                    <h1 className="text-2xl font-bold text-text-primary mt-0.5">RO Cumulative Performance Report</h1>
                    <p className="text-xs text-text-muted mt-1">Metrics compiled directly from underlying loan records.</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Refresh */}
                    <button
                        onClick={handleRefreshView}
                        disabled={refreshing}
                        className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing && 'animate-spin'}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>

                    {/* Filter Toggle */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                        showFilters
                          ? "bg-brand text-white border-brand shadow-sm"
                          : "bg-card text-text-secondary border-border hover:border-brand/50"
                      }`}
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {hasActiveFilters && (
                        <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                      )}
                    </button>

                    {/* Export Format select */}
                    <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                      <CustomSelect
                        options={exportFormatOptions}
                        value={exportFormat}
                        onChange={setExportFormat}
                        placeholder="Format"
                        compact
                      />
                      <button
                        onClick={handleExport}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <div className="bg-card border border-border rounded-xl shadow-card p-5 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-text-primary">Filter Results</h3>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-medium transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Clear all
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      {/* Search box */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          Search RO or Product
                        </label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                          <input
                            type="text"
                            placeholder="Search..."
                            value={filters.search}
                            onChange={e => handleFilterChange('search', e.target.value)}
                            className="w-full bg-card border border-border text-text-primary placeholder:text-muted rounded-lg pl-9 pr-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-brand focus:border-brand outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Region */}
                      {profile?.role !== "regional_manager" && profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            Region
                          </label>
                          <CustomSelect
                            options={regionOptions}
                            value={filters.region}
                            onChange={(val) => handleFilterChange("region", val)}
                            placeholder="All Regions"
                            compact
                            fullWidth
                          />
                        </div>
                      )}

                      {/* Branch */}
                      {profile?.role !== "branch_manager" && profile?.role !== "customer_service_officer" && profile?.role !== "relationship_officer" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            Branch
                          </label>
                          <CustomSelect
                            options={branchOptions}
                            value={filters.branch}
                            onChange={(val) => handleFilterChange("branch", val)}
                            placeholder="All Branches"
                            compact
                            fullWidth
                          />
                        </div>
                      )}

                      {/* Officer */}
                      {profile?.role !== "relationship_officer" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                            Officer
                          </label>
                          <CustomSelect
                            options={officerOptions}
                            value={filters.loanOfficer}
                            onChange={(val) => handleFilterChange("loanOfficer", val)}
                            placeholder="All Officers"
                            compact
                            fullWidth
                          />
                        </div>
                      )}

                      {/* Product */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          Product
                        </label>
                        <CustomSelect
                          options={productOptions}
                          value={filters.loanProduct}
                          onChange={(val) => handleFilterChange("loanProduct", val)}
                          placeholder="All Products"
                          compact
                          fullWidth
                        />
                      </div>

                      {/* Date Range */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          Date Range
                        </label>
                        <CustomSelect
                          options={dateRangeOptions}
                          value={filters.dateRange}
                          onChange={(val) => handleFilterChange("dateRange", val)}
                          placeholder="All Time"
                          compact
                          fullWidth
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                    <MetricCard title="Total Loans" value={kpis.loanCount} color="blue" icon={FileText} />
                    <MetricCard title="Principal Disbursed" value={formatCurrency(kpis.totalDisbursed)} color="emerald" icon={DollarSign} />
                    <MetricCard title="Total Payable" value={formatCurrency(kpis.totalPayable)} color="orange" icon={DollarSign} />
                    <MetricCard title="Total Paid" value={formatCurrency(kpis.totalPaid)} color="purple" icon={DollarSign} />
                    <MetricCard title="Arrears Total" value={formatCurrency(kpis.arrearsAmount)} subtitle={`${kpis.arrearsCount} loans`} color="red" icon={Activity} />
                    <MetricCard title="Repayment Rate" value={formatPercentage(overallPaymentRate)} color="amber" icon={BarChart2} />
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card p-5 rounded-xl border border-border shadow-card h-96">
                        <h3 className="font-bold text-text-primary mb-4 text-sm tracking-wide">Disbursement by Product</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={disbursementByProduct} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={entry => entry.name}>
                                    {disbursementByProduct.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ fontFamily: "Outfit, sans-serif", borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-card p-5 rounded-xl border border-border shadow-card h-96">
                        <h3 className="font-bold text-text-primary mb-4 text-sm tracking-wide">Top RO Performance (Disbursed vs Collected)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roRanking} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10, fontFamily: "Outfit, sans-serif", fill: "var(--color-text-muted)" }} />
                                <YAxis tickFormatter={(val) => `${val / 1000}k`} tick={{ fontSize: 10, fontFamily: "Outfit, sans-serif", fill: "var(--color-text-muted)" }} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ fontFamily: "Outfit, sans-serif", borderRadius: 8 }} />
                                <Legend wrapperStyle={{ fontFamily: "Outfit, sans-serif", fontSize: 12 }} />
                                <Bar dataKey="Disbursed" fill="#1A7A4A" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Collected" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Data Table */}
                {loading ? (
                    <SkeletonTable rows={10} cols={15} />
                ) : (
                    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-bold text-text-primary text-sm uppercase tracking-wider">Detailed Performance Table</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-surface border-b border-border text-xs font-bold text-text-muted uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3">RO Name</th>
                                        <th className="px-4 py-3">Region</th>
                                        <th className="px-4 py-3">Branch</th>
                                        <th className="px-4 py-3 text-right">Total Payable</th>
                                        <th className="px-4 py-3 text-right">Total Disbursed</th>
                                        <th className="px-4 py-3 text-right">Outstanding Balance</th>
                                        <th className="px-4 py-3 text-center">Loan Count</th>
                                        <th className="px-4 py-3 text-center">New Loans</th>
                                        <th className="px-4 py-3 text-center">Repeat Loans</th>
                                        <th className="px-4 py-3 text-right">Interest</th>
                                        <th className="px-4 py-3 text-right">Principal</th>
                                        <th className="px-4 py-3 text-right">Amount Paid</th>
                                        <th className="px-4 py-3 text-right">Amount in Arrears</th>
                                        <th className="px-4 py-3 text-center">Arrears Count</th>
                                        <th className="px-4 py-3 text-center">Payment Rate</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-light text-text-secondary text-sm">
                                    {pagination.currentData.map((row, i) => (
                                        <tr key={i} className="hover:bg-surface transition-colors duration-150">
                                            <td className="px-4 py-3 text-text-primary font-semibold">{row.officerName}</td>
                                            <td className="px-4 py-3">{row.regionName}</td>
                                            <td className="px-4 py-3">{row.branchName}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totalPayable)}</td>
                                            <td className="px-4 py-3 text-right text-brand font-semibold tabular-nums">{formatCurrency(row.totalDisbursed)}</td>
                                            <td className="px-4 py-3 text-right text-orange-600 font-semibold tabular-nums">{formatCurrency(row.outstandingBalance)}</td>
                                            <td className="px-4 py-3 text-center tabular-nums">{row.loanCount}</td>
                                            <td className="px-4 py-3 text-center text-blue-600 font-semibold tabular-nums">{row.newLoansCount}</td>
                                            <td className="px-4 py-3 text-center text-purple-600 font-semibold tabular-nums">{row.repeatLoansCount}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.totalInterest)}</td>
                                            <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.principalPayable)}</td>
                                            <td className="px-4 py-3 text-right text-indigo-600 font-semibold tabular-nums">{formatCurrency(row.totalPaid)}</td>
                                            <td className="px-4 py-3 text-right text-red-600 font-semibold tabular-nums">{formatCurrency(row.arrearsAmount)}</td>
                                            <td className="px-4 py-3 text-center text-red-600 font-semibold tabular-nums">{row.arrearsCount}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold w-16 ${row.paymentRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                    {formatPercentage(row.paymentRate)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {tableData.length === 0 && (
                                        <tr>
                                            <td colSpan="15" className="px-4 py-12 text-center text-text-muted italic font-medium">
                                                No performance data found for the selected filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                                <tfoot className="bg-surface font-bold text-xs uppercase tracking-wider text-text-muted border-t-2 border-border">
                                    <tr>
                                        <td colSpan="3" className="px-6 py-4 text-right">
                                            Overall Total ({tableData.length} officers):
                                        </td>
                                        <td className="px-4 py-4 text-right text-text-primary tabular-nums">
                                            {formatCurrency(tableData.reduce((sum, r) => sum + r.totalPayable, 0))}
                                        </td>
                                        <td className="px-4 py-4 text-right text-brand tabular-nums">
                                            {formatCurrency(kpis.totalDisbursed)}
                                        </td>
                                        <td className="px-4 py-4 text-right text-orange-600 tabular-nums">
                                            {formatCurrency(tableData.reduce((sum, r) => sum + r.outstandingBalance, 0))}
                                        </td>
                                        <td className="px-4 py-4 text-center tabular-nums">
                                            {kpis.loanCount}
                                        </td>
                                        <td className="px-4 py-4 text-center text-blue-600 tabular-nums">
                                            {tableData.reduce((sum, r) => sum + r.newLoansCount, 0)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-purple-600 tabular-nums">
                                            {tableData.reduce((sum, r) => sum + r.repeatLoansCount, 0)}
                                        </td>
                                        <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                                            {formatCurrency(tableData.reduce((sum, r) => sum + r.totalInterest, 0))}
                                        </td>
                                        <td className="px-4 py-4 text-right text-text-secondary tabular-nums">
                                            {formatCurrency(tableData.reduce((sum, r) => sum + r.principalPayable, 0))}
                                        </td>
                                        <td className="px-4 py-4 text-right text-indigo-600 tabular-nums">
                                            {formatCurrency(kpis.totalPaid)}
                                        </td>
                                        <td className="px-4 py-4 text-right text-red-600 tabular-nums">
                                            {formatCurrency(kpis.arrearsAmount)}
                                        </td>
                                        <td className="px-4 py-4 text-center text-red-600 tabular-nums">
                                            {kpis.arrearsCount}
                                        </td>
                                        <td className="px-4 py-4 text-center text-purple-700 font-bold tabular-nums">
                                            <span className={`px-2.5 py-0.5 rounded-full inline-block ${overallPaymentRate >= 90 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                {formatPercentage(overallPaymentRate)}
                                            </span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Pagination Component */}
                        {!loading && tableData.length > itemsPerPage && (
                            <Pagination
                                totalItems={tableData.length}
                                itemsPerPage={itemsPerPage}
                                currentPage={currentPage}
                                onPageChange={setCurrentPage}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ROCumulativePerformanceReport;


import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../supabaseClient';

export const useDisbursementStore = create(
  persist(
    (set, get) => ({
      // State
      disbursedLoans: [],
      filters: {
        search: "",
        branch: "",
        officer: "",
        product: "",
      },
      dateFilter: "all",
      customStartDate: "",
      customEndDate: "",
      exportFormat: "csv",
      showFilters: false,
      loading: true,
      currentPage: 1,
      itemsPerPage: 10,
      sortConfig: { key: null, direction: "asc" },
      lastFetchTime: null,

      // Actions
      setDisbursedLoans: (loans) => set({ disbursedLoans: loans }),
      
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters },
        currentPage: 1, // Reset to first page when filters change
      })),
      
      setDateFilter: (filter) => set({ dateFilter: filter, currentPage: 1 }),
      
      setCustomDateRange: (start, end) => set({
        customStartDate: start,
        customEndDate: end,
        currentPage: 1,
      }),
      
      setExportFormat: (format) => set({ exportFormat: format }),
      
      toggleFilters: () => set((state) => ({ showFilters: !state.showFilters })),
      
      setLoading: (loading) => set({ loading }),
      
      setCurrentPage: (page) => set({ currentPage: page }),
      
      setSortConfig: (key) => set((state) => ({
        sortConfig: {
          key,
          direction: state.sortConfig.key === key && state.sortConfig.direction === "asc" 
            ? "desc" 
            : "asc",
        },
      })),
      
      clearFilters: () => set({
        filters: {
          search: "",
          branch: "",
          officer: "",
          product: "",
        },
        dateFilter: "all",
        customStartDate: "",
        customEndDate: "",
        currentPage: 1,
      }),

      // Fetch data with caching (5 minutes)
      fetchDisbursedLoans: async (forceRefresh = false) => {
        const { lastFetchTime } = get();
        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        // Use cached data if available and not expired
        if (!forceRefresh && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
          console.log('Using cached data');
          return;
        }

        try {
          set({ loading: true });
          console.log('Fetching fresh data from Supabase...');

          const { data, error } = await supabase
            .from("loans")
            .select(`
              id,
              scored_amount,
              total_interest,
              total_payable,
              product_name,
              product_type,
              disbursed_at,
              repayment_state,
              status,
              branch:branch_id(name),
              loan_officer:booked_by(full_name),
              customer:customer_id(
                id,
                Firstname,
                Middlename,
                Surname,
                mobile,
                id_number,
                business_name,
                business_type
              ),
              installments:loan_installments(
                due_date,
                status,
                loan_id
              ),
              mpesa:mpesa_b2c_transactions(
                transaction_id,
                loan_id,
                status
              )
            `)
            .eq("status", "disbursed")
            .order("disbursed_at", { ascending: false });

          if (error) throw error;

          const formatted = data.map((loan) => {
            const customer = loan.customer || {};
            const fullName = [customer.Firstname, customer.Middlename, customer.Surname]
              .filter(Boolean)
              .join(" ") || "N/A";

            const pendingInstallment = Array.isArray(loan.installments)
              ? loan.installments.find((inst) => inst.status === "pending")
              : null;
            const nextPaymentDate = pendingInstallment?.due_date
              ? new Date(pendingInstallment.due_date).toLocaleDateString()
              : "N/A";

            const mpesaTx = Array.isArray(loan.mpesa) && loan.mpesa.length > 0
              ? loan.mpesa.find((tx) => tx.status === "success")
              : null;
            const mpesaReference = mpesaTx?.transaction_id || "N/A";

            return {
              id: loan.id,
              branch: loan.branch?.name || "N/A",
              loanOfficer: loan.loan_officer?.full_name || "N/A",
              customerName: fullName,
              mobile: customer.mobile || "N/A",
              idNumber: customer.id_number || "N/A",
              mpesaReference,
              loanNumber: `LN${String(loan.id).padStart(5, "0")}`,
              loanReferenceNumber: `LN${String(loan.id).padStart(5, "0")}`,
              appliedLoanAmount: loan.scored_amount ?? 0,
              disbursedAmount: loan.total_payable ?? 0,
              interestAmount: loan.total_interest || 0,
              business_name: customer.business_name || "N/A",
              business_type: customer.business_type || "N/A",
              productName: loan.product_type || "N/A",
              product_type: loan.product_type || "N/A",
              nextPaymentDate,
              disbursementDate: loan.disbursed_at
                ? new Date(loan.disbursed_at).toLocaleString()
                : "N/A",
              rawDisbursementDate: loan.disbursed_at,
              repaymentStatus: loan.repayment_state || "N/A",
            };
          });

          // Group by branch and officer
          const grouped = [];
          let branchCounter = 1;
          const branches = [...new Set(formatted.map((l) => l.branch))];

          for (const branch of branches) {
            const branchLoans = formatted.filter((l) => l.branch === branch);
            const branchTotal = branchLoans.reduce(
              (sum, l) => sum + (l.disbursedAmount || 0),
              0
            );

            const officers = [...new Set(branchLoans.map((l) => l.loanOfficer))];

            for (const officer of officers) {
              const officerLoans = branchLoans.filter(
                (l) => l.loanOfficer === officer
              );
              const officerTotal = officerLoans.reduce(
                (sum, l) => sum + (l.disbursedAmount || 0),
                0
              );

              officerLoans.forEach((loan, index) => {
                grouped.push({
                  ...loan,
                  branchNumber: branchCounter,
                  branch,
                  loanOfficer: officer,
                  branchTotalAmount: branchTotal,
                  roTotalAmount: officerTotal,
                  isFirstInBranch: index === 0 && officers.indexOf(officer) === 0,
                  isFirstInOfficer: index === 0,
                });
              });
            }
            branchCounter++;
          }

          set({ 
            disbursedLoans: grouped,
            lastFetchTime: now,
            loading: false 
          });
        } catch (err) {
          console.error('Error fetching disbursed loans:', err);
          set({ loading: false });
        }
      },
    }),
    {
      name: 'disbursement-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields
        filters: state.filters,
        dateFilter: state.dateFilter,
        customStartDate: state.customStartDate,
        customEndDate: state.customEndDate,
        exportFormat: state.exportFormat,
        showFilters: state.showFilters,
        currentPage: state.currentPage,
        sortConfig: state.sortConfig,
        disbursedLoans: state.disbursedLoans,
        lastFetchTime: state.lastFetchTime,
      }),
    }
  )
);

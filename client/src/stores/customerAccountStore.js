import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../supabaseClient';

export const useCustomerAccountStore = create(
  persist(
    (set, get) => ({
      
      customerAccountData: [],
      branches: [],
      filters: {
        customerQuery: "",
        branch: "",
        status: "",
        startDate: "",
        endDate: "",
      },
      showFilters: false,
      loading: false,
      sortConfig: { key: null, direction: "asc" },
      currentPage: 1,
      itemsPerPage: 10,
      lastFetchTime: null,

      // Actions
      setCustomerAccountData: (data) => set({ customerAccountData: data }),
      
      setBranches: (branches) => set({ branches }),
      
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters },
        currentPage: 1,
      })),
      
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
          customerQuery: "",
          branch: "",
          status: "",
          startDate: "",
          endDate: "",
        },
        currentPage: 1,
      }),

      // Fetch branches
      fetchBranches: async () => {
        try {
          const { data, error } = await supabase.from("branches").select("id, name");
          if (!error) {
            set({ branches: data || [] });
          }
        } catch (err) {
          console.error('Error fetching branches:', err);
        }
      },

      // Fetch customer accounts with caching
      fetchCustomerAccounts: async (forceRefresh = false) => {
        const { lastFetchTime } = get();
        const now = Date.now();
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (!forceRefresh && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
          console.log('Using cached customer data');
          return;
        }

        try {
          set({ loading: true });

          const { data: loans, error } = await supabase
            .from("loans")
            .select(`
              id,
              scored_amount,
              total_interest,
              total_payable,
              status,
              disbursed_date,
              customer:customer_id(
                id,
                "Firstname",
                "Middlename",
                "Surname",
                mobile,
                branch:branch_id(name)
              ),
              installments:loan_installments(
                paid_amount
              )
            `);

          if (error) throw error;

          const customerSummary = {};

          loans.forEach((loan) => {
            const cust = loan.customer || {};
            const custId = cust.id;
            const fullName = [cust.Firstname, cust.Middlename, cust.Surname]
              .filter(Boolean)
              .join(" ");

            const totalPaid = loan.installments?.reduce(
              (sum, i) => sum + (i.paid_amount || 0),
              0
            );

            const outstanding = (loan.total_payable || 0) - totalPaid > 0
              ? (loan.total_payable || 0) - totalPaid
              : 0;

            if (!customerSummary[custId]) {
              customerSummary[custId] = {
                customerId: custId,
                customerName: fullName || "N/A",
                phone: cust.mobile || "N/A",
                branch: cust.branch?.name || "N/A",
                totalLoanApplied: 0,
                loanAmount: 0,
                interest: 0,
                totalPayable: 0,
                totalPaid: 0,
                outstanding: 0,
                latestDisbursed: loan.disbursed_date,
                status: "Active",
              };
            }

            const custRec = customerSummary[custId];
            custRec.totalLoanApplied += loan.scored_amount || 0;
            custRec.loanAmount += loan.scored_amount || 0;
            custRec.interest += loan.total_interest || 0;
            custRec.totalPayable += loan.total_payable || 0;
            custRec.totalPaid += totalPaid;
            custRec.outstanding += outstanding;
          });

          const formatted = Object.values(customerSummary).map((c) => ({
            ...c,
            status: c.outstanding === 0 ? "Closed" : "Active",
          }));

          set({
            customerAccountData: formatted,
            lastFetchTime: now,
            loading: false,
          });
        } catch (err) {
          console.error('Error fetching customer accounts:', err);
          set({ loading: false });
        }
      },
    }),
    {
      name: 'customer-account-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        filters: state.filters,
        showFilters: state.showFilters,
        currentPage: state.currentPage,
        sortConfig: state.sortConfig,
        customerAccountData: state.customerAccountData,
        branches: state.branches,
        lastFetchTime: state.lastFetchTime,
      }),
    }
  )
);
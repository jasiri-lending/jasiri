import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../hooks/userAuth";
import {
  BanknotesIcon,
  ClockIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

const OfficerDashboard = () => {
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalLeads: 0,
      totalCustomers: 0,
      totalLoans: 0,
      conversionRate: 0,
      activeLeads: { hot: 0, warm: 0, cold: 0 },
    },
    recentActivity: [],
    fullName: "",
    isLoading: true,
    error: null,
  });

  const { profile } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  //  Fetch user full name directly from "users" table
  const fetchUserFullName = useCallback(async () => {
    if (!profile?.id) return "";

    const { data, error } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", profile.id)
      .single();

    if (error) {
      console.error("Error fetching user full_name:", error);
      return "";
    }
    return data?.full_name || "";
  }, [profile]);

  //  Fetch all dashboard data

  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    if (!profile?.id || profile.role !== "relationship_officer") return;

    // Try reading cached data if no forced refresh
    if (!forceRefresh) {
      const cached = sessionStorage.getItem("dashboardData");
      if (cached) {
        const parsed = JSON.parse(cached);
        setDashboardData({
          ...parsed,
          isLoading: false,
          error: null,
        });
        return; // ✅ Stop here — use cached data
      }
    }

    try {
      setDashboardData((prev) => ({ ...prev, isLoading: true, error: null }));

      const [leadsResponse, customersResponse, loansResponse, fullName] =
        await Promise.all([
          supabase.from("leads").select("*").eq("created_by", profile.id),
          supabase.from("customers").select("*").eq("created_by", profile.id),
          supabase
            .from("loans")
            .select(
              `
            *,
            customer:customers!customer_id (
              Firstname,
              Surname,
              mobile
            ),
            booked_by_user:users!loans_created_by_fkey (
              full_name,
              email
            )
          `
            )
            .eq("booked_by", profile.id),
          fetchUserFullName(),
        ]);

      if (leadsResponse.error) throw leadsResponse.error;
      if (customersResponse.error) throw customersResponse.error;
      if (loansResponse.error) throw loansResponse.error;

      const leadsData = leadsResponse.data || [];
      const customersData = customersResponse.data || [];
      const loansData = loansResponse.data || [];

      const leadStats = leadsData.reduce(
        (acc, lead) => {
          const status = lead.status?.toLowerCase() || "cold";
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        { hot: 0, warm: 0, cold: 0 }
      );

      const totalInteractions = leadsData.length + customersData.length;
      const conversionRate =
        totalInteractions > 0
          ? (customersData.length / totalInteractions) * 100
          : 0;

      const recentLeads = leadsData
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map((lead) => ({
          id: lead.id,
          type: "lead",
          full_name:
            `${lead.Firstname || ""} ${lead.Surname || ""}`.trim() || "Unknown",
          created_at: new Date(lead.created_at),
        }));

      const recentCustomers = customersData
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 4)
        .map((cust) => ({
          id: cust.id,
          type: "customer",
          full_name:
            `${cust.Firstname || ""} ${cust.Surname || ""}`.trim() || "Unknown",
          created_at: new Date(cust.created_at),
        }));

      const recentLoans = loansData
        .sort(
          (a, b) =>
            new Date(b.booked_at || b.created_at) -
            new Date(a.booked_at || a.created_at)
        )
        .slice(0, 4)
        .map((loan) => ({
          id: loan.id,
          type: "loan",
          full_name: loan.customer
            ? `${loan.customer.Firstname || ""} ${loan.customer.Surname || ""}`.trim()
            : "Unknown Customer",
          amount: loan.scored_amount,
          created_at: loan.booked_at ? new Date(loan.booked_at) : new Date(),
        }));

      const allRecentActivity = [...recentLeads, ...recentCustomers, ...recentLoans]
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, 5);

      const updatedData = {
        stats: {
          totalLeads: leadsData.length,
          totalCustomers: customersData.length,
          totalLoans: loansData.length,
          conversionRate: parseFloat(conversionRate.toFixed(1)),
          activeLeads: leadStats,
        },
        recentActivity: allRecentActivity,
        fullName: fullName || "Officer",
        isLoading: false,
        error: null,
      };

      setDashboardData(updatedData);

      // ✅ Cache the latest data for this user
      sessionStorage.setItem("dashboardData", JSON.stringify(updatedData));
    } catch (error) {
      console.error("Dashboard Error:", error);
      setDashboardData((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to load dashboard data.",
      }));
    }
  }, [profile, fetchUserFullName]);

  // 🔹 On mount, load cached or fetch new data
  useEffect(() => {
    if (profile) fetchDashboardData();
  }, [profile, fetchDashboardData]);


  useEffect(() => {
    if (profile) fetchDashboardData();
  }, [profile, fetchDashboardData]);

  const { stats, recentActivity, fullName, isLoading, error } = dashboardData;

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday
      ? `Today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading)
    return (
      <div className="flex flex-col justify-center items-center h-80 text-text">
        <div className="animate-spin w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full"></div>
        <p className="mt-3 text-sm text-muted">Loading dashboard...</p>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-red-700 shadow-sm">
        <p className="font-semibold mb-1">Error loading dashboard</p>
        <p className="text-sm mb-3">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );

  // ========== MAIN DASHBOARD ========== //
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-brand-surface p-8 rounded-2xl shadow-sm border border-brand-secondary">
        <div>
          <h1 className="text-2xl font-bold text-text">
            {getGreeting()}, <span className="text-brand-primary">{fullName}</span>
          </h1>
          <p className="text-muted text-sm mt-1">
            Here’s your current performance summary.
          </p>
        </div>
        <div className="text-xs text-muted font-medium bg-white px-3 py-1.5 rounded-full shadow-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Total Leads", value: stats.totalLeads, color: "blue" },
          { title: "Total Customers", value: stats.totalCustomers, color: "green" },
          { title: "Loans Booked", value: stats.totalLoans, color: "purple" },
          { title: "Conversion Rate", value: `${stats.conversionRate}%`, color: "orange" },
        ].map((card, i) => (
          <div
            key={i}
            className={`bg-white p-6 rounded-lg shadow border-t-4 border-${card.color}-500`}
          >
            <p className="text-sm font-medium text-gray-600">{card.title}</p>
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Chart */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold mb-6 text-gray-900">Conversion Rate</h2>
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 36 36">
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#eee"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#586ab1"
                strokeWidth="3"
                strokeDasharray={`${stats.conversionRate}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-3xl font-bold text-brand-primary">
              {stats.conversionRate}%
            </span>
          </div>
          <p className="mt-4 text-sm text-gray-600 text-center">
            Lead-to-Customer Conversion
          </p>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
              {recentActivity.length} updates
            </span>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <ClockIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No recent activity yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between border border-gray-100 rounded-lg p-3 shadow-sm hover:bg-gray-50 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-2 rounded-full ${item.type === "loan"
                          ? "bg-purple-100 text-purple-600"
                          : item.type === "customer"
                            ? "bg-green-100 text-green-600"
                            : "bg-blue-100 text-blue-600"
                        }`}
                    >
                      {item.type === "loan" ? (
                        <BanknotesIcon className="h-5 w-5" />
                      ) : (
                        <UserPlusIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {item.full_name}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {item.type === "loan"
                          ? `Loan booked - Ksh ${item.amount?.toLocaleString()}`
                          : item.type === "customer"
                            ? "New customer added"
                            : "Lead created"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfficerDashboard;

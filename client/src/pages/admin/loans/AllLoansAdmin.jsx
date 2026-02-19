// src/components/AllLoansAdmin.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import { useAuth } from "../../../hooks/userAuth";
import {
  CurrencyDollarIcon,
  CalendarIcon,
  ClockIcon,
  XCircleIcon,
  BanknotesIcon,
  EyeIcon,
  FunnelIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";
import ViewLoan from "./ViewLoanAdmin";

const AllLoansAdmin = () => {
  const { profile } = useAuth();
  const [loans, setLoans] = useState([]);
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchRegions();
      fetchBranches();
      fetchLoans();
    }
  }, [profile]);

  useEffect(() => {
    filterLoans();
  }, [loans, statusFilter, branchFilter, regionFilter, searchTerm]);

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from("regions")
        .select("id, name")
        .eq("tenant_id", profile?.tenant_id);
      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      console.error("Error fetching regions:", error);
    }
  };

  const fetchBranches = async () => {
    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, region_id")
        .eq("tenant_id", profile?.tenant_id)
        .order("name");
      if (error) throw error;
      setBranches(data || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchLoans = async () => {
    try {
      const { data, error } = await supabase
        .from("loans")
        .select(
          `
          *,
          customers (
            Firstname,
            Surname,
            mobile,
            id_number,
            branches (
              id,
              name,
              region_id,
              regions (
                id,
                name
              )
            )
          )
        `
        )
        .eq("tenant_id", profile?.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (error) {
      console.error("Error fetching loans:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterLoans = () => {
    let filtered = loans;

    if (statusFilter !== "all") {
      filtered = filtered.filter((loan) => loan.status === statusFilter);
    }

    if (regionFilter !== "all") {
      filtered = filtered.filter(
        (loan) => loan.customers?.branches?.region_id === regionFilter
      );
    }

    if (branchFilter !== "all") {
      filtered = filtered.filter(
        (loan) => loan.customers?.branches?.id === branchFilter
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (loan) =>
          loan.customers?.Firstname?.toLowerCase().includes(
            searchTerm.toLowerCase()
          ) ||
          loan.customers?.Surname?.toLowerCase().includes(
            searchTerm.toLowerCase()
          ) ||
          loan.customers?.mobile?.includes(searchTerm) ||
          loan.id?.toString().includes(searchTerm)
      );
    }

    setFilteredLoans(filtered);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "booked":
        return <ClockIcon className="h-5 w-5 text-amber-600" />;
      case "bm_review":
        return <ClockIcon className="h-5 w-5 text-orange-600" />;
      case "rm_review":
        return <ClockIcon className="h-5 w-5 text-blue-600" />;
      case "ca_review":
        return <ClockIcon className="h-5 w-5 text-purple-600" />;
      case "disbursed":
        return <BanknotesIcon className="h-5 w-5 text-emerald-600" />;
      case "rejected":
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      booked: "bg-amber-100 text-amber-800 border-amber-200",
      bm_review: "bg-orange-100 text-orange-800 border-orange-200",
      rm_review: "bg-blue-100 text-blue-800 border-blue-200",
      ca_review: "bg-purple-100 text-purple-800 border-purple-200",
      disbursed: "bg-emerald-100 text-emerald-800 border-emerald-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const statusCounts = {
    all: loans.length,
    booked: loans.filter((l) => l.status === "booked").length,
    bm_review: loans.filter((l) => l.status === "bm_review").length,
    rm_review: loans.filter((l) => l.status === "rm_review").length,
    ca_review: loans.filter((l) => l.status === "ca_review").length,
    disbursed: loans.filter((l) => l.status === "disbursed").length,
    rejected: loans.filter((l) => l.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading loans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-indigo-700">
              All Loans (Super Admin)
            </h1>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 border border-indigo-200">
              <CurrencyDollarIcon className="h-5 w-5 text-indigo-600" />
              <span className="font-medium text-indigo-700">
                {filteredLoans.length} Loans
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-indigo-100">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by customer name, mobile, or loan ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="p-3 border border-gray-300 rounded-lg"
            >
              <option value="all">All Regions</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>

            {/* Branch Filter */}
            <div className="flex items-center gap-2">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg"
              >
                <option value="all">All Branches</option>
                {branches
                  .filter(
                    (b) => regionFilter === "all" || b.region_id === regionFilter
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-3 border border-gray-300 rounded-lg"
              >
                <option value="all">All Status ({statusCounts.all})</option>
                <option value="booked">Booked ({statusCounts.booked})</option>
                <option value="bm_review">
                  Pending Branch Manager ({statusCounts.bm_review})
                </option>
                <option value="rm_review">
                  Pending Regional Manager ({statusCounts.rm_review})
                </option>
                <option value="ca_review">
                  Pending Disbursement ({statusCounts.ca_review})
                </option>
                <option value="disbursed">
                  Disbursed ({statusCounts.disbursed})
                </option>
                <option value="rejected">
                  Rejected ({statusCounts.rejected})
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm">
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Customer</th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">ID Number</th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Phone</th>
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap">Branch</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Product</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Amount</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Weeks</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Date</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 text-sm">
              {filteredLoans.map((loan, index) => (
                <tr
                  key={loan.id}
                  className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"
                    } hover:bg-indigo-50 transition-colors`}
                >
                  <td className="px-3 py-3 whitespace-nowrap">
                    {loan.customers?.Firstname} {loan.customers?.Surname}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{loan.customers?.id_number}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{loan.customers?.mobile}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{loan.branches?.branch_name}</td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">{loan.product_name || loan.product}</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                    KES {loan.scored_amount?.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      {loan.duration_weeks}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(
                        loan.status
                      )}`}
                    >
                      {getStatusIcon(loan.status)}
                      <span className="whitespace-nowrap">{loan.status.replace(/_/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center text-gray-600">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {new Date(loan.created_at).toLocaleDateString("en-GB")}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLoan(loan)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg text-sm font-semibold"
                    >
                      <EyeIcon className="h-4 w-4" />
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredLoans.length === 0 && (
            <div className="text-center py-12">
              <ClockIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">
                No loans found
              </h3>
              <p className="text-gray-600">
                Try adjusting your filters or search criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {selectedLoan && (
        <ViewLoan loan={selectedLoan} onClose={() => setSelectedLoan(null)} />
      )}
    </div>
  );
};

export default AllLoansAdmin;

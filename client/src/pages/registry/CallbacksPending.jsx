import React, { useState, useEffect } from 'react';
import { useAuth } from "../../hooks/userAuth";
import { 
  MagnifyingGlassIcon, 
  EyeIcon,
  CheckIcon,
  
  ClockIcon,
  UserIcon,
  PhoneIcon,
 
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";
import ViewCustomer from './ViewCustomer';
import Verification from './Verification';
import { useNavigate } from 'react-router-dom';

const CallbackPending = () => {
  const [customers, setCustomers] = useState([]);
  const { profile } = useAuth();
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  

   const navigate = useNavigate(); 

const fetchPendingCustomers = async () => {
  if (!profile?.region) {
    console.warn("No region in profile yet, skipping fetch");
    return;
  }

  setLoading(true);
  try {
    const { data, error } = await supabase
      .from("customers")
      .select(`
        *,
        customer_verifications(*)
      `)
      .eq("status", "cso_review")
     .eq("region_id", profile.region_id); 

    if (error) {
      console.error("Error fetching pending customers:", error.message);
    } else {
      const enriched = (data || []).map((c) => {
        const bmVerification =
          c.customer_verifications?.find((v) => v.role === "bm") || null;
        return {
          ...c,
          bm_verification: bmVerification,
        };
      });
      setCustomers(enriched);
      setFilteredCustomers(enriched);
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  if (profile) {
    console.log("Profile loaded:", profile);
    fetchPendingCustomers();
  }
}, [profile]);



  // Search functionality
  useEffect(() => {
    if (!customers || customers.length === 0) return;
    
    const filtered = customers.filter(customer =>
      (customer.first_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.last_name?.toLowerCase() || customer.surname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (customer.id_number?.toString() || customer.national_id?.toString() || '').includes(searchTerm.toLowerCase()) ||
      (customer.mobile || customer.phone_number || customer.phone || '').includes(searchTerm)
    );
    setFilteredCustomers(filtered);
  }, [searchTerm, customers]);

const handleApprove = (customerId) => {
  navigate(`/customer/${customerId}/verify-customer_service_officer`);
};


  const handleView = (customer) => {
    navigate(`/customer/${customer.id}/details`);
  };

  return (
  <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 p-8">
  <div className="max-w-7xl mx-auto">
    {/* Header */}
    <div className="mb-10">
      <div className="flex items-center justify-between">
        <div>
         
        
           
          
          <p className="text-gray-600 mt-2 text-sm">
            Customers awaiting approval ({filteredCustomers.length})
          </p>
        </div>
      </div>
    </div>

    {/* Search Bar */}
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 mb-8">
      <div className="relative">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by first name, surname, ID number, or mobile..."
          className="w-full pl-12 pr-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-gray-400"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
    </div>

    {/* Table */}
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["ID Number", "First Name", "Surname", "Prequalified Amount", "Mobile", "Actions"].map((head) => (
                <th
                  key={head}
                  className="px-6 py-4 text-left text-sm font-semibold text-gray-700 tracking-wide"
                >
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-500 text-sm">Loading customers...</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="font-medium text-gray-900">
                          {customer.id_number || customer.national_id || "N/A"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {customer.Firstname || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-800">
                    {customer.Surname || "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 text-sm font-semibold text-green-700 bg-green-50 rounded-lg">
                      {customer.prequalifiedAmount
                        ? `KES ${Number(customer.prequalifiedAmount).toLocaleString()}`
                        : "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center text-sm text-gray-700">
                      <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                      {customer.mobile || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleView(customer)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-all"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4 mr-1" />
                        View
                      </button>
                      <button
                        onClick={() => handleApprove(customer.id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-all"
                        title="Approve Customer"
                      >
                        <CheckIcon className="w-4 h-4 mr-1" />
                        Approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredCustomers.length === 0 && (
        <div className="text-center py-16">
          <ClockIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No pending approvals</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm
              ? "No customers match your search criteria."
              : "All customers have been processed."}
          </p>
        </div>
      )}
    </div>
  </div>

 
</div>

  );
};

export default CallbackPending;
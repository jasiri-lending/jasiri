import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import CustomersTable from "./components/CustomerTable";
import CustomerDetailsModal from "./components/CustomerDetailsModal.jsx";
import EditCustomer from "./components/EditCustomer.jsx";
import { useAuth } from "../hooks/userAuth.js";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [viewCustomer, setViewCustomer] = useState(null);
  const [userId, setUserId] = useState(null);
  const { profile } = useAuth();

  //  Get logged-in user's ID
  const fetchUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) console.error("Error fetching user:", error.message);
    else setUserId(user.id);
  };

  //  Fetch customers created by the logged-in Relationship Officer
  const fetchCustomers = async () => {
    if (!userId) return; // wait until userId is set
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("created_by", userId)
       .eq("form_status", "submitted") 
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching customers:", error.message);
    else setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (userId) fetchCustomers();
  }, [userId]);

  // Fetch single customer details + related tables
  const fetchCustomerDetails = async (id) => {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (customerError) {
      console.error("Error fetching customer:", customerError.message);
      return;
    }

    const { data: guarantors } = await supabase
      .from("guarantors")
      .select("*")
      .eq("customer_id", id);

    const { data: nextOfKin } = await supabase
      .from("next_of_kin")
      .select("*")
      .eq("customer_id", id);

    const { data: borrower_security } = await supabase
      .from("borrower_security")
      .select("*")
      .eq("customer_id", id);

    const { data: guarantor_security } = await supabase
      .from("guarantor_security")
      .select("*")
      .eq("customer_id", id);

    setViewCustomer({
      ...customer,
      guarantors: guarantors || [],
      nextOfKin: nextOfKin || [],
      borrowerSecurity: borrower_security || [],
      guarantorSecurity: guarantor_security || [],
    });
  };

  return (
    <div className="p-6">
      {/* Customers Table */}
      <CustomersTable
        customers={customers}
        loading={loading}
        onEdit={(c) => {
          setEditCustomer(c.id);
          setShowForm(true);
        }}
        onView={fetchCustomerDetails}
          profile={profile} 
      />

      {/* Edit Customer Modal */}
      {showForm && (
        <EditCustomer
          customerId={editCustomer}
          onClose={() => {
            setShowForm(false);
            fetchCustomers();
          }}
        />
      )}

      {/* View Customer Modal */}
      {viewCustomer && (
        <CustomerDetailsModal
          customer={viewCustomer}
          onClose={() => setViewCustomer(null)}
        />
      )}
    </div>
  );
}

export default Customers;

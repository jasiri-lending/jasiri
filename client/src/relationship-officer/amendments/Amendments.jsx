import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import AmendmentsTable from "./AmendmentsTable";
import EditAmendment from "./EditAmendment";
import { useAuth } from "../../hooks/userAuth";

function Amendments() {
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookLoan, setBookLoan] = useState(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const fetchAmendments = async () => {
    if (!profile?.id || profile.role !== "relationship_officer") {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // First, fetch customers with the required statuses
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")
        .eq("created_by", profile.id)
        .in("status", ["sent_back_by_bm", "sent_back_by_ca", "sent_back_by_cso", "pending"])
        .neq("form_status", "draft")
        .order("updated_at", { ascending: false });

      if (customersError) {
        console.error("Error fetching customers:", customersError.message);
        setAmendments([]);
        return;
      }

      console.log("Customers with required statuses:", customers);

      if (!customers || customers.length === 0) {
        console.log("No customers found with the required statuses");
        setAmendments([]);
        return;
      }

      // Extract customer IDs
      const customerIds = customers.map(customer => customer.id);

      // Fetch ALL customer verifications for these customers
      const { data: verifications, error: verificationsError } = await supabase
        .from("customer_verifications")
        .select("*")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: true });

      if (verificationsError) {
        console.error("Error fetching verifications:", verificationsError.message);
        setAmendments([]);
        return;
      }

      console.log("All verification records:", verifications);

      // Create merged data for each customer
      const mergedData = [];

      customers.forEach(customer => {
        // Get all verification records for this customer
        const customerVerifications = verifications.filter(v => v.customer_id === customer.id);
        
        if (customerVerifications.length === 0) {
          // No verifications exist
          mergedData.push({
            id: null,
            customer_id: customer.id,
            customers: customer,
            customer_data: customer,
            verification_status: null,
            verification_notes: null,
            created_at: customer.created_at,
            updated_at: customer.updated_at
          });
        } else {
          // Merge all verification records into one comprehensive object
          const mergedVerification = customerVerifications.reduce((acc, verification) => {
            // Merge strategy: Keep non-null values from all records
            Object.keys(verification).forEach(key => {
              if (verification[key] !== null && verification[key] !== undefined) {
                // For timestamp fields, keep the latest
                if (key.includes('_at') && acc[key]) {
                  const newDate = new Date(verification[key]);
                  const existingDate = new Date(acc[key]);
                  if (newDate > existingDate) {
                    acc[key] = verification[key];
                  }
                } else {
                  acc[key] = verification[key];
                }
              }
            });
            return acc;
          }, {});

          // Use the latest record's ID and ensure all fields are included
          const latestVerification = customerVerifications[customerVerifications.length - 1];
          mergedVerification.id = latestVerification.id;
          mergedVerification.customer_id = customer.id;
          mergedVerification.customers = customer;
          mergedVerification.customer_data = customer;
          
          // Ensure we have created_at and updated_at
          if (!mergedVerification.created_at) {
            mergedVerification.created_at = latestVerification.created_at;
          }
          if (!mergedVerification.updated_at) {
            mergedVerification.updated_at = latestVerification.updated_at;
          }

          mergedData.push(mergedVerification);
        }
      });

      console.log("Merged amendments data:", mergedData);
      setAmendments(mergedData);

    } catch (err) {
      console.error("Unexpected error fetching amendments:", err);
      setAmendments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchAmendments();
    }
  }, [profile]);

  const handleEdit = (amendment) => {
    const customerId = amendment.customer_id || amendment.customers?.id;
    console.log("Opening edit for customer ID:", customerId);
    if (customerId) {
      setEditingCustomerId(customerId);
    } else {
      console.error("No customer ID found in amendment");
    }
  };

  const handleCloseEdit = () => {
    setEditingCustomerId(null);
    fetchAmendments(); // Refresh the list after editing
  };

  const handleView = (amendment) => {
    if (amendment.id) {
      navigate(`/officer/viewamendments/${amendment.id}`);
    } else {
      console.log("No verification ID available for this amendment");
      // You might want to show a toast message here
    }
  };

  // If editing, show the EditAmendment component
  if (editingCustomerId) {
    return <EditAmendment customerId={editingCustomerId} onClose={handleCloseEdit} />;
  }

  return (
    <div className="p-6">
      {/* Table */}
      <AmendmentsTable
        amendments={amendments}
        loading={loading}
        onEdit={handleEdit}
        onView={handleView}
        onBookLoan={(a) => setBookLoan(a)}
        onRefresh={fetchAmendments}
      />

      {/* Loan Booking (keep as modal for now) */}
      {bookLoan && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <LoanBookingForm
            amendment={bookLoan}
            onComplete={() => {
              setBookLoan(null);
              fetchAmendments();
            }}
          />
        </div>
      )}
    </div>
  );
}

export default Amendments;
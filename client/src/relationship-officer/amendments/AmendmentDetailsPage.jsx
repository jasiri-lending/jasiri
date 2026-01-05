import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import AmendmentDetailsModal from "./AmendmentDetailsModal";
import Spinner from "../../components/Spinner";

export default function AmendmentDetailsPage() {
  const { amendmentId } = useParams();
  const navigate = useNavigate();
  const [amendment, setAmendment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAmendment = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("customer_verifications")
          .select(`
            *,
            customers(*)
          `)
          .eq("id", amendmentId)
          .single();

        if (error) throw error;
        setAmendment(data);
      } catch (err) {
        console.error("Error fetching amendment:", err.message);
      } finally {
        setLoading(false);
      }
    };

    if (amendmentId) fetchAmendment();
  }, [amendmentId]);

  if (loading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6 min-h-screen flex items-center justify-center ">
        <Spinner text="Loading ..." />
      </div>
    );
  }

  if (!amendment) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Amendment not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <AmendmentDetailsModal
        amendment={amendment}
        onClose={() => navigate(-1)}
      />
    </div>
  );
}

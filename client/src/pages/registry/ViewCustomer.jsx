import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  DocumentMagnifyingGlassIcon,
  UserCircleIcon,
  IdentificationIcon,
  HomeIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  BuildingOffice2Icon,
  PhotoIcon,
  DevicePhoneMobileIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  BriefcaseIcon,
  XCircleIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CameraIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "../../hooks/userAuth";

const ViewCustomer = ({ customer: initialCustomer, onClose }) => {
  const [customer, setCustomer] = useState(initialCustomer);
  const [guarantors, setGuarantors] = useState([]);
  const [securityItems, setSecurityItems] = useState([]);
  const [guarantorSecurityItems, setGuarantorSecurityItems] = useState([]);
  const [loanDetails, setLoanDetails] = useState(null);
  const [businessImages, setBusinessImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [nextOfKin, setNextOfKin] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [existingImages, setExistingImages] = useState({});
  const [formData, setFormData] = useState({ documents: [] });

  const { profile } = useAuth();

  useEffect(() => {
    if (initialCustomer?.id && profile?.region_id) {
      fetchCustomerDetails(initialCustomer.id);
    }
    //  Only run when prop `initialCustomer` or `profile.region_id` changes
  }, [initialCustomer?.id, profile?.region_id]);

const fetchCustomerDetails = async (customerId) => {
  try {
    setLoading(true);

    if (!profile?.region_id) {
      console.error("No region_id found for this RM profile");
      toast.error("Profile not loaded. Please try again.");
      return;
    }

    // Fetch main customer record
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select(
        `
          *,
          customer_verifications!inner (
            bm_loan_scored_amount
          )
        `
      )
      .eq("id", customerId)
      .eq("region_id", profile.region_id)
      .single();

    if (customerError) {
      console.error("Error fetching customer:", customerError);
      toast.error("Error loading customer details");
      return;
    }

    console.log("Customer Data from Supabase:", customerData);
    console.log("prequalifiedAmount from DB:", customerData.prequalifiedAmount);
    console.log(
      "BM scored amount from DB:",
      customerData.customer_verifications?.[0]?.bm_loan_scored_amount
    );

    setCustomer(customerData);

    // Set loan details ONCE with the correct data
    setLoanDetails({
      prequalifiedAmount: customerData.prequalifiedAmount,
      bm_loan_scored_amount:
        customerData.customer_verifications?.[0]?.bm_loan_scored_amount || null,
    });

    // Fetch related data in parallel (remove loans from this query since we don't need it)
    const [
      { data: nextOfKinData },
      { data: documentsData },
      { data: businessImagesData },
      { data: guarantorsData },
      { data: securityItemsData },
    ] = await Promise.all([
      supabase.from("next_of_kin").select("*").eq("customer_id", customerId).single(),
      supabase
        .from("documents")
        .select("id, document_type, document_url")
        .eq("customer_id", customerId),
      supabase.from("business_images").select("*").eq("customer_id", customerId),
      
      supabase.from("guarantors").select("*").eq("customer_id", customerId),
      supabase
        .from("security_items")
        .select("*, security_item_images(image_url)")
        .eq("customer_id", customerId),
    ]);

    // Update state with fetched data
    setNextOfKin(nextOfKinData || null);
    setDocuments(documentsData || []);
    setFormData((prev) => ({ ...prev, documents: documentsData || [] }));
    setBusinessImages(businessImagesData || []);
    
    setGuarantors(guarantorsData || []);

   // Security items + images
if (securityItemsData?.length > 0) {
  const securityWithImages = securityItemsData.map((item) => ({
    ...item,
    images: item.security_item_images?.map((img) => img.image_url) || [],
  }));

  console.log("Processed Security Items:", securityWithImages);

  setSecurityItems(securityWithImages);
}


    // Guarantor security + images
    if (guarantorsData?.length > 0) {
      const guarantorIds = guarantorsData.map((g) => g.id);
      const { data: gSecurityData } = await supabase
        .from("guarantor_security")
        .select("*, guarantor_security_images(image_url)")
        .in("guarantor_id", guarantorIds);

      const gSecurityWithImages = (gSecurityData || []).map((item) => ({
        ...item,
        images: item.guarantor_security_images?.map((img) => img.image_url) || [],
      }));

      setGuarantorSecurityItems(gSecurityWithImages);
    }

    // Map existing images
    const imageData = {
      passport: customerData?.passport_url || null,
      idFront: customerData?.id_front_url || null,
      idBack: customerData?.id_back_url || null,
      house: customerData?.house_image_url || null,
      business: businessImagesData?.map((img) => img.image_url) || [],
      security:
        securityItemsData?.flatMap((item) =>
          item.security_item_images?.map((img) => img.image_url) || []
        ) || [],
      guarantorPassport: guarantorsData?.[0]?.passport_url || null,
      guarantorIdFront: guarantorsData?.[0]?.id_front_url || null,
      guarantorIdBack: guarantorsData?.[0]?.id_back_url || null,
      officerClient1:
        documentsData?.find((doc) => doc.document_type === "First Officer and Client Image")
          ?.document_url || null,
      officerClient2:
        documentsData?.find((doc) => doc.document_type === "Second Officer and Client Image")
          ?.document_url || null,
      bothOfficers:
        documentsData?.find((doc) => doc.document_type === "Both Officers Image")
          ?.document_url || null,
    };

    setExistingImages(imageData);
    toast.success("Customer details loaded");
  } catch (error) {
    console.error("Error fetching customer details:", error);
    toast.error("Error loading customer details");
  } finally {
    setLoading(false);
  }
};


  const DocumentCard = ({ title, imageUrl, placeholder, icon: Icon }) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <Icon className="h-4 w-4 text-indigo-600 mr-2" />
          {title}
        </h4>
      </div>
      <div className="p-4">
        {imageUrl ? (
          <div
            className="relative group cursor-pointer"
            onClick={() => setSelectedImage({ url: imageUrl, title })}
          >
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-48 object-contain rounded-lg bg-gray-50 border border-gray-100"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 rounded-lg">
              <DocumentMagnifyingGlassIcon className="h-8 w-8 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-full h-48 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50">
            <Icon className="h-12 w-12 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500 font-medium">{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  );

  const DetailRow = ({ label, value, icon: Icon }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center text-sm text-gray-600">
        {Icon && <Icon className="h-4 w-4 mr-2 text-indigo-500" />}
        {label}:
      </div>
      <span className="text-sm font-semibold text-gray-900 text-right">
        {value || "Not provided"}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4"></div>
          <p className="text-gray-600 font-medium">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg">
          <DocumentMagnifyingGlassIcon className="mx-auto h-16 w-16 text-red-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Customer Not Found</h3>
          <p className="text-gray-600">The requested customer details could not be loaded.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-700 to-blue-700 bg-clip-text text-transparent">
                Customer Details 
              </h1>
              <p className="text-gray-600 mt-2">Complete customer information and documents </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
            >
              <XCircleIcon className="h-8 w-8" />
            </button>
          </div>
        </div>

        {/* Customer Profile */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
          <div className="p-8">
            <div className="border-b border-gray-200 pb-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <UserCircleIcon className="h-8 w-8 text-indigo-600 mr-3" />
                Customer Information
              </h2>
            </div>

            {/* Customer Profile Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-8 mb-8 border border-indigo-100">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                {/* Profile Photo */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl cursor-pointer"
                    onClick={() =>
                      customer.passport_url &&
                      setSelectedImage({
                        url: customer.passport_url,
                        title: "Customer Profile Photo",
                      })
                    }
                  >
                    {customer.passport_url ? (
                      <img
                        src={customer.passport_url}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                        <UserCircleIcon className="h-20 w-20 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mt-4 text-center">
                    {customer.prefix} {customer.Firstname} {customer.Middlename} {customer.Surname}
                  </h3>
                  <p className="text-indigo-600 font-semibold">Primary Applicant</p>
                </div>

                {/* Personal Info Container */}
                <div className="flex-1">
                  {/* Highlighted ID + Mobile */}
                  <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <p className="flex-1 inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold shadow-sm">
                      <IdentificationIcon className="h-5 w-5 text-indigo-600" />
                      ID Number: {customer.id_number || "Not provided"}
                    </p>
                    <p className="flex-1 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg font-semibold shadow-sm">
                      <DevicePhoneMobileIcon className="h-5 w-5 text-green-600" />
                      Mobile: {customer.mobile || "Not provided"}
                    </p>
                  </div>

                  {/* Personal Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                      <DetailRow label="First Name" value={customer.Firstname} icon={UserCircleIcon} />
                      <DetailRow label="Surname" value={customer.Surname} icon={UserCircleIcon} />
                      <DetailRow label="Marital Status" value={customer.marital_status} icon={UserCircleIcon} />
                      <DetailRow label="Residence Status" value={customer.residence_status} icon={HomeIcon} />
                      <DetailRow label="Postal Address" value={customer.postal_address} icon={MapPinIcon} />
                      <DetailRow label="Postal Code" value={customer.code} icon={MapPinIcon} />
                    </div>

                    {/* Right column */}
                    <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                      <DetailRow label="Town" value={customer.town} icon={MapPinIcon} />
                      <DetailRow label="Gender" value={customer.gender} icon={UserCircleIcon} />
                      <DetailRow label="County" value={customer.county} icon={MapPinIcon} />
                      <DetailRow label="Alternative Mobile" value={customer.alternative_mobile} icon={PhoneIcon} />
                      <DetailRow label="Occupation" value={customer.occupation} icon={BriefcaseIcon} />
                      <DetailRow label="Date of Birth" value={customer.date_of_birth} icon={CalendarIcon} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Documents Grid */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Customer Documents</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DocumentCard
                  title="ID Front"
                  imageUrl={customer.id_front_url}
                  placeholder="No ID front available"
                  icon={IdentificationIcon}
                />
                <DocumentCard
                  title="ID Back"
                  imageUrl={customer.id_back_url}
                  placeholder="No ID back available"
                  icon={IdentificationIcon}
                />
                <DocumentCard
                  title="Residence"
                  imageUrl={customer.house_image_url}
                  placeholder="No residence image available"
                  icon={HomeIcon}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Next of Kin Section */}
        {nextOfKin && (
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
            <div className="p-8">
              <div className="border-b border-gray-200 pb-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                  Next of Kin Information
                </h2>
                <p className="text-gray-600 mt-2">
                  Next of kin details for this customer
                </p>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-8 mb-8 border border-indigo-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left column */}
                  <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                    <DetailRow label="First Name" value={nextOfKin.Firstname} icon={UserCircleIcon} />
                    <DetailRow label="Middle Name" value={nextOfKin.Middlename} icon={UserCircleIcon} />
                    <DetailRow label="Surname" value={nextOfKin.Surname} icon={UserCircleIcon} />
                    <DetailRow label="ID Number" value={nextOfKin.id_number} icon={IdentificationIcon} />
                    <DetailRow label="Relationship" value={nextOfKin.relationship} icon={UserGroupIcon} />
                  </div>

                  {/* Right column */}
                  <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                    <DetailRow label="Mobile Number" value={nextOfKin.mobile} icon={PhoneIcon} />
                    <DetailRow label="Alternative Number" value={nextOfKin.alternative_mobile} icon={PhoneIcon} />
                    <DetailRow label="Employment Status" value={nextOfKin.employment_status} icon={BriefcaseIcon} />
                    <DetailRow label="County" value={nextOfKin.county} icon={MapPinIcon} />
                    <DetailRow label="City/Town" value={nextOfKin.city_town} icon={MapPinIcon} />
                  </div>
                </div>
              </div>

             
            </div>
          </div>
        )}

      

        {/* Business Information */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
          <div className="p-8">
            <div className="border-b border-gray-200 pb-6 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <BuildingOffice2Icon className="h-8 w-8 text-indigo-600 mr-3" />
                Business Information
              </h2>
            </div>

            {/* Business Details */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BuildingOffice2Icon className="h-6 w-6 text-indigo-600" />
                Business Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DetailRow label="Business Name" value={customer.business_name} icon={BuildingOffice2Icon} />
                <DetailRow label="Business Type" value={customer.business_type} icon={BriefcaseIcon} />
                <DetailRow label="Location" value={customer.business_location} icon={MapPinIcon} />
                <DetailRow label="Year Established" value={customer.year_established} icon={CalendarIcon} />
                <DetailRow label="Road" value={customer.road} icon={MapPinIcon} />
                <DetailRow label="Landmark" value={customer.landmark} icon={MapPinIcon} />
                <DetailRow label="Daily Sales" value={customer.daily_Sales} icon={CurrencyDollarIcon} />
              </div>
            </div>

            {/* Business Images */}
            {businessImages.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
                <BuildingOffice2Icon className="mx-auto h-20 w-20 text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Business Images</h3>
                <p className="text-gray-600">This customer has not provided business images.</p>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Business Images</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {businessImages.map((image, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                    >
                      <div className="p-4 bg-gradient-to-r from-slate-50 to-gray-50 border-b">
                        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                          <PhotoIcon className="h-4 w-4 text-indigo-600 mr-2" />
                          Business Image {index + 1}
                        </h4>
                      </div>
                      <div className="p-4">
                        <div
                          className="relative group cursor-pointer"
                          onClick={() =>
                            setSelectedImage({
                              url: image.image_url,
                              title: `Business Image ${index + 1}`,
                            })
                          }
                        >
                          <img
                            src={image.image_url}
                            alt={`Business ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-30 rounded-lg">
                            <DocumentMagnifyingGlassIcon className="h-8 w-8 text-white" />
                          </div>
                        </div>

                        {image.description && (
                          <p className="mt-3 text-sm text-gray-600">{image.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Guarantors */}
        {guarantors.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
            <div className="p-8">
              <div className="border-b border-gray-200 pb-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <UserGroupIcon className="h-8 w-8 text-indigo-600 mr-3" />
                  Guarantors
                </h2>
                <p className="text-gray-600 mt-2">Guarantor information for this customer</p>
              </div>

              <div className="space-y-12">
                {guarantors.map((guarantor, index) => (
                  <div
                    key={guarantor.id}
                    className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                        <UserGroupIcon className="h-6 w-6 text-indigo-600 mr-3" />
                        Guarantor {index + 1}
                      </h3>
                      <span className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                        {guarantor.relationship || "Relationship Unknown"}
                      </span>
                    </div>

                    {/* Profile */}
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-8 mb-8 border border-indigo-100">
                      <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                        {/* Profile Photo */}
                        <div className="flex flex-col items-center">
                          <div
                            className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-xl cursor-pointer"
                            onClick={() =>
                              guarantor.passport_url &&
                              setSelectedImage({
                                url: guarantor.passport_url,
                                title: `Guarantor ${index + 1} Profile Photo`,
                              })
                            }
                          >
                            {guarantor.passport_url ? (
                              <img
                                src={guarantor.passport_url}
                                alt="Guarantor"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                <UserCircleIcon className="h-20 w-20 text-gray-400" />
                              </div>
                            )}
                          </div>

                          <h4 className="text-2xl font-bold text-gray-900 mt-4 text-center">
                            {guarantor.Firstname} {guarantor.Middlename} {guarantor.Surname}
                          </h4>
                        </div>

                        {/* Highlighted Info */}
                        <div className="flex-1">
                          <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <p className="flex-1 inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-semibold shadow-sm">
                              <IdentificationIcon className="h-5 w-5 text-indigo-600" />
                              ID Number: {guarantor.id_number || "Not provided"}
                            </p>
                            <p className="flex-1 inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg font-semibold shadow-sm">
                              <DevicePhoneMobileIcon className="h-5 w-5 text-green-600" />
                              Mobile: {guarantor.mobile || "Not provided"}
                            </p>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Column 1 */}
                            <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                              <DetailRow label="First Name" value={guarantor.Firstname} icon={UserCircleIcon} />
                              <DetailRow label="Middlename" value={guarantor.Middlename} icon={UserCircleIcon} />
                              <DetailRow label="Surname" value={guarantor.Surname} icon={UserCircleIcon} />
                              <DetailRow label="Gender" value={guarantor.gender} icon={UserCircleIcon} />
                              <DetailRow label="Marital Status" value={guarantor.marital_status} icon={UserCircleIcon} />
                              <DetailRow label="Occupation" value={guarantor.occupation} icon={BriefcaseIcon} />
                            </div>

                            {/* Column 2 */}
                            <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
                              <DetailRow label="City/Town" value={guarantor.city_town} icon={MapPinIcon} />
                              <DetailRow label="County" value={guarantor.county} icon={MapPinIcon} />
                              <DetailRow label="Residential Status" value={guarantor.residence_status} icon={HomeIcon} />
                              <DetailRow label="Postal Code" value={guarantor.postal_address} icon={MapPinIcon} />
                              <DetailRow label="Code" value={guarantor.code} icon={MapPinIcon} />
                              <DetailRow label="Relationship" value={guarantor.relationship} icon={UserGroupIcon} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                      <DocumentCard
                        title="Passport Photo"
                        imageUrl={guarantor.passport_url}
                        placeholder="No passport photo available"
                        icon={UserCircleIcon}
                      />
                      <DocumentCard
                        title="ID Front"
                        imageUrl={guarantor.id_front_url}
                        placeholder="No ID front available"
                        icon={IdentificationIcon}
                      />
                      <DocumentCard
                        title="ID Back"
                        imageUrl={guarantor.id_back_url}
                        placeholder="No ID back available"
                        icon={IdentificationIcon}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Security Items */}
        {(securityItems.length > 0 || guarantorSecurityItems.length > 0) && (
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
            <div className="p-8">
              <div className="border-b border-gray-200 pb-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <ShieldCheckIcon className="h-8 w-8 text-indigo-600 mr-3" />
                  Security Items
                </h2>
                <p className="text-gray-600 mt-2">Customer and guarantor security items</p>
              </div>

              {/* Customer Security */}
              {securityItems.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <ShieldCheckIcon className="h-6 w-6 text-indigo-600 mr-3" />
                    Customer Security Items
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {securityItems.map((item, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200"
                      >
                        {/* Item Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                              <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{item.item || "Security Item"}</h4>
                              <p className="text-sm text-gray-600">Item {index + 1}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            KES {item.value?.toLocaleString() || "N/A"}
                          </span>
                        </div>

                        {/* Item Image(s) */}
                        {item.images && item.images.length > 0 && (
                          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {item.images.map((imgUrl, i) => (
                              <img
                                key={i}
                                src={imgUrl}
                                alt={`${item.item || "Security Item"} - Image ${i + 1}`}
                                className="w-full h-40 object-cover rounded-lg shadow-sm cursor-pointer"
                                onClick={() =>
                                  setSelectedImage({
                                    url: imgUrl,
                                    title: `${item.item || "Security Item"} - Image ${i + 1}`,
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="space-y-3">
                          <DetailRow label="Identification" value={item.identification} icon={IdentificationIcon} />
                          {item.description && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Description:</p>
                              <p className="text-sm text-gray-900 mt-1">{item.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guarantor Security */}
              {guarantorSecurityItems.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <ShieldCheckIcon className="h-6 w-6 text-indigo-600 mr-3" />
                    Guarantor Security Items
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {guarantorSecurityItems.map((item, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200"
                      >
                        {/* Item Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                              <ShieldCheckIcon className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">{item.item || "Security Item"}</h4>
                              <p className="text-sm text-gray-600">Guarantor Item {index + 1}</p>
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            KES {item.estimated_market_value?.toLocaleString() || "N/A"}
                          </span>
                        </div>

                        {/* Item Image(s) */}
                        {item.images?.length > 0 && (
                          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {item.images.map((imgUrl, i) => (
                              <img
                                key={i}
                                src={imgUrl}
                                alt={`${item.item || `Guarantor Security ${index + 1}`} - Image ${i + 1}`}
                                className="w-full h-40 object-cover rounded-lg shadow-sm cursor-pointer"
                                onClick={() =>
                                  setSelectedImage({
                                    url: imgUrl,
                                    title: `${item.item || "Guarantor Security"} - Image ${i + 1}`,
                                  })
                                }
                              />
                            ))}
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="space-y-3">
                          <DetailRow label="Identification" value={item.identification} icon={IdentificationIcon} />
                          {item.description && (
                            <div>
                              <p className="text-sm font-medium text-gray-600">Description:</p>
                              <p className="text-sm text-gray-900 mt-1">{item.description}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loan Information Section */}
        {(loanDetails?.prequalifiedAmount || loanDetails?.bm_loan_scored_amount) && (
          <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
            <div className="p-8">
              <div className="border-b border-gray-200 pb-6 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <CurrencyDollarIcon className="h-8 w-8 text-indigo-600 mr-3" />
                  Loan Information
                </h2>
                <p className="text-gray-600 mt-2">Prequalified and scored loan amounts</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Prequalified Amount */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-blue-900">Prequalified Amount</h4>
                    <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                      <CurrencyDollarIcon className="h-6 w-6 text-blue-700" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-700 mb-2">
                    KES {loanDetails.prequalifiedAmount?.toLocaleString() || "0"}
                  </p>
                  <p className="text-sm text-blue-600">Amount from RO prequalification</p>
                </div>

                {/* BM Scored Amount */}
                {loanDetails.bm_loan_scored_amount && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-purple-900">BM Scored Amount</h4>
                      <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                        <CurrencyDollarIcon className="h-6 w-6 text-purple-700" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-purple-700 mb-2">
                      KES {loanDetails.bm_loan_scored_amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-purple-600">BM assessment amount</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
{/* Documents Verification Section */}
<div className="bg-white rounded-2xl shadow-lg border border-indigo-100 mb-8 overflow-hidden">
  <div className="p-8">
    <div className="border-b border-gray-200 pb-6 mb-8">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <DocumentTextIcon className="h-8 w-8 text-indigo-600 mr-3" />
        Document Verification
      </h2>
      <p className="text-gray-600 mt-2">
        Verification and officer images
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[
        {
          key: "first_officer_client",
          label: "First Officer & Client",
          document: documents.find(d => d.document_type === "First Officer and Client Image")
        },
        {
          key: "second_officer_client",
          label: "Second Officer & Client",
          document: documents.find(d => d.document_type === "Second Officer and Client Image")
        },
        {
          key: "both_officers",
          label: "Both Officers",
          document: documents.find(d => d.document_type === "Both Officers Image")
        }
      ].map(({ key, label, document }) => (
        <DocumentCard
          key={key}
          title={label}
          imageUrl={document?.document_url}
          placeholder="No image available"
          icon={DocumentTextIcon}
          onClick={() => document?.document_url && setSelectedImage({
            url: document.document_url,
            title: label
          })}
        />
      ))}
    </div>

    {/* Additional Documents */}
    {documents.filter(d => ![
      "First Officer and Client Image",
      "Second Officer and Client Image",
      "Both Officers Image"
    ].includes(d.document_type)).length > 0 && (
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Additional Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {documents
            .filter(d => ![
              "First Officer and Client Image",
              "Second Officer and Client Image",
              "Both Officers Image"
            ].includes(d.document_type))
            .map((document, index) => (
              <DocumentCard
                key={index}
                title={document.document_type}
                imageUrl={document.document_url}
                placeholder="No image available"
                icon={DocumentTextIcon}
                onClick={() => document.document_url && setSelectedImage({
                  url: document.document_url,
                  title: document.document_type
                })}
              />
            ))}
        </div>
      </div>
    )}
  </div>
</div>
        {/* Image Modal */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl max-h-full bg-white rounded-2xl overflow-hidden shadow-2xl">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedImage.title}</h3>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-white hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-white hover:bg-opacity-20"
                  >
                    <XCircleIcon className="h-8 w-8" />
                  </button>
                </div>
              </div>
              
              {/* Modal Image */}
              <div className="p-4 bg-gray-50">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              
              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">Click outside the image or the X button to close</p>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ViewCustomer;
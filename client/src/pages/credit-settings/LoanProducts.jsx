import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import {
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BanknotesIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import Spinner from "../../components/Spinner";

export default function LoanProducts() {
  const { profile } = useAuth();
  const [products, setProducts] = useState([]);
  const [productTypes, setProductTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalJoinFee, setGlobalJoinFee] = useState("0");
  const [savingFee, setSavingFee] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  const [notification, setNotification] = useState(null);

  const [productForm, setProductForm] = useState({
    product_name: "",
    min_amount: "",
    max_amount: "",
  });

  const [typeForm, setTypeForm] = useState({
    product_type: "",
    duration_weeks: "",
    interest_rate: "",
    processing_fee_rate: "0",
    processing_fee_mode: "percentage",
    registration_fee: "0",
    penalty_rate: "0",
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (profile?.tenant_id) fetchProducts();
  }, [profile]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") => setNotification({ message, type });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/api/loan-products?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        if (data.data?.length > 0) setGlobalJoinFee(data.data[0].registration_fee || "0");
        await fetchTypes(profile.tenant_id);
      } else throw new Error(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTypes = async (tenantId) => {
    try {
      const res = await apiFetch(`/api/loan-products/types?tenant_id=${tenantId}`);
      const data = await res.json();
      if (data.success) {
        const grouped = data.data.reduce((acc, curr) => {
          if (!acc[curr.loan_product_id]) acc[curr.loan_product_id] = [];
          acc[curr.loan_product_id].push(curr);
          return acc;
        }, {});
        setProductTypes(grouped);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const validateProductForm = () => {
    const errors = {};
    if (!productForm.product_name.trim()) errors.product_name = "Product name is required";
    if (!productForm.min_amount || parseFloat(productForm.min_amount) <= 0) errors.min_amount = "Min amount must be greater than 0";
    if (productForm.max_amount && parseFloat(productForm.max_amount) < parseFloat(productForm.min_amount)) errors.max_amount = "Max amount must be greater than min amount";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateTypeForm = () => {
    const errors = {};
    if (!typeForm.product_type.trim()) errors.product_type = "Type name is required";
    if (!typeForm.duration_weeks || parseInt(typeForm.duration_weeks) <= 0) errors.duration_weeks = "Duration must be greater than 0";
    if (!typeForm.interest_rate || parseFloat(typeForm.interest_rate) < 0) errors.interest_rate = "Interest rate must be 0 or greater";
    if (parseFloat(typeForm.processing_fee_rate) < 0) errors.processing_fee_rate = "Processing fee cannot be negative";
    if (parseFloat(typeForm.registration_fee) < 0) errors.registration_fee = "Registration fee cannot be negative";
    if (parseFloat(typeForm.penalty_rate) < 0) errors.penalty_rate = "Penalty rate cannot be negative";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/loan-products`, { method: "POST", body: JSON.stringify({ ...productForm, tenant_id: profile.tenant_id }) });
      const data = await res.json();
      if (data.success) { setProducts([data.data, ...products]); setShowProductModal(false); resetProductForm(); showNotification("Product created successfully"); }
      else showNotification(data.error || "Failed to create product", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/loan-products/${selectedProduct.id}`, { method: "PUT", body: JSON.stringify({ ...productForm, tenant_id: profile.tenant_id }) });
      const data = await res.json();
      if (data.success) { setProducts(products.map((p) => (p.id === selectedProduct.id ? data.data : p))); setShowProductModal(false); resetProductForm(); showNotification("Product updated successfully"); }
      else showNotification(data.error || "Failed to update product", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product? This will also delete all associated product types.")) return;
    try {
      const res = await apiFetch(`/api/loan-products/${id}?tenant_id=${profile.tenant_id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setProducts(products.filter((p) => p.id !== id)); delete productTypes[id]; showNotification("Product deleted successfully"); }
      else showNotification(data.error || "Failed to delete product", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !validateTypeForm()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/loan-products/types`, { method: "POST", body: JSON.stringify({ ...typeForm, tenant_id: profile.tenant_id, loan_product_id: selectedProduct.id }) });
      const data = await res.json();
      if (data.success) { setProductTypes((prev) => ({ ...prev, [selectedProduct.id]: [data.data, ...(prev[selectedProduct.id] || [])] })); setShowTypeModal(false); resetTypeForm(); showNotification("Product type created successfully"); }
      else showNotification(data.error || "Failed to create type", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateType = async (e) => {
    e.preventDefault();
    if (!selectedType || !validateTypeForm()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/loan-products/types/${selectedType.id}`, { method: "PUT", body: JSON.stringify({ ...typeForm, tenant_id: profile.tenant_id }) });
      const data = await res.json();
      if (data.success) { setProductTypes((prev) => ({ ...prev, [selectedProduct.id]: prev[selectedProduct.id].map((t) => t.id === selectedType.id ? data.data : t) })); setShowTypeModal(false); resetTypeForm(); showNotification("Product type updated successfully"); }
      else showNotification(data.error || "Failed to update type", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteType = async (productId, typeId) => {
    if (!window.confirm("Are you sure you want to delete this product type?")) return;
    try {
      const res = await apiFetch(`/api/loan-products/types/${typeId}?tenant_id=${profile.tenant_id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) { setProductTypes((prev) => ({ ...prev, [productId]: prev[productId].filter((t) => t.id !== typeId) })); showNotification("Product type deleted successfully"); }
      else showNotification(data.error || "Failed to delete type", "error");
    } catch (err) { showNotification(err.message || "An error occurred", "error"); }
  };

  const resetProductForm = () => { setProductForm({ product_name: "", min_amount: "", max_amount: "" }); setSelectedProduct(null); setFormErrors({}); };
  const resetTypeForm = () => { setTypeForm({ product_type: "", duration_weeks: "", interest_rate: "", processing_fee_rate: "0", processing_fee_mode: "percentage", registration_fee: "0", penalty_rate: "0" }); setSelectedType(null); setFormErrors({}); };

  const openEditProductModal = (product) => { setSelectedProduct(product); setProductForm({ product_name: product.product_name, min_amount: product.min_amount, max_amount: product.max_amount || "" }); setFormErrors({}); setShowProductModal(true); };
  const openEditTypeModal = (product, type) => { setSelectedProduct(product); setSelectedType(type); setTypeForm({ product_type: type.product_type, duration_weeks: type.duration_weeks, interest_rate: type.interest_rate, processing_fee_rate: type.processing_fee_rate, processing_fee_mode: type.processing_fee_mode || "percentage", registration_fee: type.registration_fee, penalty_rate: type.penalty_rate }); setFormErrors({}); setShowTypeModal(true); };
  const openCreateTypeModal = (product) => { setSelectedProduct(product); setSelectedType(null); resetTypeForm(); setShowTypeModal(true); };

  const handleSaveJoinFee = async () => {
    try {
      setSavingFee(true);
      const res = await apiFetch(`/api/loan-products/global/registration-fee`, { method: "PUT", body: JSON.stringify({ tenant_id: profile.tenant_id, registration_fee: parseFloat(globalJoinFee) || 0 }) });
      const data = await res.json();
      if (data.success) { showNotification("Joining fee updated for all products"); setProducts(products.map(p => ({ ...p, registration_fee: globalJoinFee }))); }
      else throw new Error(data.error);
    } catch (err) { showNotification(err.message, "error"); }
    finally { setSavingFee(false); }
  };

  const inputClass = (hasError) =>
    `block w-full rounded-lg border bg-white text-sm py-2 px-3 transition-all outline-none placeholder:text-gray-400 ${hasError
      ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-gray-200 hover:border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    }`;

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-neutral-50"><Spinner /></div>;

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 px-4">
      <div className="bg-white border border-red-100 rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="flex items-start gap-4 text-red-600">
          <div className="p-2 bg-red-50 rounded-xl"><ExclamationTriangleIcon className="w-6 h-6" /></div>
          <div>
            <h3 className="text-slate-700">Error Loading Products</h3>
            <p className="text-sm text-gray-500 mt-1">{error}</p>
          </div>
        </div>
        <button onClick={fetchProducts} className="mt-6 w-full bg-red-50 text-red-700 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors text-sm text-slate-600 border border-red-100">Retry Connection</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted p-5 md:p-8 font-body">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Notification */}
        {notification && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-lg border transition-all animate-in slide-in-from-top-3 duration-200 max-w-sm ${notification.type === "success" ? "bg-white border-gray-100 text-gray-800" : "bg-white border-gray-100 text-gray-800"}`}>
            <div className={`p-1 rounded-lg ${notification.type === "success" ? "bg-emerald-50" : "bg-red-50"}`}>
              {notification.type === "success"
                ? <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                : <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />}
            </div>
            <p className="text-sm text-slate-600 flex-1">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors ml-1">
              <XMarkIcon className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-heading text-slate-700 tracking-tight">Loan Products</h1>
            <p className="text-gray-400 text-xs mt-0.5">Configure your lending portfolio and product terms</p>
          </div>
          <button
            onClick={() => { resetProductForm(); setShowProductModal(true); }}
            className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all shadow-sm  text-xs active:scale-95"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Product
          </button>
        </div>

        {/* Joining Fee Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-brand-primary/8 rounded-lg">
                <BanknotesIcon className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <p className="text-xs text-slate-700">Global Joining Fee</p>
                <p className="text-xs text-gray-400 mt-0.5">Registration fee applied once per new customer</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 text-xs  pointer-events-none">KES</span>
                <input
                  type="number"
                  value={globalJoinFee}
                  onChange={(e) => setGlobalJoinFee(e.target.value)}
                  className="w-36 pl-9 pr-3 py-2 text-sm text-brand-primary border border-gray-200 rounded-lg focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 hover:border-gray-300 transition-all"
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={handleSaveJoinFee}
                disabled={savingFee}
                className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all  text-xs shadow-sm disabled:opacity-60 whitespace-nowrap active:scale-95"
              >
                {savingFee ? <Spinner size="sm" /> : <CheckCircleIcon className="w-3.5 h-3.5" />}
                Save Fee
              </button>
            </div>
          </div>
          <div className="px-5 py-2.5 bg-blue-50/60 border-t border-blue-100/60">
            <p className="text-xs text-blue-600 flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              Automatically applied to any customer taking their first loan across all products.
            </p>
          </div>
        </div>

        {/* Products */}
        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 text-center">
            <div className="max-w-xs mx-auto">
              <div className="w-16 h-16 bg-brand-primary/8 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <BanknotesIcon className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-sm text-slate-700 mb-1.5">No Products Yet</h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">Add your first loan product to start configuring your portfolio.</p>
              <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition-colors  text-xs shadow-sm">
                <PlusIcon className="w-3.5 h-3.5" />
                Create First Product
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">

                {/* Product Header */}
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/8 rounded-lg">
                      <BanknotesIcon className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm text-slate-700">{product.product_name}</h2>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-400">
                          Min: <span className="text-emerald-600">KES {Number(product.min_amount).toLocaleString()}</span>
                        </span>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-gray-400">
                          Max: <span className="text-emerald-600">{product.max_amount ? `KES ${Number(product.max_amount).toLocaleString()}` : "Unlimited"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditProductModal(product)} className="p-1.5 text-gray-300 hover:text-brand-primary hover:bg-brand-primary/8 rounded-lg transition-colors" title="Edit product">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete product">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Product Types */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-400 uppercase tracking-widest">Loan Types & Terms</span>
                    <button onClick={() => openCreateTypeModal(product)} className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary/70 transition-colors">
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add Type
                    </button>
                  </div>

                  {productTypes[product.id]?.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {productTypes[product.id].map((type) => (
                        <div key={type.id} className="relative bg-gray-50/70 border border-gray-100 rounded-xl p-4 hover:border-brand-primary/30 hover:bg-white hover:shadow-sm transition-all">

                          {/* Always-visible action buttons */}
                          <div className="absolute top-3 right-3 flex gap-1">
                            <button
                              onClick={() => openEditTypeModal(product, type)}
                              className="p-1.5 text-slate-500 bg-white border border-gray-200 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-blue-50 rounded-md transition-colors shadow-sm"
                              title="Edit type"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteType(product.id, type.id)}
                              className="p-1.5 text-slate-500 bg-white border border-gray-200 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-md transition-colors shadow-sm"
                              title="Delete type"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mb-3 pr-16">
                            <h4 className="text-xs text-slate-700 leading-tight">{type.product_type}</h4>
                            <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                              <ClockIcon className="w-3 h-3" />
                              {type.duration_weeks} weeks
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-3 border-t border-gray-100">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Interest</span>
                              <span className="text-xs text-slate-600">{type.interest_rate}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-400">Processing</span>
                              <span className="text-xs text-slate-600">
                                {type.processing_fee_mode === "percentage"
                                  ? `${type.processing_fee_rate}%`
                                  : `KES ${Number(type.processing_fee_rate).toLocaleString()}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-xs text-gray-400 mb-3">No types defined for this product yet.</p>
                      <button onClick={() => openCreateTypeModal(product)} className="inline-flex items-center gap-1 text-xs  bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:border-brand-primary/40 hover:text-brand-primary transition-colors">
                        <PlusIcon className="w-3 h-3" />
                        Define First Type
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Product Modal */}
        {showProductModal && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm text-slate-700">{selectedProduct ? "Edit Product" : "New Loan Product"}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedProduct ? "Update product details" : "Define your new loan product"}</p>
                </div>
                <button onClick={() => { setShowProductModal(false); resetProductForm(); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={selectedProduct ? handleUpdateProduct : handleCreateProduct} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5">Product Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={productForm.product_name}
                    onChange={(e) => setProductForm({ ...productForm, product_name: e.target.value })}
                    className={inputClass(formErrors.product_name)}
                    placeholder="e.g., Business Growth Loan"
                    onFocus={(e) => e.target.select()}
                  />
                  {formErrors.product_name && <p className="text-red-500 text-xs mt-1">{formErrors.product_name}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Min Amount <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-400  pointer-events-none">KES</span>
                      <input type="number" value={productForm.min_amount} onChange={(e) => setProductForm({ ...productForm, min_amount: e.target.value })} className={`${inputClass(formErrors.min_amount)} pl-10`} placeholder="0" onFocus={(e) => e.target.select()} />
                    </div>
                    {formErrors.min_amount && <p className="text-red-500 text-xs mt-1">{formErrors.min_amount}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Max Amount</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-400  pointer-events-none">KES</span>
                      <input type="number" value={productForm.max_amount} onChange={(e) => setProductForm({ ...productForm, max_amount: e.target.value })} className={`${inputClass(formErrors.max_amount)} pl-10`} placeholder="Optional" onFocus={(e) => e.target.select()} />
                    </div>
                    {formErrors.max_amount && <p className="text-red-500 text-xs mt-1">{formErrors.max_amount}</p>}
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => { setShowProductModal(false); resetProductForm(); }} className="flex-1 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg  text-xs hover:bg-gray-100 transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg  text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-60">
                    {submitting ? "Saving..." : selectedProduct ? "Save Changes" : "Create Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Type Modal */}
        {showTypeModal && selectedProduct && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-sm text-slate-700">{selectedType ? "Edit Type" : "Add Loan Type"}</h2>
                  <p className="text-xs text-brand-primary  mt-0.5">{selectedProduct.product_name}</p>
                </div>
                <button onClick={() => { setShowTypeModal(false); resetTypeForm(); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={selectedType ? handleUpdateType : handleCreateType} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5">Type Name <span className="text-red-500">*</span></label>
                  <input type="text" value={typeForm.product_type} onChange={(e) => setTypeForm({ ...typeForm, product_type: e.target.value })} className={inputClass(formErrors.product_type)} placeholder="e.g., 4 Weeks Standard" onFocus={(e) => e.target.select()} />
                  {formErrors.product_type && <p className="text-red-500 text-xs mt-1">{formErrors.product_type}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Duration (Weeks) <span className="text-red-500">*</span></label>
                    <input type="number" value={typeForm.duration_weeks} onChange={(e) => setTypeForm({ ...typeForm, duration_weeks: e.target.value })} className={inputClass(formErrors.duration_weeks)} placeholder="4" onFocus={(e) => e.target.select()} />
                    {formErrors.duration_weeks && <p className="text-red-500 text-xs mt-1">{formErrors.duration_weeks}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5">Interest Rate (%) <span className="text-red-500">*</span></label>
                    <input type="number" step="0.01" value={typeForm.interest_rate} onChange={(e) => setTypeForm({ ...typeForm, interest_rate: e.target.value })} className={inputClass(formErrors.interest_rate)} placeholder="15" onFocus={(e) => e.target.select()} />
                    {formErrors.interest_rate && <p className="text-red-500 text-xs mt-1">{formErrors.interest_rate}</p>}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs text-slate-600">
                      Processing Fee ({typeForm.processing_fee_mode === "percentage" ? "%" : "Fixed Amount"})
                    </label>
                    <div className="flex bg-gray-100 p-0.5 rounded-lg">
                      <button type="button" onClick={() => setTypeForm({ ...typeForm, processing_fee_mode: "percentage" })}
                        className={`px-2.5 py-1 text-xs  rounded-md transition-all ${typeForm.processing_fee_mode === "percentage" ? "bg-white text-brand-primary shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                        %
                      </button>
                      <button type="button" onClick={() => setTypeForm({ ...typeForm, processing_fee_mode: "fixed" })}
                        className={`px-2.5 py-1 text-xs  rounded-md transition-all ${typeForm.processing_fee_mode === "fixed" ? "bg-white text-brand-primary shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                        KES
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    {typeForm.processing_fee_mode === "fixed" && (
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-gray-400  pointer-events-none">KES</span>
                    )}
                    <input type="number" step="0.01" value={typeForm.processing_fee_rate} onChange={(e) => setTypeForm({ ...typeForm, processing_fee_rate: e.target.value })}
                      className={`${inputClass(false)} ${typeForm.processing_fee_mode === "fixed" ? "pl-10" : ""}`}
                      placeholder="0" onFocus={(e) => e.target.select()} />
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100">
                  <button type="button" onClick={() => { setShowTypeModal(false); resetTypeForm(); }} className="flex-1 px-4 py-2 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg  text-xs hover:bg-gray-100 transition-colors">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg  text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-60">
                    {submitting ? "Saving..." : selectedType ? "Save Changes" : "Add Type"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
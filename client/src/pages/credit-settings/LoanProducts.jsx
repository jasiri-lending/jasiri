import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BanknotesIcon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import SkeletonPage from "../../components/Skeleton";
import { Modal } from "../../components/Modal";

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
    `block w-full rounded-lg border bg-card text-sm py-2 px-3 transition-all outline-none placeholder:text-muted ${hasError
      ? "border-danger/40 focus:border-danger focus:ring-2 focus:ring-danger-fill"
      : "border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    }`;

  if (loading) return <SkeletonPage />;

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
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <div className="w-full space-y-6">

        {/* Notification */}
        {notification && (
          <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-card border transition-all animate-in slide-in-from-top-3 duration-200 max-w-sm ${notification.type === "success" ? "bg-card border-border-light text-heading" : "bg-card border-border-light text-heading"}`}>
            <div className={`p-1 rounded-lg ${notification.type === "success" ? "bg-success-fill" : "bg-danger-fill"}`}>
              {notification.type === "success"
                ? <CheckCircleIcon className="w-4 h-4 text-success-text" />
                : <ExclamationTriangleIcon className="w-4 h-4 text-danger" />}
            </div>
            <p className="text-sm text-body flex-1">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-surface rounded-lg transition-colors ml-1">
              <XMarkIcon className="w-4 h-4 text-muted" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-heading tracking-tight">Loan Products</h1>
            <p className="text-muted text-xs mt-0.5">Configure your lending portfolio and product terms</p>
          </div>
          <button
            onClick={() => { resetProductForm(); setShowProductModal(true); }}
            className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs active:scale-95"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Product
          </button>
        </div>

        {/* Joining Fee Card */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-fill rounded-lg">
                <BanknotesIcon className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-heading">Global Joining Fee</p>
                <p className="text-xs text-muted mt-0.5">Registration fee applied once per new customer</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-muted text-xs pointer-events-none">KES</span>
                <input
                  type="number"
                  value={globalJoinFee}
                  onChange={(e) => setGlobalJoinFee(e.target.value)}
                  className="w-36 pl-9 pr-3 py-2 text-sm text-brand-primary border border-border rounded-lg focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 hover:border-muted transition-all bg-card"
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={handleSaveJoinFee}
                disabled={savingFee}
                className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all text-xs shadow-btn disabled:opacity-60 whitespace-nowrap active:scale-95"
              >
                {savingFee ? <Spinner size="sm" /> : <CheckCircleIcon className="w-3.5 h-3.5" />}
                Save Fee
              </button>
            </div>
          </div>
          <div className="px-5 py-2.5 bg-info-fill/60 border-t border-info/20">
            <p className="text-xs text-info-text flex items-center gap-1.5">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 flex-shrink-0" />
              Automatically applied to any customer taking their first loan across all products.
            </p>
          </div>
        </div>

        {/* Products */}
        {products.length === 0 ? (
          <div className="bg-card rounded-xl border border-border shadow-card p-16 text-center">
            <div className="max-w-xs mx-auto">
              <div className="w-16 h-16 bg-success-fill rounded-2xl flex items-center justify-center mx-auto mb-5">
                <BanknotesIcon className="w-8 h-8 text-brand-primary" />
              </div>
              <h3 className="text-sm font-medium text-heading mb-1.5">No Products Yet</h3>
              <p className="text-xs text-muted mb-6 leading-relaxed">Add your first loan product to start configuring your portfolio.</p>
              <button onClick={() => { resetProductForm(); setShowProductModal(true); }} className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition-colors text-xs shadow-btn">
                <PlusIcon className="w-3.5 h-3.5" />
                Create First Product
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <div key={product.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden hover:shadow-lg transition-shadow group">

                {/* Product Header */}
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-light">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success-fill rounded-lg">
                      <BanknotesIcon className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-heading">{product.product_name}</h2>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted">
                          Min: <span className="text-success-text font-medium">KES {Number(product.min_amount).toLocaleString()}</span>
                        </span>
                        <span className="text-border text-xs">·</span>
                        <span className="text-xs text-muted">
                          Max: <span className="text-success-text font-medium">{product.max_amount ? `KES ${Number(product.max_amount).toLocaleString()}` : "Unlimited"}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditProductModal(product)} className="p-1.5 text-muted hover:text-brand-primary hover:bg-success-fill rounded-lg transition-colors" title="Edit product">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteProduct(product.id)} className="p-1.5 text-muted hover:text-danger hover:bg-danger-fill rounded-lg transition-colors" title="Delete product">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Product Types */}
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-muted uppercase tracking-widest">Loan Types & Terms</span>
                    <button onClick={() => openCreateTypeModal(product)} className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary/70 transition-colors">
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add Type
                    </button>
                  </div>

                  {productTypes[product.id]?.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {productTypes[product.id].map((type) => (
                        <div key={type.id} className="relative bg-surface border border-border-light rounded-xl p-4 hover:border-brand-primary/30 hover:bg-card hover:shadow-card transition-all">

                          {/* Always-visible action buttons */}
                          <div className="absolute top-3 right-3 flex gap-1">
                            <button
                              onClick={() => openEditTypeModal(product, type)}
                              className="p-1.5 text-muted bg-card border border-border hover:text-brand-primary hover:border-brand-primary/40 hover:bg-success-fill rounded-md transition-colors shadow-sm"
                              title="Edit type"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteType(product.id, type.id)}
                              className="p-1.5 text-muted bg-card border border-border hover:text-danger hover:border-danger/40 hover:bg-danger-fill rounded-md transition-colors shadow-sm"
                              title="Delete type"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mb-3 pr-16">
                            <h4 className="text-xs font-medium text-heading leading-tight">{type.product_type}</h4>
                            <div className="flex items-center gap-1 text-xs text-muted mt-1">
                              <ClockIcon className="w-3 h-3" />
                              {type.duration_weeks} weeks
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-3 border-t border-border-light">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted">Interest</span>
                              <span className="text-xs font-medium text-body">{type.interest_rate}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-muted">Processing</span>
                              <span className="text-xs font-medium text-body">
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
                    <div className="text-center py-8 bg-surface rounded-xl border border-dashed border-border">
                      <p className="text-xs text-muted mb-3">No types defined for this product yet.</p>
                      <button onClick={() => openCreateTypeModal(product)} className="inline-flex items-center gap-1 text-xs bg-card border border-border text-body px-3 py-1.5 rounded-lg hover:border-brand-primary/40 hover:text-brand-primary transition-colors">
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
        <Modal
          open={showProductModal}
          title={selectedProduct ? "Edit Product" : "New Loan Product"}
          onClose={() => { setShowProductModal(false); resetProductForm(); }}
          onSave={() => {
            if (!validateProductForm()) return;
            if (selectedProduct) handleUpdateProduct({ preventDefault: () => {} });
            else handleCreateProduct({ preventDefault: () => {} });
          }}
          saving={submitting}
          saveLabel={selectedProduct ? "Save Changes" : "Create Product"}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-body mb-1.5">Product Name <span className="text-danger">*</span></label>
              <input
                type="text"
                value={productForm.product_name}
                onChange={(e) => setProductForm({ ...productForm, product_name: e.target.value })}
                className={inputClass(formErrors.product_name)}
                placeholder="e.g., Business Growth Loan"
                onFocus={(e) => e.target.select()}
              />
              {formErrors.product_name && <p className="text-danger text-xs mt-1">{formErrors.product_name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">Min Amount <span className="text-danger">*</span></label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-muted pointer-events-none">KES</span>
                  <input type="number" value={productForm.min_amount} onChange={(e) => setProductForm({ ...productForm, min_amount: e.target.value })} className={`${inputClass(formErrors.min_amount)} pl-10`} placeholder="0" onFocus={(e) => e.target.select()} />
                </div>
                {formErrors.min_amount && <p className="text-danger text-xs mt-1">{formErrors.min_amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">Max Amount</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-muted pointer-events-none">KES</span>
                  <input type="number" value={productForm.max_amount} onChange={(e) => setProductForm({ ...productForm, max_amount: e.target.value })} className={`${inputClass(formErrors.max_amount)} pl-10`} placeholder="Optional" onFocus={(e) => e.target.select()} />
                </div>
                {formErrors.max_amount && <p className="text-danger text-xs mt-1">{formErrors.max_amount}</p>}
              </div>
            </div>
          </div>
        </Modal>

        {/* Type Modal */}
        <Modal
          open={showTypeModal && !!selectedProduct}
          title={selectedType ? "Edit Type" : `Add Loan Type — ${selectedProduct?.product_name || ""}`}
          onClose={() => { setShowTypeModal(false); resetTypeForm(); }}
          onSave={() => {
            if (!validateTypeForm()) return;
            if (selectedType) handleUpdateType({ preventDefault: () => {} });
            else handleCreateType({ preventDefault: () => {} });
          }}
          saving={submitting}
          saveLabel={selectedType ? "Save Changes" : "Add Type"}
          wide
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-body mb-1.5">Type Name <span className="text-danger">*</span></label>
              <input type="text" value={typeForm.product_type} onChange={(e) => setTypeForm({ ...typeForm, product_type: e.target.value })} className={inputClass(formErrors.product_type)} placeholder="e.g., 4 Weeks Standard" onFocus={(e) => e.target.select()} />
              {formErrors.product_type && <p className="text-danger text-xs mt-1">{formErrors.product_type}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">Duration (Weeks) <span className="text-danger">*</span></label>
                <input type="number" value={typeForm.duration_weeks} onChange={(e) => setTypeForm({ ...typeForm, duration_weeks: e.target.value })} className={inputClass(formErrors.duration_weeks)} placeholder="4" onFocus={(e) => e.target.select()} />
                {formErrors.duration_weeks && <p className="text-danger text-xs mt-1">{formErrors.duration_weeks}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">Interest Rate (%) <span className="text-danger">*</span></label>
                <input type="number" step="0.01" value={typeForm.interest_rate} onChange={(e) => setTypeForm({ ...typeForm, interest_rate: e.target.value })} className={inputClass(formErrors.interest_rate)} placeholder="15" onFocus={(e) => e.target.select()} />
                {formErrors.interest_rate && <p className="text-danger text-xs mt-1">{formErrors.interest_rate}</p>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-body">
                  Processing Fee ({typeForm.processing_fee_mode === "percentage" ? "%" : "Fixed Amount"})
                </label>
                <div className="flex bg-surface p-0.5 rounded-lg border border-border-light">
                  <button type="button" onClick={() => setTypeForm({ ...typeForm, processing_fee_mode: "percentage" })}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${typeForm.processing_fee_mode === "percentage" ? "bg-card text-brand-primary shadow-sm font-medium" : "text-muted hover:text-body"}`}>
                    %
                  </button>
                  <button type="button" onClick={() => setTypeForm({ ...typeForm, processing_fee_mode: "fixed" })}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${typeForm.processing_fee_mode === "fixed" ? "bg-card text-brand-primary shadow-sm font-medium" : "text-muted hover:text-body"}`}>
                    KES
                  </button>
                </div>
              </div>
              <div className="relative">
                {typeForm.processing_fee_mode === "fixed" && (
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs text-muted pointer-events-none">KES</span>
                )}
                <input type="number" step="0.01" value={typeForm.processing_fee_rate} onChange={(e) => setTypeForm({ ...typeForm, processing_fee_rate: e.target.value })}
                  className={`${inputClass(false)} ${typeForm.processing_fee_mode === "fixed" ? "pl-10" : ""}`}
                  placeholder="0" onFocus={(e) => e.target.select()} />
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
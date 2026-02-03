import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/userAuth";
import { API_BASE_URL } from "../../../config.js";
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

  // Modal States
  const [showProductModal, setShowProductModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // Notification State
  const [notification, setNotification] = useState(null);

  // Form States
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
    registration_fee: "0",
    penalty_rate: "0",
  });

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchProducts();
    }
  }, [profile]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE_URL}/api/loan-products?tenant_id=${profile.tenant_id}`
      );
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        await fetchTypes(profile.tenant_id);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTypes = async (tenantId) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/loan-products/types?tenant_id=${tenantId}`
      );
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
    if (!productForm.product_name.trim()) {
      errors.product_name = "Product name is required";
    }
    if (!productForm.min_amount || parseFloat(productForm.min_amount) <= 0) {
      errors.min_amount = "Min amount must be greater than 0";
    }
    if (
      productForm.max_amount &&
      parseFloat(productForm.max_amount) < parseFloat(productForm.min_amount)
    ) {
      errors.max_amount = "Max amount must be greater than min amount";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateTypeForm = () => {
    const errors = {};
    if (!typeForm.product_type.trim()) {
      errors.product_type = "Type name is required";
    }
    if (!typeForm.duration_weeks || parseInt(typeForm.duration_weeks) <= 0) {
      errors.duration_weeks = "Duration must be greater than 0";
    }
    if (!typeForm.interest_rate || parseFloat(typeForm.interest_rate) < 0) {
      errors.interest_rate = "Interest rate must be 0 or greater";
    }
    if (parseFloat(typeForm.processing_fee_rate) < 0) {
      errors.processing_fee_rate = "Processing fee cannot be negative";
    }
    if (parseFloat(typeForm.registration_fee) < 0) {
      errors.registration_fee = "Registration fee cannot be negative";
    }
    if (parseFloat(typeForm.penalty_rate) < 0) {
      errors.penalty_rate = "Penalty rate cannot be negative";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          tenant_id: profile.tenant_id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts([data.data, ...products]);
        setShowProductModal(false);
        resetProductForm();
        showNotification("Product created successfully");
      } else {
        showNotification(data.error || "Failed to create product", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!validateProductForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/loan-products/${selectedProduct.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productForm),
        }
      );
      const data = await res.json();
      if (data.success) {
        setProducts(
          products.map((p) => (p.id === selectedProduct.id ? data.data : p))
        );
        setShowProductModal(false);
        resetProductForm();
        showNotification("Product updated successfully");
      } else {
        showNotification(data.error || "Failed to update product", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this product? This will also delete all associated product types."
      )
    )
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-products/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setProducts(products.filter((p) => p.id !== id));
        delete productTypes[id];
        showNotification("Product deleted successfully");
      } else {
        showNotification(data.error || "Failed to delete product", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    }
  };

  const handleCreateType = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !validateTypeForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-products/types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...typeForm,
          tenant_id: profile.tenant_id,
          loan_product_id: selectedProduct.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setProductTypes((prev) => ({
          ...prev,
          [selectedProduct.id]: [data.data, ...(prev[selectedProduct.id] || [])],
        }));
        setShowTypeModal(false);
        resetTypeForm();
        showNotification("Product type created successfully");
      } else {
        showNotification(data.error || "Failed to create type", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateType = async (e) => {
    e.preventDefault();
    if (!selectedType || !validateTypeForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/loan-products/types/${selectedType.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(typeForm),
        }
      );
      const data = await res.json();
      if (data.success) {
        setProductTypes((prev) => ({
          ...prev,
          [selectedProduct.id]: prev[selectedProduct.id].map((t) =>
            t.id === selectedType.id ? data.data : t
          ),
        }));
        setShowTypeModal(false);
        resetTypeForm();
        showNotification("Product type updated successfully");
      } else {
        showNotification(data.error || "Failed to update type", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteType = async (productId, typeId) => {
    if (
      !window.confirm("Are you sure you want to delete this product type?")
    )
      return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/loan-products/types/${typeId}`,
        {
          method: "DELETE",
        }
      );
      const data = await res.json();
      if (data.success) {
        setProductTypes((prev) => ({
          ...prev,
          [productId]: prev[productId].filter((t) => t.id !== typeId),
        }));
        showNotification("Product type deleted successfully");
      } else {
        showNotification(data.error || "Failed to delete type", "error");
      }
    } catch (err) {
      showNotification(err.message || "An error occurred", "error");
    }
  };

  const resetProductForm = () => {
    setProductForm({ product_name: "", min_amount: "", max_amount: "" });
    setSelectedProduct(null);
    setFormErrors({});
  };

  const resetTypeForm = () => {
    setTypeForm({
      product_type: "",
      duration_weeks: "",
      interest_rate: "",
      processing_fee_rate: "0",
      registration_fee: "0",
      penalty_rate: "0",
    });
    setSelectedType(null);
    setFormErrors({});
  };

  const openEditProductModal = (product) => {
    setSelectedProduct(product);
    setProductForm({
      product_name: product.product_name,
      min_amount: product.min_amount,
      max_amount: product.max_amount || "",
    });
    setFormErrors({});
    setShowProductModal(true);
  };

  const openEditTypeModal = (product, type) => {
    setSelectedProduct(product);
    setSelectedType(type);
    setTypeForm({
      product_type: type.product_type,
      duration_weeks: type.duration_weeks,
      interest_rate: type.interest_rate,
      processing_fee_rate: type.processing_fee_rate,
      registration_fee: type.registration_fee,
      penalty_rate: type.penalty_rate,
    });
    setFormErrors({});
    setShowTypeModal(true);
  };

  const openCreateTypeModal = (product) => {
    setSelectedProduct(product);
    setSelectedType(null);
    resetTypeForm();
    setShowTypeModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 px-4">
        <div className="bg-white border-l-4 border-red-500 rounded-r-lg shadow-md p-6 max-w-md w-full">
          <div className="flex items-center gap-3 text-red-700">
            <ExclamationTriangleIcon className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-bold">Error Loading Products</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchProducts}
            className="mt-6 w-full bg-red-50 text-red-700 px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-100"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-brand-surface p-6 md:p-10 font-body">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Notification */}
        {notification && (
          <div
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl transition-all animate-in slide-in-from-top-5 duration-300 ${
              notification.type === "success"
                ? "bg-white border-l-4 border-accent text-gray-800 ring-1 ring-gray-100"
                : "bg-white border-l-4 border-red-500 text-gray-800 ring-1 ring-gray-100"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircleIcon className="w-6 h-6 text-accent" />
            ) : (
              <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
            )}
            <div>
              <p className="font-semibold">
                {notification.type === "success" ? "Success" : "Error"}
              </p>
              <p className="text-sm text-gray-600">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 hover:bg-gray-100 p-1 rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-heading font-bold text-gray-600 tracking-tight">
              Loan Products
            </h1>
            <p className="text-gray-500 text-xs mt-1 max-w-2xl">
              Configure and manage your lending portfolio. Define product types
              and terms.
            </p>
          </div>
          <button
            onClick={() => {
              resetProductForm();
              setShowProductModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl hover:bg-brand-primary/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 font-semibold text-sm"
          >
            <PlusIcon className="w-5 h-5" />
            New Product
          </button>
        </div>

        {/* Products List */}
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="max-w-xs mx-auto">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <BanknotesIcon className="w-10 h-10 text-brand-primary" />
              </div>
              <h3 className="text-xl font-heading font-bold text-gray-900 mb-2">
                No Products Defined
              </h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Your portfolio is empty. Add your first loan product to get
                started.
              </p>
              <button
                onClick={() => {
                  resetProductForm();
                  setShowProductModal(true);
                }}
                className="w-full bg-brand-primary text-white px-6 py-3 rounded-xl hover:bg-brand-primary/90 transition-colors font-semibold shadow-sm"
              >
                Create Product
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Product Header */}
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-primary/10 rounded-lg text-brand-primary">
                      <BanknotesIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-heading font-bold text-gray-900">
                        {product.product_name}
                      </h2>
                      <div className="flex gap-4 text-sm mt-1">
                        <span className="text-gray-500">
                          Min:{" "}
                          <span className="font-medium text-gray-900">
                            {Number(product.min_amount).toLocaleString()}
                          </span>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-500">
                          Max:{" "}
                          <span className="font-medium text-gray-900">
                            {product.max_amount
                              ? Number(product.max_amount).toLocaleString()
                              : "Unlimited"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditProductModal(product)}
                      className="p-2 text-gray-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Product Details"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Product"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Product Types Grid */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                      Loan Types & Terms
                    </h3>
                    <button
                      onClick={() => openCreateTypeModal(product)}
                      className="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1.5 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Add Type
                    </button>
                  </div>

                  {productTypes[product.id]?.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {productTypes[product.id].map((type) => (
                        <div
                          key={type.id}
                          className="relative bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-primary/40 hover:shadow-sm transition-all group/card"
                        >
                          <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity bg-white">
                            <button
                              onClick={() => openEditTypeModal(product, type)}
                              className="p-1.5 text-gray-400 hover:text-brand-primary rounded-md"
                            >
                              <PencilIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteType(product.id, type.id)
                              }
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-md"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mb-3">
                            <h4 className="font-bold text-gray-900">
                              {type.product_type}
                            </h4>
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                              <ClockIcon className="w-3.5 h-3.5" />
                              {type.duration_weeks} Weeks
                            </div>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-gray-100">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Interest</span>
                              <span className="font-semibold text-gray-900">
                                {type.interest_rate}%
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Process. Fee</span>
                              <span className="font-medium text-gray-700">
                                {type.processing_fee_rate}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-500 mb-3">
                        No variations defined for this product yet.
                      </p>
                      <button
                        onClick={() => openCreateTypeModal(product)}
                        className="text-xs font-semibold bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                      >
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
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-heading font-bold text-gray-900">
                  {selectedProduct ? "Edit Product" : "New Loan Product"}
                </h2>
                <button
                  onClick={() => {
                    setShowProductModal(false);
                    resetProductForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form
                onSubmit={
                  selectedProduct ? handleUpdateProduct : handleCreateProduct
                }
                className="p-6 space-y-5"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={productForm.product_name}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        product_name: e.target.value,
                      })
                    }
                    className={`block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                      formErrors.product_name
                        ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                        : ""
                    }`}
                    placeholder="e.g., Business Growth Loan"
                  />
                  {formErrors.product_name && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {formErrors.product_name}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Min Amount <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">KES</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.min_amount}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            min_amount: e.target.value,
                          })
                        }
                        className={`block w-full pl-12 rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                          formErrors.min_amount ? "border-red-300" : ""
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    {formErrors.min_amount && (
                      <p className="text-red-600 text-xs mt-1.5 font-medium">
                        {formErrors.min_amount}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Max Amount
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 sm:text-sm">KES</span>
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.max_amount}
                        onChange={(e) =>
                          setProductForm({
                            ...productForm,
                            max_amount: e.target.value,
                          })
                        }
                        className={`block w-full pl-12 rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                          formErrors.max_amount ? "border-red-300" : ""
                        }`}
                        placeholder="Optional"
                      />
                    </div>
                    {formErrors.max_amount && (
                      <p className="text-red-600 text-xs mt-1.5 font-medium">
                        {formErrors.max_amount}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductModal(false);
                      resetProductForm();
                    }}
                    className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? "Saving..."
                      : selectedProduct
                      ? "Save Changes"
                      : "Create Product"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Type Modal */}
        {showTypeModal && selectedProduct && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all scale-100">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-heading font-bold text-gray-900">
                    {selectedType ? "Edit Type" : "Add Loan Type"}
                  </h2>
                  <p className="text-xs text-brand-primary font-medium mt-0.5">
                    {selectedProduct.product_name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTypeModal(false);
                    resetTypeForm();
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form
                onSubmit={selectedType ? handleUpdateType : handleCreateType}
                className="p-6 space-y-5"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Type Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={typeForm.product_type}
                    onChange={(e) =>
                      setTypeForm({ ...typeForm, product_type: e.target.value })
                    }
                    className={`block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                      formErrors.product_type ? "border-red-300" : ""
                    }`}
                    placeholder="e.g., 4 Weeks Standard"
                  />
                  {formErrors.product_type && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {formErrors.product_type}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Duration (Weeks) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={typeForm.duration_weeks}
                      onChange={(e) =>
                        setTypeForm({
                          ...typeForm,
                          duration_weeks: e.target.value,
                        })
                      }
                      className={`block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                        formErrors.duration_weeks ? "border-red-300" : ""
                      }`}
                      placeholder="4"
                    />
                    {formErrors.duration_weeks && (
                      <p className="text-red-600 text-xs mt-1.5 font-medium">
                        {formErrors.duration_weeks}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Interest Rate (%) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={typeForm.interest_rate}
                      onChange={(e) =>
                        setTypeForm({
                          ...typeForm,
                          interest_rate: e.target.value,
                        })
                      }
                      className={`block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors ${
                        formErrors.interest_rate ? "border-red-300" : ""
                      }`}
                      placeholder="15"
                    />
                    {formErrors.interest_rate && (
                      <p className="text-red-600 text-xs mt-1.5 font-medium">
                        {formErrors.interest_rate}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Processing Fee (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={typeForm.processing_fee_rate}
                    onChange={(e) =>
                      setTypeForm({
                        ...typeForm,
                        processing_fee_rate: e.target.value,
                      })
                    }
                    className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-brand-primary focus:ring-brand-primary/20 sm:text-sm py-2.5 transition-colors"
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-4 pt-4 mt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTypeModal(false);
                      resetTypeForm();
                    }}
                    className="flex-1 px-4 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-medium hover:bg-brand-primary/90 transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? "Saving..."
                      : selectedType
                      ? "Save Changes"
                      : "Add Type"}
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
import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/userAuth";
import { apiFetch } from "../../utils/api";
import {
  PlusIcon,
  ChartBarIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import SkeletonPage from "../../components/Skeleton";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";

export default function Scoring() {
  const { profile } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const [formData, setFormData] = useState({
    rule_name: "",
    field: "repayment_rate",
    operator: ">",
    value: "",
    score_impact: "",
    is_active: true,
  });

  const [formErrors, setFormErrors] = useState({});

  const fieldOptions = [
    { value: "repayment_rate", label: "Repayment Rate %" },
    { value: "missed_payments", label: "Missed Payments" },
    { value: "totalLoans", label: "Total Loans" },
    { value: "completionRate", label: "Completion Rate %" },
  ];

  const fieldLabels = {
    repayment_rate: "Repayment Rate %",
    missed_payments: "Missed Payments",
    totalLoans: "Total Loans",
    completionRate: "Completion Rate %",
  };

  const operatorOptions = [
    { value: ">", label: "Greater than (>)" },
    { value: "<", label: "Less than (<)" },
    { value: ">=", label: "Greater or equal (>=)" },
    { value: "<=", label: "Less or equal (<=)" },
    { value: "==", label: "Equals (==)" },
  ];

  const operatorLabels = {
    ">": "Greater than (>)",
    "<": "Less than (<)",
    ">=": "Greater or equal (>=)",
    "<=": "Less or equal (<=)",
    "==": "Equals (==)",
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchRules();
    }
  }, [profile]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") =>
    setNotification({ message, type });

  const fetchRules = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/scoring/rules?tenant_id=${profile.tenant_id}`);
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError("Failed to load scoring rules");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.rule_name.trim()) {
      errors.rule_name = "Rule name is required";
    }
    if (formData.value === "") {
      errors.value = "Threshold value is required";
    }
    if (formData.score_impact === "") {
      errors.score_impact = "Score impact is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateRule = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/scoring/rules", {
        method: "POST",
        body: JSON.stringify({
          rule_name: formData.rule_name,
          rule_type: formData.score_impact >= 0 ? "positive" : "negative",
          condition: {
            field: formData.field,
            operator: formData.operator,
            value: Number(formData.value),
          },
          score_impact: Number(formData.score_impact),
          is_active: formData.is_active,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRules([data.data, ...rules]);
        setIsModalOpen(false);
        setFormData({
          rule_name: "",
          field: "repayment_rate",
          operator: ">",
          value: "",
          score_impact: "",
          is_active: true,
        });
        setFormErrors({});
        showNotification("Scoring rule created successfully");
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification("Failed to create scoring rule", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm("Are you sure you want to delete this scoring rule?")) return;
    try {
      const res = await apiFetch(`/api/scoring/rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setRules(rules.filter((rule) => rule.id !== id));
        showNotification("Rule deleted successfully");
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showNotification("Failed to delete scoring rule", "error");
    }
  };

  const inputClass = (hasError) =>
    `block w-full rounded-lg border bg-card text-sm py-2 px-3 transition-all outline-none placeholder:text-muted ${
      hasError
        ? "border-danger/40 focus:border-danger focus:ring-2 focus:ring-danger-fill"
        : "border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    }`;

  if (loading) {
    return <SkeletonPage />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-page px-4">
        <div className="bg-card border border-danger/20 rounded-2xl shadow-card p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-danger-fill rounded-xl flex items-center justify-center mx-auto mb-4">
            <ExclamationTriangleIcon className="w-6 h-6 text-danger" />
          </div>
          <h3 className="text-sm font-semibold text-heading mb-1">Error Loading Scoring Rules</h3>
          <p className="text-xs text-muted mb-6">{error}</p>
          <button
            onClick={fetchRules}
            className="w-full bg-danger text-white px-4 py-2 rounded-lg hover:bg-danger/90 transition-colors text-xs font-semibold"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page p-5 md:p-8 font-outfit">
      <div className="w-full space-y-6">
        {/* Notification */}
        {notification && (
          <div
            className={`fixed top-5 right-5 z-50 flex items-center gap-3 pl-4 pr-3 py-3 rounded-xl shadow-card border transition-all animate-in slide-in-from-top-3 duration-200 max-w-sm ${
              notification.type === "success"
                ? "bg-card border-border-light text-heading"
                : "bg-card border-border-light text-heading"
            }`}
          >
            <div
              className={`p-1 rounded-lg ${
                notification.type === "success" ? "bg-success-fill" : "bg-danger-fill"
              }`}
            >
              {notification.type === "success" ? (
                <CheckCircleIcon className="w-4 h-4 text-success-text" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-danger" />
              )}
            </div>
            <p className="text-sm text-body flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-surface rounded-lg transition-colors ml-1"
            >
              <XMarkIcon className="w-4 h-4 text-muted" />
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-heading tracking-tight">
              Scoring Settings
            </h1>
            <p className="text-muted text-xs mt-0.5">
              Define credit evaluation criteria and score impacts
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                rule_name: "",
                field: "repayment_rate",
                operator: ">",
                value: "",
                score_impact: "",
                is_active: true,
              });
              setFormErrors({});
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3.5 py-2 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs active:scale-95 font-medium"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            New Rule
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-card p-5 rounded-xl border border-border shadow-card flex items-center gap-4">
            <div className="p-2.5 bg-success-fill rounded-lg">
              <ChartBarIcon className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-heading">Active Rules</p>
              <p className="text-lg font-bold text-heading mt-0.5">
                {rules.filter((r) => r.is_active).length}
              </p>
            </div>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border shadow-card flex items-center gap-4">
            <div className="p-2.5 bg-info-fill rounded-lg">
              <ShieldCheckIcon className="w-4 h-4 text-info-text" />
            </div>
            <div>
              <p className="text-xs font-medium text-heading">Average Score</p>
              <p className="text-lg font-bold text-heading mt-0.5">712</p>
            </div>
          </div>

          <div className="bg-card p-5 rounded-xl border border-border shadow-card flex items-center gap-4">
            <div className="p-2.5 bg-warning-fill rounded-lg">
              <BeakerIcon className="w-4 h-4 text-warning-text" />
            </div>
            <div>
              <p className="text-xs font-medium text-heading">Calculation Model</p>
              <p className="text-lg font-bold text-heading mt-0.5">V1 Dynamic</p>
            </div>
          </div>
        </div>

        {/* Rules Section */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
            <h2 className="text-sm font-semibold text-heading">Scoring Rules</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface border-b border-border-light text-muted text-[10px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Rule Name</th>
                  <th className="px-5 py-3">Condition</th>
                  <th className="px-5 py-3 text-center">Impact</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-xs font-medium text-heading">{rule.rule_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono bg-surface border border-border-light px-2 py-1 rounded text-body font-medium">
                        {fieldLabels[rule.condition.field] || rule.condition.field}{" "}
                        {rule.condition.operator}{" "}
                        {rule.condition.value}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          rule.score_impact >= 0
                            ? "text-success-text bg-success-fill"
                            : "text-danger-text bg-danger-fill"
                        }`}
                      >
                        {rule.score_impact >= 0 ? "+" : ""}
                        {rule.score_impact} pts
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${
                          rule.is_active
                            ? "bg-success-fill text-success-text"
                            : "bg-surface text-muted border border-border-light"
                        }`}
                      >
                        {rule.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-muted hover:text-danger hover:bg-danger-fill rounded-lg transition-colors"
                        title="Delete rule"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-5 py-12 text-center text-xs text-muted">
                      No scoring rules defined yet. Click "New Rule" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Rule Modal */}
        <Modal
          open={isModalOpen}
          title="New Scoring Rule"
          onClose={() => {
            setIsModalOpen(false);
            setFormErrors({});
          }}
          onSave={handleCreateRule}
          saving={submitting}
          saveLabel="Create Rule"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-body mb-1.5">
                Rule Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                className={inputClass(formErrors.rule_name)}
                placeholder="e.g., Good Repayment History"
                onFocus={(e) => e.target.select()}
              />
              {formErrors.rule_name && (
                <p className="text-danger text-xs mt-1">{formErrors.rule_name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Field <span className="text-danger">*</span>
                </label>
                <CustomSelect
                  value={formData.field}
                  onChange={(val) => setFormData({ ...formData, field: val })}
                  options={fieldOptions}
                  fullWidth
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Operator <span className="text-danger">*</span>
                </label>
                <CustomSelect
                  value={formData.operator}
                  onChange={(val) => setFormData({ ...formData, operator: val })}
                  options={operatorOptions}
                  fullWidth
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Threshold Value <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className={inputClass(formErrors.value)}
                  placeholder="e.g., 90"
                  onFocus={(e) => e.target.select()}
                />
                {formErrors.value && (
                  <p className="text-danger text-xs mt-1">{formErrors.value}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Score Impact <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  value={formData.score_impact}
                  onChange={(e) => setFormData({ ...formData, score_impact: e.target.value })}
                  className={inputClass(formErrors.score_impact)}
                  placeholder="e.g., +50 or -30"
                  onFocus={(e) => e.target.select()}
                />
                {formErrors.score_impact && (
                  <p className="text-danger text-xs mt-1">{formErrors.score_impact}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 rounded text-brand-primary border-border focus:ring-brand-primary/20 accent-brand-primary cursor-pointer"
              />
              <label
                htmlFor="is_active"
                className="text-xs font-medium text-body cursor-pointer select-none"
              >
                Rule is Active
              </label>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

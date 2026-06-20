import { useState, useEffect } from "react";
import {
  AdjustmentsHorizontalIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  InformationCircleIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Modal from "../../components/Modal";
import CustomSelect from "../../components/CustomSelect";

export default function Limits() {
  const [limits, setLimits] = useState([
    { id: 1, grade: "A", scoreRange: "750 - 850", baseLimit: 50000, multiplier: 1.5, active: true },
    { id: 2, grade: "B", scoreRange: "650 - 749", baseLimit: 20000, multiplier: 1.2, active: true },
    { id: 3, grade: "C", scoreRange: "500 - 649", baseLimit: 5000, multiplier: 1.0, active: true },
    { id: 4, grade: "D", scoreRange: "300 - 499", baseLimit: 0, multiplier: 0, active: true },
  ]);

  const [globalMultiplier, setGlobalMultiplier] = useState(1.5);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLimit, setSelectedLimit] = useState(null);
  const [notification, setNotification] = useState(null);

  const [formData, setFormData] = useState({
    grade: "A",
    scoreRange: "",
    baseLimit: "",
    multiplier: "",
    active: true,
  });

  const [formErrors, setFormErrors] = useState({});

  const gradeOptions = [
    { value: "A", label: "Grade A" },
    { value: "B", label: "Grade B" },
    { value: "C", label: "Grade C" },
    { value: "D", label: "Grade D" },
  ];

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") =>
    setNotification({ message, type });

  const validateForm = () => {
    const errors = {};
    if (!formData.scoreRange.trim()) {
      errors.scoreRange = "Score range is required (e.g. 700 - 800)";
    }
    if (formData.baseLimit === "" || Number(formData.baseLimit) < 0) {
      errors.baseLimit = "Base limit must be a positive number";
    }
    if (formData.multiplier === "" || Number(formData.multiplier) < 0) {
      errors.multiplier = "Multiplier must be a positive number";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveTier = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) return;

    if (selectedLimit) {
      // Edit mode
      setLimits(
        limits.map((l) =>
          l.id === selectedLimit.id
            ? {
                ...l,
                grade: formData.grade,
                scoreRange: formData.scoreRange,
                baseLimit: Number(formData.baseLimit),
                multiplier: Number(formData.multiplier),
                active: formData.active,
              }
            : l
        )
      );
      showNotification("Tier configuration updated successfully");
    } else {
      // Add mode
      const newTier = {
        id: Date.now(),
        grade: formData.grade,
        scoreRange: formData.scoreRange,
        baseLimit: Number(formData.baseLimit),
        multiplier: Number(formData.multiplier),
        active: formData.active,
      };
      setLimits([...limits, newTier]);
      showNotification("New risk grade tier added successfully");
    }

    setIsModalOpen(false);
  };

  const openEditModal = (limit) => {
    setSelectedLimit(limit);
    setFormData({
      grade: limit.grade,
      scoreRange: limit.scoreRange,
      baseLimit: limit.baseLimit,
      multiplier: limit.multiplier,
      active: limit.active,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setSelectedLimit(null);
    setFormData({
      grade: "A",
      scoreRange: "",
      baseLimit: "",
      multiplier: "1.0",
      active: true,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDeleteTier = (id) => {
    if (!window.confirm("Are you sure you want to delete this limit configuration tier?")) return;
    setLimits(limits.filter((l) => l.id !== id));
    showNotification("Tier configuration removed");
  };

  const inputClass = (hasError) =>
    `block w-full rounded-lg border bg-card text-sm py-2 px-3 transition-all outline-none placeholder:text-muted ${
      hasError
        ? "border-danger/40 focus:border-danger focus:ring-2 focus:ring-danger-fill"
        : "border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
    }`;

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
              Limit Recommendations
            </h1>
            <p className="text-muted text-xs mt-0.5">
              Define how loan limits are suggested based on customer risk profiles
            </p>
          </div>
        </div>

        {/* Strategy Control Panel */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-fill rounded-lg">
              <AdjustmentsHorizontalIcon className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-heading">Recommended Limit Equation</p>
              <p className="text-[10px] text-muted mt-0.5">
                Dynamic calculations scaled per tier configuration
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border-light">
            <div className="space-y-2.5">
              <label className="block text-xs font-semibold text-heading uppercase tracking-wider">
                Global Multiplier
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={globalMultiplier}
                  onChange={(e) => setGlobalMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-brand-primary h-1 bg-surface rounded-lg cursor-pointer"
                />
                <span className="font-bold text-brand-primary text-base whitespace-nowrap">
                  {globalMultiplier.toFixed(1)}x
                </span>
              </div>
              <p className="text-[10px] text-muted">
                Multiplies the calculated limit based on overall portfolio health.
              </p>
            </div>

            <div className="p-4 bg-success-fill/20 rounded-xl border border-brand-primary/10 flex items-start gap-3">
              <InformationCircleIcon className="w-4 h-4 text-brand-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-brand-primary font-medium leading-relaxed">
                Limits are calculated as: <br />
                <code className="bg-card/70 border border-brand-primary/5 px-1.5 py-0.5 rounded font-bold text-[10px]">
                  Recommended Limit = Base Limit × Tier Multiplier × Global Factor
                </code>
              </p>
            </div>
          </div>
        </div>

        {/* Grade Limits Table */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border-light flex items-center justify-between">
            <h2 className="text-sm font-semibold text-heading">Tiered Limit Configuration</h2>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 bg-brand-primary text-white px-3 py-1.5 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs active:scale-95 font-medium"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              Add Tier
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface border-b border-border-light text-muted text-[10px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Risk Grade</th>
                  <th className="px-5 py-3">Score Range</th>
                  <th className="px-5 py-3">Base Limit</th>
                  <th className="px-5 py-3">Multiplier</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {limits.map((limit) => (
                  <tr key={limit.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            limit.grade === "A"
                              ? "bg-success-fill text-success-text"
                              : limit.grade === "B"
                              ? "bg-info-fill text-info-text"
                              : limit.grade === "C"
                              ? "bg-warning-fill text-warning-text"
                              : "bg-danger-fill text-danger-text"
                          }`}
                        >
                          {limit.grade}
                        </div>
                        <span className="font-semibold text-xs text-heading">
                          Grade {limit.grade}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono bg-surface border border-border-light px-2 py-1 rounded text-body font-medium">
                        {limit.scoreRange}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs font-medium text-heading">
                        KES {limit.baseLimit.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-muted">
                      {limit.multiplier}x
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider ${
                          limit.active
                            ? "bg-success-fill text-success-text"
                            : "bg-surface text-muted border border-border-light"
                        }`}
                      >
                        {limit.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(limit)}
                          className="p-1.5 text-muted hover:text-brand-primary hover:bg-success-fill rounded-lg transition-colors"
                          title="Edit tier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTier(limit.id)}
                          className="p-1.5 text-muted hover:text-danger hover:bg-danger-fill rounded-lg transition-colors"
                          title="Delete tier"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {limits.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center text-xs text-muted">
                      No tiered configurations defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Automated Adjustments */}
        <div className="bg-card p-5 rounded-xl border border-border shadow-card space-y-4">
          <h3 className="text-xs font-semibold text-heading uppercase tracking-wider">
            Smart Adjustment Rules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-border rounded-xl bg-surface/20 hover:shadow-card transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <ArrowTrendingUpIcon className="w-4 h-4 text-brand-primary" />
                <h4 className="font-semibold text-xs text-heading uppercase tracking-wider">
                  Auto-Increase Reward
                </h4>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Increase limit by <span className="font-semibold text-heading">20%</span> when a
                customer completes <span className="font-semibold text-heading">3 consecutive</span>{" "}
                loans without any arrears.
              </p>
            </div>

            <div className="p-4 border border-border rounded-xl bg-surface/20 hover:shadow-card transition-shadow">
              <div className="flex items-center gap-2 mb-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-danger" />
                <h4 className="font-semibold text-xs text-heading uppercase tracking-wider">
                  Missed Payment Guard
                </h4>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Reduce recommended limit by{" "}
                <span className="font-semibold text-heading">50%</span> immediately if a customer
                misses more than <span className="font-semibold text-heading">2 installments</span>.
              </p>
            </div>
          </div>
        </div>

        {/* Tier Modal */}
        <Modal
          open={isModalOpen}
          title={selectedLimit ? "Edit Tier" : "New Tier Configuration"}
          onClose={() => {
            setIsModalOpen(false);
            setFormErrors({});
          }}
          onSave={handleSaveTier}
          saveLabel={selectedLimit ? "Save Changes" : "Add Tier"}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-body mb-1.5">
                Risk Grade <span className="text-danger">*</span>
              </label>
              <CustomSelect
                value={formData.grade}
                onChange={(val) => setFormData({ ...formData, grade: val })}
                options={gradeOptions}
                fullWidth
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-body mb-1.5">
                Score Range <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={formData.scoreRange}
                onChange={(e) => setFormData({ ...formData, scoreRange: e.target.value })}
                className={inputClass(formErrors.scoreRange)}
                placeholder="e.g., 750 - 850"
                onFocus={(e) => e.target.select()}
              />
              {formErrors.scoreRange && (
                <p className="text-danger text-xs mt-1">{formErrors.scoreRange}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Base Limit (KES) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  value={formData.baseLimit}
                  onChange={(e) => setFormData({ ...formData, baseLimit: e.target.value })}
                  className={inputClass(formErrors.baseLimit)}
                  placeholder="e.g., 20000"
                  onFocus={(e) => e.target.select()}
                />
                {formErrors.baseLimit && (
                  <p className="text-danger text-xs mt-1">{formErrors.baseLimit}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-body mb-1.5">
                  Multiplier <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.multiplier}
                  onChange={(e) => setFormData({ ...formData, multiplier: e.target.value })}
                  className={inputClass(formErrors.multiplier)}
                  placeholder="e.g., 1.2"
                  onFocus={(e) => e.target.select()}
                />
                {formErrors.multiplier && (
                  <p className="text-danger text-xs mt-1">{formErrors.multiplier}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                id="active"
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded text-brand-primary border-border focus:ring-brand-primary/20 accent-brand-primary cursor-pointer"
              />
              <label
                htmlFor="active"
                className="text-xs font-medium text-body cursor-pointer select-none"
              >
                Tier is Active
              </label>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}

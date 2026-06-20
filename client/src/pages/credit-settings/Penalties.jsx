import { useState, useEffect } from "react";
import {
  ShieldCheckIcon,
  CalendarDaysIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowDownOnSquareIcon,
} from "@heroicons/react/24/outline";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";
import CustomSelect from "../../components/CustomSelect";
import SkeletonPage from "../../components/Skeleton";

const DEFAULT_SETTINGS = {
  penalties_enabled: true,
  penalty_scope: "per_installment",
  penalty_type: "daily",
  penalty_rate: 5,
  penalty_rate_mode: "fixed",
  penalty_grace_days: 3,
  apply_every_days: 1,
  max_penalty_per_installment: 100,
  max_penalty_per_loan: 500,
  send_penalty_sms: true,
  send_waiver_sms: true,
};

export default function PenaltySettings() {
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const scopeOptions = [
    { value: "per_installment", label: "Per Installment" },
    { value: "whole_loan", label: "Whole Loan" },
  ];

  const typeOptions = [
    { value: "daily", label: "Daily Accumulation" },
    { value: "flat", label: "Flat Fee" },
  ];

  const rateModeOptions = [
    { value: "fixed", label: "Fixed Amount (KES)" },
    { value: "percentage", label: "Percentage (%)" },
  ];

  const fetchSettings = async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      setError(null);

      const { data, fetchError } = await supabase
        .from("loan_penalty_settings")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (fetchError) {
        if (fetchError.code !== "PGRST116") {
          throw fetchError;
        }
      } else if (data) {
        setSettingsId(data.id);
        setSettings({
          penalties_enabled: data.penalties_enabled,
          penalty_scope: data.penalty_scope,
          penalty_type: data.penalty_type,
          penalty_rate: parseFloat(data.penalty_rate),
          penalty_rate_mode: data.penalty_rate_mode,
          penalty_grace_days: data.penalty_grace_days,
          apply_every_days: data.apply_every_days,
          max_penalty_per_installment: data.max_penalty_per_installment,
          max_penalty_per_loan: data.max_penalty_per_loan,
          send_penalty_sms: data.send_penalty_sms,
          send_waiver_sms: data.send_waiver_sms,
        });
      } else {
        setSettingsId(null);
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError("Failed to load penalty settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettings();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") =>
    setNotification({ message, type });

  const saveSettings = async () => {
    if (!profile?.tenant_id) {
      showNotification("Profile not loaded", "error");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data = {
        tenant_id: profile.tenant_id,
        penalties_enabled: settings.penalties_enabled,
        penalty_scope: settings.penalty_scope,
        penalty_type: settings.penalty_type,
        penalty_rate: settings.penalty_rate,
        penalty_rate_mode: settings.penalty_rate_mode,
        penalty_grace_days: settings.penalty_grace_days,
        apply_every_days: settings.apply_every_days,
        max_penalty_per_installment: settings.max_penalty_per_installment,
        max_penalty_per_loan: settings.max_penalty_per_loan,
        send_penalty_sms: settings.send_penalty_sms,
        send_waiver_sms: settings.send_waiver_sms,
      };

      if (settingsId) {
        const { error: updateError } = await supabase
          .from("loan_penalty_settings")
          .update(data)
          .eq("id", settingsId)
          .eq("tenant_id", profile.tenant_id);

        if (updateError) throw updateError;
      } else {
        const { data: result, error: insertError } = await supabase
          .from("loan_penalty_settings")
          .insert(data)
          .select()
          .single();

        if (insertError) throw insertError;
        setSettingsId(result.id);
      }

      showNotification("Penalty settings saved successfully");
    } catch (err) {
      console.error("Error saving settings:", err);
      showNotification("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = () =>
    "block w-full rounded-lg border bg-card text-sm py-2 px-3 transition-all outline-none placeholder:text-muted border-border hover:border-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10";

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
          <h3 className="text-sm font-semibold text-heading mb-1">Error Loading Penalty Settings</h3>
          <p className="text-xs text-muted mb-6">{error}</p>
          <button
            onClick={fetchSettings}
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
      <div className="max-w-4xl mx-auto space-y-6">
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
              Penalty Settings
            </h1>
            <p className="text-muted text-xs mt-0.5">
              Configure automated late payment penalty rules and rates
            </p>
          </div>
        </div>

        {/* Enable System Card */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="p-5 flex justify-between items-center bg-surface/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-fill rounded-lg">
                <ShieldCheckIcon className="w-4 h-4 text-brand-primary" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-heading">Enable Penalty System</h3>
                <p className="text-[10px] text-muted mt-0.5">
                  Activate automated penalty calculation for overdue loans
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.penalties_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, penalties_enabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
            </label>
          </div>
        </div>

        {/* Main Settings Card */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-4">
              Penalty Configuration
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              <Field
                label="Penalty Scope"
                icon={CalendarDaysIcon}
                tooltip="Choose whether penalties apply per individual installment or to the entire loan amount"
              >
                <CustomSelect
                  value={settings.penalty_scope}
                  onChange={(val) => setSettings({ ...settings, penalty_scope: val })}
                  options={scopeOptions}
                  fullWidth
                />
              </Field>

              <Field
                label="Penalty Type"
                icon={ClockIcon}
                tooltip="Daily penalties accumulate each day, while flat penalties are charged once as a single event"
              >
                <CustomSelect
                  value={settings.penalty_type}
                  onChange={(val) => setSettings({ ...settings, penalty_type: val })}
                  options={typeOptions}
                  fullWidth
                />
              </Field>

              <Field
                label="Penalty Rate Mode"
                icon={CurrencyDollarIcon}
                tooltip="Choose whether the penalty rate represents a fixed amount or a percentage of the outstanding balance"
              >
                <CustomSelect
                  value={settings.penalty_rate_mode}
                  onChange={(val) => setSettings({ ...settings, penalty_rate_mode: val })}
                  options={rateModeOptions}
                  fullWidth
                />
              </Field>

              <Field
                label={`Penalty Rate (${
                  settings.penalty_rate_mode === "percentage" ? "%" : "KES"
                })`}
                icon={CurrencyDollarIcon}
                tooltip="The penalty rate to apply when a payment goes past due"
              >
                <input
                  type="number"
                  step={settings.penalty_rate_mode === "percentage" ? "0.1" : "1"}
                  min="0"
                  value={settings.penalty_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, penalty_rate: Number(e.target.value) })
                  }
                  className={inputClass()}
                />
              </Field>

              <Field
                label="Grace Period (Days)"
                icon={ClockIcon}
                tooltip="The number of days after the payment due date before penalties start accumulating"
              >
                <input
                  type="number"
                  min="0"
                  value={settings.penalty_grace_days}
                  onChange={(e) =>
                    setSettings({ ...settings, penalty_grace_days: Number(e.target.value) })
                  }
                  className={inputClass()}
                />
              </Field>

              <Field
                label="Apply Penalty Every (Days)"
                icon={CalendarDaysIcon}
                tooltip="Frequency of penalty application (e.g. 1 applies daily, 7 applies weekly)"
              >
                <input
                  type="number"
                  min="1"
                  value={settings.apply_every_days}
                  onChange={(e) =>
                    setSettings({ ...settings, apply_every_days: Number(e.target.value) })
                  }
                  className={inputClass()}
                />
              </Field>
            </div>
          </div>

          <div className="pt-6 border-t border-border-light">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-4">
              Penalty Caps & Limits
            </h3>
            <div className="grid md:grid-cols-2 gap-5">
              <Field
                label="Maximum Penalty Per Installment"
                icon={ExclamationTriangleIcon}
                tooltip="Maximum penalty that can be charged on a single installment. Leave empty for no limit."
              >
                <input
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={settings.max_penalty_per_installment ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_penalty_per_installment:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className={inputClass()}
                />
              </Field>

              <Field
                label="Maximum Penalty Per Loan"
                icon={ExclamationTriangleIcon}
                tooltip="Maximum cumulative penalty charged across the entire life of the loan. Leave empty for no limit."
              >
                <input
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={settings.max_penalty_per_loan ?? ""}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_penalty_per_loan:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className={inputClass()}
                />
              </Field>
            </div>
          </div>

          <div className="pt-6 border-t border-border-light">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-4">
              Notification Settings
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-4 bg-surface/20 rounded-xl border border-border hover:border-brand-primary/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success-fill rounded-lg">
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-heading block">
                      Send Penalty SMS
                    </span>
                    <span className="text-[10px] text-muted">
                      Notify borrowers automatically when penalties are applied
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.send_penalty_sms}
                  onChange={(e) =>
                    setSettings({ ...settings, send_penalty_sms: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-brand-primary border-border focus:ring-brand-primary/20 accent-brand-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-surface/20 rounded-xl border border-border hover:border-brand-primary/30 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success-fill rounded-lg">
                    <ChatBubbleLeftRightIcon className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-heading block">
                      Send Waiver SMS
                    </span>
                    <span className="text-[10px] text-muted">
                      Notify borrowers automatically when late fees or penalties are waived
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.send_waiver_sms}
                  onChange={(e) =>
                    setSettings({ ...settings, send_waiver_sms: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-brand-primary border-border focus:ring-brand-primary/20 accent-brand-primary cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-lg hover:bg-brand-primary/90 transition-all shadow-btn text-xs font-semibold active:scale-95 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Spinner size="sm" />
                  Saving changes...
                </>
              ) : (
                <>
                  <ArrowDownOnSquareIcon className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children, tooltip }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-xs font-semibold text-heading">
        <Icon className="w-3.5 h-3.5 text-brand-primary" />
        {label}
        {tooltip && (
          <div className="group relative ml-0.5">
            <InformationCircleIcon className="w-3.5 h-3.5 text-muted cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 p-2 bg-neutral-800 text-white text-[10px] rounded shadow-lg z-10 font-normal leading-normal">
              {tooltip}
            </div>
          </div>
        )}
      </label>
      {children}
    </div>
  );
}

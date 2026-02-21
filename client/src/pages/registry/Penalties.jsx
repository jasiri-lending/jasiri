import { useState, useEffect, useRef } from "react";
import {
  DollarSign,
  Calendar,
  Shield,
  MessageSquare,
  Clock,
  Save,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { useAuth } from "../../hooks/userAuth.js";

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
  const [saved, setSaved] = useState(false);
  const [settingsId, setSettingsId] = useState(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const fetchSettings = async () => {
    if (!profile?.tenant_id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch penalty settings from Supabase
      const { data, error: fetchError } = await supabase
        .from('loan_penalty_settings')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .maybeSingle(); // Use maybeSingle to handle no rows found

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          console.log('No settings found, using defaults');
        } else {
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
        // Reset to defaults if no settings found for this tenant
        // This prevents data leakage from a previous session
        setSettingsId(null);
        setSettings(DEFAULT_SETTINGS);
        console.log('No settings found for tenant, reset to defaults');
      }

    } catch (err) {
      console.error('Error fetching settings:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchSettings();
    }
  }, [profile?.tenant_id]);

  const saveSettings = async () => {
    if (!profile?.tenant_id) {
      setError('Profile not loaded');
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

      // Save or update settings in Supabase
      if (settingsId) {
        const { data: result, error: updateError } = await supabase
          .from('loan_penalty_settings')
          .update(data)
          .eq('id', settingsId)
          .eq('tenant_id', profile.tenant_id)
          .select()
          .single();

        if (updateError) throw updateError;
      } else {
        const { data: result, error: insertError } = await supabase
          .from('loan_penalty_settings')
          .insert(data)
          .select()
          .single();

        if (insertError) throw insertError;
        setSettingsId(result.id);
      }

      console.log('Settings saved:', data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };



  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ backgroundColor: "#d9e2e8" }}
    >
      <div className="max-w-5xl mx-auto">


        {saved && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Settings saved successfully</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <span className="text-red-800 font-medium">Error: {error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div
            className="p-6 border-b border-slate-200"
            style={{ background: "linear-gradient(to right, #f8fafc, #ffffff)" }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div
                  className="p-2.5 rounded-lg"
                  style={{ backgroundColor: "rgba(88, 106, 177, 0.1)" }}
                >
                  <Shield
                    className="w-5 h-5"
                    style={{ color: "#586ab1" }}
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-600 text-lg">Enable Penalty System</h3>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Activate automated penalty calculation for overdue loans
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.penalties_enabled}
                  onChange={(e) => setSettings({ ...settings, penalties_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div
                  className="w-14 h-7 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all"
                  style={{ backgroundColor: settings.penalties_enabled ? "#586ab1" : undefined }}
                ></div>
              </label>
            </div>
          </div>

          <div className="p-8">
            <h3 className="text-lg  text-slate-600 mb-6 flex items-center gap-2">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: "#586ab1" }}
              ></div>
              Penalty Configuration
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <Field label="Penalty Scope" icon={Calendar} tooltip="Choose whether penalties apply per installment or to the whole loan">
                <select
                  value={settings.penalty_scope}
                  onChange={(e) => setSettings({ ...settings, penalty_scope: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors bg-white text-slate-600"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <option value="per_installment">Per Installment</option>
                  <option value="whole_loan">Whole Loan</option>
                </select>
              </Field>

              <Field label="Penalty Type" icon={Clock} tooltip="Daily penalties accumulate each day, flat penalties are charged once">
                <select
                  value={settings.penalty_type}
                  onChange={(e) => setSettings({ ...settings, penalty_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors bg-white text-slate-600"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <option value="daily">Daily Accumulation</option>
                  <option value="flat">Flat Fee</option>
                </select>
              </Field>

              <Field label="Penalty Rate Mode" icon={DollarSign} tooltip="Fixed amount or percentage of outstanding balance">
                <select
                  value={settings.penalty_rate_mode}
                  onChange={(e) => setSettings({ ...settings, penalty_rate_mode: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors bg-white text-slate-600"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </Field>

              <Field label={`Penalty Rate ${settings.penalty_rate_mode === 'percentage' ? '(%)' : '(Amount)'}`} icon={DollarSign} tooltip="The amount or percentage to charge as penalty">
                <input
                  type="number"
                  step={settings.penalty_rate_mode === 'percentage' ? '0.1' : '1'}
                  min="0"
                  value={settings.penalty_rate}
                  onChange={(e) => setSettings({ ...settings, penalty_rate: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                />
              </Field>

              <Field label="Grace Period (Days)" icon={Clock} tooltip="Number of days after due date before penalties start">
                <input
                  type="number"
                  min="0"
                  value={settings.penalty_grace_days}
                  onChange={(e) => setSettings({ ...settings, penalty_grace_days: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                />
              </Field>

              <Field label="Apply Penalty Every (Days)" icon={Calendar} tooltip="Frequency of penalty application for daily penalties">
                <input
                  type="number"
                  min="1"
                  value={settings.apply_every_days}
                  onChange={(e) => setSettings({ ...settings, apply_every_days: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors"
                  style={{
                    outline: "none",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                    borderColor: "#586ab1"
                  }}
                  onFocus={(e) => {
                    e.target.style.outline = "none";
                    e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = "none";
                  }}
                />
              </Field>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-600 mb-6 flex items-center gap-2">
                <div
                  className="w-1 h-5 rounded-full"
                  style={{ backgroundColor: "#586ab1" }}
                ></div>
                Penalty Caps & Limits
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Maximum Penalty Per Installment" icon={AlertCircle} tooltip="Leave empty for no limit">
                  <input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={settings.max_penalty_per_installment ?? ""}
                    onChange={(e) => setSettings({ ...settings, max_penalty_per_installment: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors"
                    style={{
                      outline: "none",
                      boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                      borderColor: "#586ab1"
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = "none";
                      e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </Field>

                <Field label="Maximum Penalty Per Loan" icon={AlertCircle} tooltip="Leave empty for no limit">
                  <input
                    type="number"
                    min="0"
                    placeholder="No limit"
                    value={settings.max_penalty_per_loan ?? ""}
                    onChange={(e) => setSettings({ ...settings, max_penalty_per_loan: e.target.value === "" ? null : Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 transition-colors"
                    style={{
                      outline: "none",
                      boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)",
                      borderColor: "#586ab1"
                    }}
                    onFocus={(e) => {
                      e.target.style.outline = "none";
                      e.target.style.boxShadow = "0 0 0 2px rgba(88, 106, 177, 0.2)";
                    }}
                    onBlur={(e) => {
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div
            className="p-8 border-t border-slate-200"
            style={{ background: "linear-gradient(to right, #f8fafc, rgba(88, 106, 177, 0.03))" }}
          >
            <h3 className="text-lg font-semibold text-slate-600 mb-6 flex items-center gap-2">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: "#586ab1" }}
              ></div>
              Notification Settings
            </h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: "rgba(88, 106, 177, 0.1)" }}
                  >
                    <MessageSquare
                      className="w-5 h-5"
                      style={{ color: "#586ab1" }}
                    />
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 block">Send Penalty SMS</span>
                    <span className="text-sm text-slate-600">Notify borrowers when penalties are applied</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.send_penalty_sms}
                  onChange={(e) => setSettings({ ...settings, send_penalty_sms: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 focus:ring-2"
                  style={{
                    color: "#586ab1",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)"
                  }}
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg transition-colors"
                    style={{ backgroundColor: "rgba(88, 106, 177, 0.1)" }}
                  >
                    <MessageSquare
                      className="w-5 h-5"
                      style={{ color: "#586ab1" }}
                    />
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 block">Send Waiver SMS</span>
                    <span className="text-sm text-slate-600">Notify borrowers when penalties are waived</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.send_waiver_sms}
                  onChange={(e) => setSettings({ ...settings, send_waiver_sms: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 focus:ring-2"
                  style={{
                    color: "#586ab1",
                    boxShadow: "0 0 0 2px rgba(88, 106, 177, 0.2)"
                  }}
                />
              </label>
            </div>
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <button
              onClick={saveSettings}
              disabled={saving}
              style={{ backgroundColor: "#586ab1" }}
              className="w-full hover:opacity-90 text-white py-4 rounded-xl flex justify-center items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
                  ></div>
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
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
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Icon
          className="w-4 h-4"
          style={{ color: "#586ab1" }}
        />
        {label}
        {tooltip && (
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-600 text-white text-xs rounded-lg shadow-xl z-10">
              {tooltip}
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
            </div>
          </div>
        )}
      </label>
      {children}
    </div>
  );
}
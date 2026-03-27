import { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import { apiFetch } from "../../../utils/api.js";

export default function TenantMpesaForm() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [isLoadingC2B, setIsLoadingC2B] = useState(false);
  const [isLoadingB2C, setIsLoadingB2C] = useState(false);

  const [c2bData, setC2bData] = useState({
    payment_type: "paybill",
    paybill_number: "",
    till_number: "",
    shortcode: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    confirmation_url: "",
    validation_url: "",
    callback_url: "",
    environment: "sandbox",
    is_active: true,
  });

  const [b2cData, setB2cData] = useState({
    shortcode: "",
    consumer_key: "",
    consumer_secret: "",
    initiator_name: "",
    security_credential: "",
    callback_url: "",
    environment: "sandbox",
    is_active: true,
  });

  // Fetch tenants
  useEffect(() => {
    async function loadTenants() {
      const { data, error } = await supabase.from("tenants").select("id, name");
      if (error) console.error("Error fetching tenants", error);
      else setTenants(data);
    }
    loadTenants();
  }, []);

  // Fetch existing configs when tenant changes
  useEffect(() => {
    if (selectedTenantId) {
      loadConfigs(selectedTenantId);
    }
  }, [selectedTenantId]);

  async function loadConfigs(tenantId) {
    try {
      const [c2bRes, b2cRes] = await Promise.all([
        apiFetch(`/api/tenant-mpesa-config/${tenantId}?service_type=c2b`),
        apiFetch(`/api/tenant-mpesa-config/${tenantId}?service_type=b2c`)
      ]);

      const c2bDataJson = await c2bRes.json();
      const b2cDataJson = await b2cRes.json();

      if (c2bRes.ok && c2bDataJson.data) {
        const config = c2bDataJson.data;
        setC2bData({
          payment_type: config.paybill_number ? "paybill" : config.till_number ? "till" : "paybill",
          paybill_number: config.paybill_number || "",
          till_number: config.till_number || "",
          shortcode: config.shortcode || "",
          consumer_key: config.consumer_key || "",
          consumer_secret: config.consumer_secret || "",
          passkey: config.passkey || "",
          confirmation_url: config.confirmation_url || "",
          validation_url: config.validation_url || "",
          callback_url: config.callback_url || "",
          environment: config.environment || "sandbox",
          is_active: config.is_active ?? true,
        });
      } else {
        setC2bData({
          payment_type: "paybill",
          paybill_number: "",
          till_number: "",
          shortcode: "",
          consumer_key: "",
          consumer_secret: "",
          passkey: "",
          confirmation_url: "",
          validation_url: "",
          callback_url: "",
          environment: "sandbox",
          is_active: true,
        });
      }

      if (b2cRes.ok && b2cDataJson.data) {
        const config = b2cDataJson.data;
        setB2cData({
          shortcode: config.shortcode || "",
          consumer_key: config.consumer_key || "",
          consumer_secret: config.consumer_secret || "",
          initiator_name: config.initiator_name || "",
          security_credential: config.security_credential || "",
          callback_url: config.callback_url || "",
          environment: config.environment || "sandbox",
          is_active: config.is_active ?? true,
        });
      } else {
        setB2cData({
          shortcode: "",
          consumer_key: "",
          consumer_secret: "",
          initiator_name: "",
          security_credential: "",
          callback_url: "",
          environment: "sandbox",
          is_active: true,
        });
      }
    } catch (error) {
      console.error("Error loading configs", error);
    }
  }

  const handleC2BChange = (e) => setC2bData({ ...c2bData, [e.target.name]: e.target.value });
  const handleB2CChange = (e) => setB2cData({ ...b2cData, [e.target.name]: e.target.value });

  const saveC2B = async (e) => {
    e.preventDefault();
    if (!selectedTenantId) return alert("Please select a tenant first");
    setIsLoadingC2B(true);
    try {
      const payload = {
        tenant_id: selectedTenantId,
        service_type: "c2b",
        ...c2bData,
        paybill_number: c2bData.payment_type === "paybill" ? c2bData.paybill_number : null,
        till_number: c2bData.payment_type === "till" ? c2bData.till_number : null,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      };
      const res = await apiFetch(`/api/tenant-mpesa-config`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const d = await res.json();
        alert(`C2B saved! Registered URLs:\nConfirmation: ${d.urls?.confirmation}\nValidation: ${d.urls?.validation}`);
      } else {
        const d = await res.json();
        alert(d.error || "Error saving C2B config");
      }
    } catch (err) {
      alert(err.message || "Error saving C2B config");
    } finally {
      setIsLoadingC2B(false);
    }
  };

  const saveB2C = async (e) => {
    e.preventDefault();
    if (!selectedTenantId) return alert("Please select a tenant first");
    setIsLoadingB2C(true);
    try {
      const payload = {
        tenant_id: selectedTenantId,
        service_type: "b2c",
        ...b2cData,
        admin_id: (await supabase.auth.getUser()).data.user?.id
      };
      const res = await apiFetch(`/api/tenant-mpesa-config`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("B2C configuration saved!");
      } else {
        const d = await res.json();
        alert(d.error || "Error saving B2C config");
      }
    } catch (err) {
      alert(err.message || "Error saving B2C config");
    } finally {
      setIsLoadingB2C(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-800">MPESA Multi-Tenant Configuration</h1>
          <p className="mt-2 text-gray-600 text-sm">Manage C2B (Collections) and B2C (Disbursements) settings independently.</p>
        </div>

        {/* Tenant Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border border-gray-100">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Select Tenant Organization</label>
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] outline-none transition-all"
            required
          >
            <option value="" disabled>Choose a tenant...</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* C2B SECTION */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-[#586ab1] to-[#6c7dc5] text-white">
              <h2 className="text-sm font-bold uppercase tracking-wider">C2B Configuration (Collections)</h2>
              <p className="text-[10px] opacity-80 mt-1">Used for STK Push and customer repayments</p>
            </div>
            
            <form onSubmit={saveC2B} className="p-6 flex-grow flex flex-col">
              <div className="grid grid-cols-2 gap-4 mb-6 text-center">
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer transition-all ${c2bData.payment_type === 'paybill' ? 'border-[#586ab1] bg-indigo-50/30 text-[#586ab1]' : 'border-gray-100 text-gray-400'}`}>
                  <input type="radio" name="payment_type" value="paybill" checked={c2bData.payment_type === 'paybill'} onChange={handleC2BChange} className="hidden" />
                  <span className="text-xs font-bold">Paybill</span>
                </label>
                <label className={`flex-1 p-3 border-2 rounded-xl cursor-pointer transition-all ${c2bData.payment_type === 'till' ? 'border-[#586ab1] bg-indigo-50/30 text-[#586ab1]' : 'border-gray-100 text-gray-400'}`}>
                  <input type="radio" name="payment_type" value="till" checked={c2bData.payment_type === 'till'} onChange={handleC2BChange} className="hidden" />
                  <span className="text-xs font-bold">Till Number</span>
                </label>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{c2bData.payment_type === 'paybill' ? 'Paybill Number' : 'Till Number'}</label>
                  <input type="text" name={c2bData.payment_type === 'paybill' ? 'paybill_number' : 'till_number'} value={c2bData.payment_type === 'paybill' ? c2bData.paybill_number : c2bData.till_number} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder={c2bData.payment_type === 'paybill' ? "6-digit Paybill" : "Buy Goods Till"} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Shortcode</label>
                    <input type="text" name="shortcode" value={c2bData.shortcode} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Usually same as paybill" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
                    <select name="environment" value={c2bData.environment} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Key</label>
                    <input type="text" name="consumer_key" value={c2bData.consumer_key} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Secret</label>
                    <input type="password" name="consumer_secret" value={c2bData.consumer_secret} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Passkey (STK Push)</label>
                  <input type="password" name="passkey" value={c2bData.passkey} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confirmation URL</label>
                    <input type="url" name="confirmation_url" value={c2bData.confirmation_url} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Validation URL</label>
                    <input type="url" name="validation_url" value={c2bData.validation_url} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Callback URL (STK)</label>
                    <input type="url" name="callback_url" value={c2bData.callback_url} onChange={handleC2BChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="c2b_active" checked={c2bData.is_active} onChange={e => setC2bData({ ...c2bData, is_active: e.target.checked })} className="h-4 w-4 text-[#586ab1] border-gray-300 rounded focus:ring-[#586ab1]" />
                    <label htmlFor="c2b_active" className="text-xs font-medium text-gray-700">Active</label>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoadingC2B || !selectedTenantId} className="w-full py-3 bg-[#586ab1] text-white rounded-lg text-sm font-bold shadow-md hover:bg-[#49589d] transition-all disabled:opacity-50">
                {isLoadingC2B ? "Saving C2B..." : "Save C2B Settings"}
              </button>
            </form>
          </div>

          {/* B2C SECTION */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
              <h2 className="text-sm font-bold uppercase tracking-wider">B2C Configuration (Disbursement)</h2>
              <p className="text-[10px] opacity-80 mt-1">Used for loan payouts and refunds</p>
            </div>
            
            <form onSubmit={saveB2C} className="p-6 flex-grow flex flex-col">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">B2C Shortcode</label>
                  <input type="text" name="shortcode" value={b2cData.shortcode} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 600123" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Key</label>
                    <input type="text" name="consumer_key" value={b2cData.consumer_key} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Secret</label>
                    <input type="password" name="consumer_secret" value={b2cData.consumer_secret} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Initiator Name</label>
                    <input type="text" name="initiator_name" value={b2cData.initiator_name} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
                    <select name="environment" value={b2cData.environment} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Security Credential</label>
                    <input type="password" name="security_credential" value={b2cData.security_credential} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Encrypted credential from Daraja portal" />
                  </div>
                <div className="flex items-center gap-4">
                  <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Callback URL (Results)</label>
                    <input type="url" name="callback_url" value={b2cData.callback_url} onChange={handleB2CChange} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="b2c_active" checked={b2cData.is_active} onChange={e => setB2cData({ ...b2cData, is_active: e.target.checked })} className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                    <label htmlFor="b2c_active" className="text-xs font-medium text-gray-700">Active</label>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={isLoadingB2C || !selectedTenantId} className="w-full py-3 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 mt-auto">
                {isLoadingB2C ? "Saving B2C..." : "Save B2C Settings"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer Help */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <h3 className="text-xs font-bold text-amber-800 uppercase mb-2">C2B Security (Collections)</h3>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Ensure your <b>Passkey</b> is correctly set for STK Push functionality. The Callback URL must be a publicly accessible HTTPS endpoint to receive payment confirmations.
            </p>
          </div>
          <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
            <h3 className="text-xs font-bold text-teal-800 uppercase mb-2">B2C Credentials (Disbursements)</h3>
            <p className="text-[11px] text-teal-700 leading-relaxed">
              Disbursements use the <b>Initiator Name</b> and <b>Security Credential</b>. The Security Credential is an encrypted version of your Daraja portal password, generated using the M-Pesa certificate tool — <b>not</b> your plain initiator password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
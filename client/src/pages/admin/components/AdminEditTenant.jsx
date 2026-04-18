import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  BuildingOfficeIcon, 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  CloudIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
  LockClosedIcon,
  KeyIcon
} from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { apiFetch } from "../../../utils/api.js";

const PRIMARY_COLOR = "#586ab1";

export default function AdminEditTenant() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    logo_url: "",
    primary_color: PRIMARY_COLOR,
    secondary_color: "#6366f1",
    // C2B
    payment_type: "paybill",
    paybill_number: "",
    till_number: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    shortcode: "",
    confirmation_url: "",
    validation_url: "",
    callback_url: "",
    c2b_environment: "sandbox",
    c2b_is_active: true,
    // B2C
    b2c_shortcode: "",
    b2c_consumer_key: "",
    b2c_consumer_secret: "",
    initiator_name: "",
    security_credential: "",
    b2c_callback_url: "",
    b2c_environment: "sandbox",
    b2c_is_active: true,
    // SMS
    sms_base_url: "",
    sms_api_key: "",
    sms_partner_id: "",
    sms_shortcode: "",
    // Extra
    cr12: "",
    company_certificate: "",
    license: "",
    tenant_id_number: "",
    phone_number: "",
    document_upload_enabled: false,
    image_upload_enabled: false,
  });

  useEffect(() => {
    fetchTenantData();
  }, [id]);

  const fetchTenantData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Basic Tenant Info
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", id)
        .single();
      if (tErr) throw tErr;

      // 2. Fetch Features
      const { data: feature } = await supabase
        .from("tenant_features")
        .select("*")
        .eq("tenant_id", id)
        .single();

      // 3. Fetch MPESA Configs
      const mpesaRes = await apiFetch(`/api/tenant-mpesa-config/${id}/all`);
      const mpesaData = await mpesaRes.json();

      // 4. Fetch SMS Config
      const smsRes = await apiFetch(`/api/tenant/sms-config/${id}`);
      const smsData = await smsRes.json();

      // Update State
      const updates = {
        name: tenant.name || "",
        company_name: tenant.company_name || "",
        logo_url: tenant.logo_url || "",
        primary_color: tenant.primary_color || PRIMARY_COLOR,
        secondary_color: tenant.secondary_color || "#6366f1",
        cr12: tenant.cr12 || "",
        company_certificate: tenant.company_certificate || "",
        license: tenant.license || "",
        tenant_id_number: tenant.tenant_id_number || "",
        phone_number: tenant.phone_number || "",
        document_upload_enabled: feature?.document_upload_enabled || false,
        image_upload_enabled: feature?.image_upload_enabled || false,
      };

      if (mpesaRes.ok && Array.isArray(mpesaData.data)) {
        const configs = mpesaData.data;
        
        configs.forEach(config => {
          if (config.service_type === 'c2b') {
            updates.payment_type = config.paybill_number ? "paybill" : "till";
            updates.paybill_number = config.paybill_number || "";
            updates.till_number = config.till_number || "";
            updates.consumer_key = config.consumer_key || "";
            updates.consumer_secret = config.consumer_secret || "";
            updates.passkey = config.passkey || "";
            updates.shortcode = config.shortcode || "";
            updates.confirmation_url = config.confirmation_url || "";
            updates.validation_url = config.validation_url || "";
            updates.callback_url = config.callback_url || "";
            updates.c2b_environment = config.environment || "sandbox";
            updates.c2b_is_active = config.is_active ?? true;
          } else if (config.service_type === 'b2c') {
            updates.b2c_shortcode = config.shortcode || "";
            updates.b2c_consumer_key = config.consumer_key || "";
            updates.b2c_consumer_secret = config.consumer_secret || "";
            updates.initiator_name = config.initiator_name || "";
            updates.security_credential = config.security_credential || "";
            updates.b2c_callback_url = config.callback_url || "";
            updates.b2c_environment = config.environment || "sandbox";
            updates.b2c_is_active = config.is_active ?? true;
          }
        });
      }

      if (smsRes.ok && smsData.data) {
        const sms = smsData.data;
        updates.sms_base_url = sms.base_url || "";
        updates.sms_api_key = sms.api_key || "";
        updates.sms_partner_id = sms.partner_id || "";
        updates.sms_shortcode = sms.shortcode || "";
      }

      setFormData(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Error fetching tenant data:", err);
      setError("Failed to load tenant details");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;

      // 1. Update basic tenant info
      const { error: tErr } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          company_name: formData.company_name,
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          cr12: formData.cr12 || null,
          company_certificate: formData.company_certificate || null,
          license: formData.license || null,
          tenant_id_number: formData.tenant_id_number || null,
          phone_number: formData.phone_number || null,
        })
        .eq("id", id);
      if (tErr) throw tErr;

      // 2. Update Features
      const { error: fErr } = await supabase
        .from("tenant_features")
        .upsert({
          tenant_id: id,
          document_upload_enabled: formData.document_upload_enabled,
          image_upload_enabled: formData.image_upload_enabled,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });
      if (fErr) throw fErr;

      // 3. Update C2B
      if (formData.consumer_key || formData.passkey || formData.paybill_number || formData.till_number) {
        const c2bRes = await apiFetch(`/api/tenant-mpesa-config`, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: id,
            service_type: "c2b",
            paybill_number: formData.payment_type === "paybill" ? formData.paybill_number : null,
            till_number: formData.payment_type === "till" ? formData.till_number : null,
            consumer_key: formData.consumer_key,
            consumer_secret: formData.consumer_secret,
            passkey: formData.passkey,
            shortcode: formData.shortcode,
            confirmation_url: formData.confirmation_url,
            validation_url: formData.validation_url,
            callback_url: formData.callback_url,
            environment: formData.c2b_environment,
            is_active: formData.c2b_is_active,
            admin_id: adminId,
          }),
        });
        if (!c2bRes.ok) {
          const d = await c2bRes.json();
          throw new Error(d.error || "Failed to save C2B config");
        }
      }

      // 4. Update B2C
      if (formData.b2c_shortcode || formData.initiator_name || formData.b2c_consumer_key) {
        const b2cRes = await apiFetch(`/api/tenant-mpesa-config`, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: id,
            service_type: "b2c",
            shortcode: formData.b2c_shortcode,
            consumer_key: formData.b2c_consumer_key,
            consumer_secret: formData.b2c_consumer_secret,
            initiator_name: formData.initiator_name,
            security_credential: formData.security_credential,
            callback_url: formData.b2c_callback_url,
            environment: formData.b2c_environment,
            is_active: formData.b2c_is_active,
            admin_id: adminId,
          }),
        });
        if (!b2cRes.ok) {
          const d = await b2cRes.json();
          throw new Error(d.error || "Failed to save B2C config");
        }
      }

      // 5. Update SMS
      if (formData.sms_base_url || formData.sms_api_key || formData.sms_partner_id || formData.sms_shortcode) {
        const smsRes = await apiFetch(`/api/tenant/sms-config`, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: id,
            base_url: formData.sms_base_url,
            api_key: formData.sms_api_key,
            partner_id: formData.sms_partner_id,
            shortcode: formData.sms_shortcode,
          }),
        });
        if (!smsRes.ok) {
          const d = await smsRes.json();
          throw new Error(d.error || "Failed to save SMS config");
        }
      }

      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 border-4 border-brand-primary border-t-transparent animate-spin rounded-full"></div>
          <p className="text-gray-600 font-medium font-inter">Loading tenant details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8 px-4 md:px-8" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BuildingOfficeIcon className="h-7 w-7 text-brand-primary" />
                Edit Tenant Profile
              </h1>
              <p className="text-sm text-slate-500 font-medium tracking-tight">Manage organization details and system configurations</p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-btn text-white rounded-xl shadow-lg shadow-brand-primary/20 font-bold transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> Saving...</>
            ) : "Save Changes"}
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 animate-slide-down shadow-sm">
            <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 animate-slide-down shadow-sm space-y-3">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm font-bold">All configuration saved successfully!</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 pb-20">
          {/* Section 1: Basic Information */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
              <InformationCircleIcon className="h-5 w-5 text-brand-primary" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Organization Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                />
              </div>
            </div>
          </section>

          {/* M-Pesa Gateways */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* C2B SECTION */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-[#586ab1] to-[#6c7dc5] text-white">
                <h2 className="text-sm font-bold uppercase tracking-wider">C2B Configuration (Collections)</h2>
                <p className="text-[10px] opacity-80 mt-1">Used for STK Push and customer repayments</p>
              </div>
              
              <div className="p-6 space-y-4 flex-grow">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <label 
                    onClick={() => setFormData({...formData, payment_type: 'paybill'})}
                    className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.payment_type === 'paybill' ? 'border-[#586ab1] bg-indigo-50/30 text-[#586ab1]' : 'border-gray-100 text-gray-400'}`}
                  >
                    <span className="text-xs font-bold">Paybill</span>
                  </label>
                  <label 
                    onClick={() => setFormData({...formData, payment_type: 'till'})}
                    className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.payment_type === 'till' ? 'border-[#586ab1] bg-indigo-50/30 text-[#586ab1]' : 'border-gray-100 text-gray-400'}`}
                  >
                    <span className="text-xs font-bold">Till Number</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{formData.payment_type === 'paybill' ? 'Paybill Number' : 'Till Number'}</label>
                    <input 
                      type="text" 
                      value={formData.payment_type === 'paybill' ? formData.paybill_number : formData.till_number} 
                      onChange={e => setFormData({...formData, [formData.payment_type === 'paybill' ? 'paybill_number' : 'till_number']: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#586ab1]/20" 
                      placeholder={formData.payment_type === 'paybill' ? "6-digit Paybill" : "Buy Goods Till"} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Shortcode</label>
                      <input type="text" value={formData.shortcode} onChange={e => setFormData({...formData, shortcode: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm placeholder:opacity-50" placeholder="Usually same as paybill" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
                      <select value={formData.c2b_environment} onChange={e => setFormData({...formData, c2b_environment: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        <option value="sandbox">Sandbox</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Key</label>
                      <input type="text" value={formData.consumer_key} onChange={e => setFormData({...formData, consumer_key: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Secret</label>
                      <input type="password" value={formData.consumer_secret} onChange={e => setFormData({...formData, consumer_secret: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Passkey (STK Push)</label>
                    <input type="password" value={formData.passkey} onChange={e => setFormData({...formData, passkey: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Confirmation URL</label>
                      <input type="url" value={formData.confirmation_url} onChange={e => setFormData({...formData, confirmation_url: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Validation URL</label>
                      <input type="url" value={formData.validation_url} onChange={e => setFormData({...formData, validation_url: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-grow">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Callback URL (STK)</label>
                      <input type="url" value={formData.callback_url} onChange={e => setFormData({...formData, callback_url: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-mono" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="c2b_active" checked={formData.c2b_is_active} onChange={e => setFormData({...formData, c2b_is_active: e.target.checked})} className="h-4 w-4 text-[#586ab1] border-gray-300 rounded focus:ring-[#586ab1]" />
                      <label htmlFor="c2b_active" className="text-xs font-medium text-gray-700">Active</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* B2C SECTION */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                <h2 className="text-sm font-bold uppercase tracking-wider">B2C Configuration (Disbursement)</h2>
                <p className="text-[10px] opacity-80 mt-1">Used for loan payouts and refunds</p>
              </div>
              
              <div className="p-6 space-y-4 flex-grow bg-slate-50/30">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">B2C Shortcode</label>
                      <input type="text" value={formData.b2c_shortcode} onChange={e => setFormData({...formData, b2c_shortcode: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="e.g., 600123" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Environment</label>
                      <select value={formData.b2c_environment} onChange={e => setFormData({...formData, b2c_environment: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none">
                        <option value="sandbox">Sandbox</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Key</label>
                      <input type="text" value={formData.b2c_consumer_key} onChange={e => setFormData({...formData, b2c_consumer_key: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Consumer Secret</label>
                      <input type="password" value={formData.b2c_consumer_secret} onChange={e => setFormData({...formData, b2c_consumer_secret: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Initiator Name</label>
                      <input type="text" value={formData.initiator_name} onChange={e => setFormData({...formData, initiator_name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Security Credential</label>
                    <textarea 
                      rows="4" 
                      value={formData.security_credential} 
                      onChange={e => setFormData({...formData, security_credential: e.target.value})} 
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-[10px] font-mono outline-none focus:ring-2 focus:ring-emerald-500/20" 
                      placeholder="Encrypted credential from Daraja portal" 
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-grow">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Callback URL (Results)</label>
                      <input type="url" value={formData.b2c_callback_url || ''} onChange={e => setFormData({...formData, b2c_callback_url: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[10px] font-mono" />
                    </div>
                    <div className="flex items-center gap-2 pt-5">
                      <input type="checkbox" id="b2c_active" checked={formData.b2c_is_active} onChange={e => setFormData({...formData, b2c_is_active: e.target.checked})} className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500" />
                      <label htmlFor="b2c_active" className="text-xs font-medium text-gray-700">Active</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SMS Gateway */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center gap-3">
              <DevicePhoneMobileIcon className="h-5 w-5" />
              <h2 className="text-sm font-black uppercase tracking-widest">SMS Gateway Integration</h2>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
               <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Base URL</label>
                  <input type="url" value={formData.sms_base_url} onChange={e => setFormData({...formData, sms_base_url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner ID</label>
                  <input type="text" value={formData.sms_partner_id} onChange={e => setFormData({...formData, sms_partner_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shortcode</label>
                  <input type="text" value={formData.sms_shortcode} onChange={e => setFormData({...formData, sms_shortcode: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-center tracking-widest" />
               </div>
               <div className="space-y-2 md:col-span-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Key</label>
                  <input type="password" value={formData.sms_api_key} onChange={e => setFormData({...formData, sms_api_key: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm" />
               </div>
            </div>
          </section>

          {/* Feature Flags */}
          <section className="bg-slate-100 rounded-3xl p-10 flex flex-col md:flex-row items-center gap-12 border border-slate-200">
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900">System Modules</h2>
              <p className="text-slate-600 text-sm leading-relaxed">Customize platform capabilities for this organization.</p>
            </div>
            <div className="flex flex-wrap gap-10">
               <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={formData.document_upload_enabled} onChange={e => setFormData({...formData, document_upload_enabled: e.target.checked})} />
                    <div className="w-14 h-7 bg-slate-300 rounded-full peer-checked:bg-brand-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-7"></div>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Documents</span>
               </label>
               <label className="flex items-center gap-4 cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={formData.image_upload_enabled} onChange={e => setFormData({...formData, image_upload_enabled: e.target.checked})} />
                    <div className="w-14 h-7 bg-slate-300 rounded-full peer-checked:bg-brand-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-7"></div>
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Media</span>
               </label>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

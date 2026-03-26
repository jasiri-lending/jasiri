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
            updates.b2c_environment = config.environment || "sandbox"; // Corrected from mpesa_environment
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
    e.preventDefault();
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
              <h1 className="text-lg  text-slate-900 flex items-center gap-2">
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
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700 animate-slide-down shadow-sm">
            <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-bold">All changes saved successfully!</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8 pb-20">
          {/* Section 1: Basic Information */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex items-center gap-3">
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
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all placeholder:text-slate-400 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Official Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all placeholder:text-slate-400 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Primary Email / Support</label>
                <input
                  type="email"
                  value={formData.phone_number}
                  onChange={e => setFormData({...formData, phone_number: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all placeholder:text-slate-400 text-sm"
                />
              </div>
          
            </div>
          </section>

          {/* Section 2: Registration & Compliance */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-200 flex items-center gap-3">
              <ShieldCheckIcon className="h-5 w-5 text-brand-primary" />
              <h2 className="text-sm  text-slate-600 uppercase tracking-widest">Compliance & IDs</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CR12 Number</label>
                <input type="text" value={formData.cr12} onChange={e => setFormData({...formData, cr12: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registration Cert</label>
                <input type="text" value={formData.company_certificate} onChange={e => setFormData({...formData, company_certificate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tax ID (KRA PIN)</label>
                <input type="text" value={formData.tenant_id_number} onChange={e => setFormData({...formData, tenant_id_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm" />
              </div>
            </div>
          </section>

          {/* Section 3: M-Pesa Gateways */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* C2B Collections */}
            <section className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 bg-emerald-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg"><CloudIcon className="h-6 w-6" /></div>
                  <h2 className="text-sm font-black uppercase tracking-widest">C2B Collections</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="c2b_active" 
                    checked={formData.c2b_is_active} 
                    onChange={e => setFormData({...formData, c2b_is_active: e.target.checked})}
                    className="h-4 w-4 rounded border-white/30 text-emerald-600 bg-white focus:ring-0" 
                  />
                  <label htmlFor="c2b_active" className="text-[10px] font-black uppercase tracking-widest">Active</label>
                </div>
              </div>
              
              <div className="p-6 space-y-6 flex-1">
                <div className="flex gap-4">
                  {['paybill', 'till'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, payment_type: type})}
                      className={`flex-1 py-3 rounded-xl border-2 font-black uppercase tracking-widest text-[10px] transition-all ${formData.payment_type === type ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Identifier</label>
                    <input
                      type="text"
                      value={formData.payment_type === 'paybill' ? formData.paybill_number : formData.till_number}
                      onChange={e => setFormData({...formData, [formData.payment_type === 'paybill' ? 'paybill_number' : 'till_number']: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shortcode</label>
                    <input
                      type="text"
                      value={formData.shortcode}
                      onChange={e => setFormData({...formData, shortcode: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Environment</label>
                  <select 
                    value={formData.c2b_environment} 
                    onChange={e => setFormData({...formData, c2b_environment: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm font-bold appearance-none"
                  >
                    <option value="sandbox">Sandbox</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consumer Key</label>
                    <div className="relative">
                      <KeyIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="text" value={formData.consumer_key} onChange={e => setFormData({...formData, consumer_key: e.target.value})} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consumer Secret</label>
                    <div className="relative">
                      <LockClosedIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input type="password" value={formData.consumer_secret} onChange={e => setFormData({...formData, consumer_secret: e.target.value})} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Online Passkey</label>
                    <input type="password" value={formData.passkey} onChange={e => setFormData({...formData, passkey: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-emerald-500/20" />
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                   <div className="space-y-1 uppercase tracking-widest">
                     <label className="text-[9px] font-black text-slate-400">Confirmation URL</label>
                     <input type="url" value={formData.confirmation_url} onChange={e => setFormData({...formData, confirmation_url: e.target.value})} className="w-full px-3 py-1.5 bg-slate-100 border-none rounded-lg text-[11px] outline-none font-mono" />
                   </div>
                   <div className="space-y-1 uppercase tracking-widest">
                     <label className="text-[9px] font-black text-slate-400">Validation URL</label>
                     <input type="url" value={formData.validation_url} onChange={e => setFormData({...formData, validation_url: e.target.value})} className="w-full px-3 py-1.5 bg-slate-100 border-none rounded-lg text-[11px] outline-none font-mono" />
                   </div>
                </div>
              </div>
            </section>

            {/* B2C Disbursements */}
            <section className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="px-6 py-4 bg-brand-primary text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-lg"><GlobeAltIcon className="h-6 w-6" /></div>
                  <h2 className="text-sm font-black uppercase tracking-widest">B2C Disbursements</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="b2c_active" 
                    checked={formData.b2c_is_active} 
                    onChange={e => setFormData({...formData, b2c_is_active: e.target.checked})}
                    className="h-4 w-4 rounded border-white/30 text-brand-primary bg-white focus:ring-0" 
                  />
                  <label htmlFor="b2c_active" className="text-[10px] font-black uppercase tracking-widest">Active</label>
                </div>
              </div>
              
              <div className="p-6 space-y-6 flex-1 bg-muted/20">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shortcode</label>
                    <input
                      type="text"
                      value={formData.b2c_shortcode}
                      onChange={e => setFormData({...formData, b2c_shortcode: e.target.value})}
                      className="w-full px-4 py-2 bg-muted border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Environment</label>
                    <select 
                      value={formData.b2c_environment} 
                      onChange={e => setFormData({...formData, b2c_environment: e.target.value})}
                      className="w-full px-4 py-2 bg-muted border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm font-bold appearance-none"
                    >
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Consumer Key</label>
                    <input type="text" value={formData.b2c_consumer_key} onChange={e => setFormData({...formData, b2c_consumer_key: e.target.value})} className="w-full px-4 py-2 bg-muted border border-gray-200 rounded-xl outline-none font-mono text-xs focus:ring-2 focus:ring-brand-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Consumer Secret</label>
                    <input type="password" value={formData.b2c_consumer_secret} onChange={e => setFormData({...formData, b2c_consumer_secret: e.target.value})} className="w-full px-4 py-2 bg-muted border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20" />
                  </div>
                </div>

                <div className="p-5 bg-muted rounded-2xl space-y-4 border border-brand-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheckIcon className="h-4 w-4 text-brand-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Security Credentials</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initiator Name</label>
                    <input type="text" value={formData.initiator_name} onChange={e => setFormData({...formData, initiator_name: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security Credential</label>
                    <textarea rows="3" value={formData.security_credential} onChange={e => setFormData({...formData, security_credential: e.target.value})} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[11px] font-mono leading-relaxed" placeholder="Encrypted credential from Daraja portal" />
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Result Callback URL</label>
                   <input type="url" value={formData.b2c_callback_url} onChange={e => setFormData({...formData, b2c_callback_url: e.target.value})} className="w-full px-3 py-1.5 bg-brand-surface border-none rounded-lg text-[11px] outline-none font-mono" />
                </div>
              </div>
            </section>
          </div>

          {/* Section 4: SMS Gateway */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-100 text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DevicePhoneMobileIcon className="h-5 w-5 text-brand-primary" />
                <h2 className="text-sm   text-slate-900">SMS Gateway Integration</h2>
              </div>
              <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-600 ">SMS-SERVICE-V1</span>
            </div>
            <div className="p-8 bg-slate-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm text-slate-500  flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-primary rounded-full"></div>
                    API Base URL
                  </label>
                  <input 
                    type="url" 
                    placeholder="https://api.gateway.com/v1"
                    value={formData.sms_base_url} 
                    onChange={e => setFormData({...formData, sms_base_url: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm transition-all focus:border-brand-primary" 
                    required={!!formData.sms_api_key}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-primary rounded-full"></div>
                    Partner ID
                  </label>
                  <input 
                    type="text" 
                    value={formData.sms_partner_id} 
                    onChange={e => setFormData({...formData, sms_partner_id: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 text-sm transition-all focus:border-brand-primary" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-primary rounded-full"></div>
                    Sender / Shortcode
                  </label>
                  <input 
                    type="text" 
                    value={formData.sms_shortcode} 
                    onChange={e => setFormData({...formData, sms_shortcode: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-center tracking-widest text-sm transition-all focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" 
                  />
                </div>
                <div className="space-y-2 md:col-span-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1 h-1 bg-brand-primary rounded-full"></div>
                    API / Auth Key
                  </label>
                  <input 
                    type="password" 
                    value={formData.sms_api_key} 
                    onChange={e => setFormData({...formData, sms_api_key: e.target.value})} 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-mono text-sm transition-all focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20" 
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Feature Flags */}
          <section className="bg-slate-100 text-slate-900 rounded-3xl shadow-xl p-10 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] -z-10 rounded-full"></div>
            <div className="flex-1">
              <h2 className="text-lg text-slate-600">System Modules</h2>
              <p className="text-slate-600 text-sm  leading-relaxed">Customize the platform capabilities for this organization. Enabling these features will instantly grant access to relevant field officers.</p>
            </div>
            <div className="flex flex-wrap gap-10">
              <label className="flex items-center gap-5 group cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="peer sr-only" 
                    checked={formData.document_upload_enabled}
                    onChange={e => setFormData({...formData, document_upload_enabled: e.target.checked})}
                  />
                  <div className="w-16 h-8 bg-slate-800 rounded-full peer-checked:bg-brand-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-8"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand-primary transition-colors">Documents</span>
                  <span className="text-[10px] text-slate-500 font-bold">Uploads active</span>
                </div>
              </label>

              <label className="flex items-center gap-5 group cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="peer sr-only" 
                    checked={formData.image_upload_enabled}
                    onChange={e => setFormData({...formData, image_upload_enabled: e.target.checked})}
                  />
                  <div className="w-16 h-8 bg-slate-800 rounded-full peer-checked:bg-blue-500 transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:after:translate-x-8"></div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-400 transition-colors">Media</span>
                  <span className="text-[10px] text-slate-500 font-bold">Camera capture</span>
                </div>
              </label>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { 
  BuildingOfficeIcon, 
  ArrowLeftIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  GlobeAltIcon,
  CloudIcon,
  DevicePhoneMobileIcon,
  InformationCircleIcon,
  LockClosedIcon,
  KeyIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../utils/api.js";

const PRIMARY_COLOR = "#586ab1";
const PRIMARY_DARK = "#49589d";

export default function AdminCreateTenant() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [newTenantId, setNewTenantId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    logo_url: "",
    primary_color: PRIMARY_COLOR,
    secondary_color: "#6366f1",
    admin_full_name: "",
    admin_email: "",
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

  const handleSubmitStep1 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch(`/api/tenant/create-tenant`, {
        method: "POST",
        body: JSON.stringify({
          name: formData.name,
          company_name: formData.company_name,
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          admin_full_name: formData.admin_full_name,
          admin_email: formData.admin_email,
          cr12: formData.cr12,
          company_certificate: formData.company_certificate,
          license: formData.license,
          tenant_id_number: formData.tenant_id_number,
          phone_number: formData.phone_number,
          document_upload_enabled: formData.document_upload_enabled,
          image_upload_enabled: formData.image_upload_enabled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create tenant");

      setNewTenantId(data.tenant.id);
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const adminId = (await supabase.auth.getUser()).data.user?.id;

      // C2B Config
      const c2bRes = await apiFetch(`/api/tenant-mpesa-config`, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: newTenantId,
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

      // B2C Config
      if (formData.b2c_shortcode || formData.initiator_name || formData.b2c_consumer_key) {
        const b2cRes = await apiFetch(`/api/tenant-mpesa-config`, {
          method: "POST",
          body: JSON.stringify({
            tenant_id: newTenantId,
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

      setCurrentStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitStep3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await apiFetch(`/api/tenant/sms-config`, {
        method: "POST",
        body: JSON.stringify({
          tenant_id: newTenantId,
          base_url: formData.sms_base_url,
          api_key: formData.sms_api_key,
          partner_id: formData.sms_partner_id,
          shortcode: formData.sms_shortcode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save SMS config");
      }

      setSuccess(true);
      setTimeout(() => navigate('/users/tenants/admin'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted py-8 px-4 md:px-8" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/users/tenants/admin')}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BuildingOfficeIcon className="h-7 w-7 text-brand-primary" />
                Register New Tenant
              </h1>
              <p className="text-sm text-slate-500 font-medium">Step {currentStep} of 3: {currentStep === 1 ? 'Organization Details' : currentStep === 2 ? 'Payment Gateways' : 'Communication Settings'}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {[1, 2, 3].map(step => (
              <div 
                key={step}
                className={`h-2 w-12 rounded-full transition-all duration-500 ${step <= currentStep ? 'bg-brand-primary' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 shadow-sm animate-slide-down">
            <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-6 shadow-sm animate-slide-down flex items-center gap-4">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-bold text-emerald-800">Tenant Created Successfully!</p>
              <p className="text-sm text-emerald-600 font-medium">Redirecting to tenant management...</p>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <form onSubmit={handleSubmitStep1} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center gap-3">
                <InformationCircleIcon className="h-5 w-5 text-brand-primary" />
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Organization Details</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Company Name</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={e => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Internal Alias</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Jasiri Branch"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.admin_full_name}
                    onChange={e => setFormData({...formData, admin_full_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={formData.admin_email}
                    onChange={e => setFormData({...formData, admin_email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 flex justify-end">
                 <button
                   type="submit"
                   disabled={loading}
                   className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-btn transition-all disabled:opacity-50 flex items-center gap-2"
                 >
                   {loading ? <><div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> Processing...</> : "Next: Payment Config"}
                 </button>
               </div>
            </section>
          </form>
        )}

        {currentStep === 2 && (
          <form onSubmit={handleSubmitStep2} className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
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
                  
                  <div className="px-6 pb-6 mt-auto">
                    <p className="text-[10px] text-gray-400 italic mb-2 text-center underline">Auto-saved upon section completion</p>
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

                  <div className="px-6 pb-6 mt-auto">
                    <p className="text-[10px] text-gray-400 italic mb-2 text-center underline">Auto-saved into /mpesa-config/admin system</p>
                  </div>
                </div>
             </div>

             <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => setCurrentStep(1)} className="text-sm font-bold text-slate-500 flex items-center gap-2 hover:text-slate-700"><ArrowLeftIcon className="h-4 w-4" /> Back</button>
                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold shadow-lg shadow-brand-primary/20 hover:bg-brand-btn transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? "Saving Settings..." : "Save & Continue: SMS Config"}
                  </button>
                </div>
             </div>
          </form>
        )}

        {currentStep === 3 && (
          <form onSubmit={handleSubmitStep3} className="space-y-8 animate-in fade-in scale-95 duration-500">
             <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DevicePhoneMobileIcon className="h-6 w-6" />
                    <h2 className="text-sm font-black uppercase tracking-widest">SMS Gateway</h2>
                  </div>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Base URL</label>
                      <input type="url" value={formData.sms_base_url} onChange={e => setFormData({...formData, sms_base_url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" placeholder="https://api.sms-provider.com/v1" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Partner ID</label>
                      <input type="text" value={formData.sms_partner_id} onChange={e => setFormData({...formData, sms_partner_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shortcode / Sender ID</label>
                      <input type="text" value={formData.sms_shortcode} onChange={e => setFormData({...formData, sms_shortcode: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-bold text-center tracking-widest" />
                   </div>
                   <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">API Key</label>
                      <input type="password" value={formData.sms_api_key} onChange={e => setFormData({...formData, sms_api_key: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono text-sm" />
                   </div>
                </div>
             </section>

             <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200">
                <button type="button" onClick={() => setCurrentStep(2)} className="text-sm font-bold text-slate-500 flex items-center gap-2 hover:text-slate-700"><ArrowLeftIcon className="h-4 w-4" /> Back</button>
                <button
                   type="submit"
                   disabled={loading}
                   className="px-10 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                   {loading ? "Finalizing..." : "Complete Setup"}
                </button>
             </div>
          </form>
        )}
      </div>

      <style>{`
        @keyframes slide-down {
          from { transform: translateY(-1rem); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

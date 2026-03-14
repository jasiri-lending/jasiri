import { useState, useEffect } from "react";
import {
    Building2,
    CheckCircle2,
    AlertTriangle,
    ToggleLeft,
    RotateCw,
    Search
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/userAuth";
import Spinner from "../../components/Spinner";

export default function TenantFeatureManager() {
    const { profile } = useAuth();
    const [tenants, setTenants] = useState([]);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [features, setFeatures] = useState({
        document_upload_enabled: false,
        image_upload_enabled: false
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchTenants();
    }, []);

    const fetchTenants = async () => {
        setLoading(true);
        setError("");
        try {
            const { data, error } = await supabase
                .from("tenants")
                .select("id, name, company_name")
                .order("company_name", { ascending: true });

            if (error) throw error;
            setTenants(data || []);
        } catch (err) {
            console.error("Error fetching tenants:", err);
            setError("Failed to load tenants");
        } finally {
            setLoading(false);
        }
    };

    const fetchTenantFeatures = async (tenantId) => {
        setError("");
        setSuccess("");
        try {
            const { data, error } = await supabase
                .from("tenant_features")
                .select("*")
                .eq("tenant_id", tenantId)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setFeatures({
                    document_upload_enabled: data.document_upload_enabled || false,
                    image_upload_enabled: data.image_upload_enabled || false
                });
            } else {
                setFeatures({
                    document_upload_enabled: false,
                    image_upload_enabled: false
                });
            }
        } catch (err) {
            console.error("Error fetching features:", err);
            setError("Failed to load tenant features");
        }
    };

    const handleTenantSelect = (tenant) => {
        setSelectedTenant(tenant);
        fetchTenantFeatures(tenant.id);
    };

    const handleSave = async () => {
        if (!selectedTenant) return;

        setSaving(true);
        setError("");
        setSuccess("");

        try {
            const { error } = await supabase
                .from("tenant_features")
                .upsert({
                    tenant_id: selectedTenant.id,
                    document_upload_enabled: features.document_upload_enabled,
                    image_upload_enabled: features.image_upload_enabled,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'tenant_id' });

            if (error) throw error;

            setSuccess("Features updated successfully");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error("Error saving features:", err);
            setError("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const filteredTenants = tenants.filter(t =>
        t.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (profile?.role !== 'superadmin') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center p-8 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md">
                    <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                    <p className="text-gray-600">Only superadmins can manage tenant features.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 bg-brand-surface">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-sm font-bold text-brand-primary uppercase tracking-wider mb-1">Tenant Management</h1>
                    <h2 className="text-2xl font-bold text-gray-900">Feature Permissions</h2>
                    <p className="text-gray-500 text-sm mt-1">Control which features are enabled for specific tenants.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Tenant List Section */}
                    <div className="lg:col-span-1 flex flex-col h-[calc(100vh-250px)]">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search tenants..."
                                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all outline-none"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 custom-scrollbar">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center p-12">
                                        <RotateCw className="h-8 w-8 text-brand-primary animate-spin mb-2" />
                                        <p className="text-xs text-gray-500">Loading tenants...</p>
                                    </div>
                                ) : filteredTenants.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-sm text-gray-400 font-medium">No tenants found</p>
                                    </div>
                                ) : (
                                    filteredTenants.map((tenant) => (
                                        <button
                                            key={tenant.id}
                                            onClick={() => handleTenantSelect(tenant)}
                                            className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 group flex items-center justify-between
                        ${selectedTenant?.id === tenant.id
                                                    ? "bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20"
                                                    : "hover:bg-gray-50 text-gray-700"}`}
                                        >
                                            <div className="flex flex-col overflow-hidden">
                                                <span className={`text-sm font-bold truncate ${selectedTenant?.id === tenant.id ? "text-brand-primary" : "text-gray-900"}`}>
                                                    {tenant.company_name}
                                                </span>
                                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate">
                                                    ID: {tenant.name}
                                                </span>
                                            </div>
                                            {selectedTenant?.id === tenant.id && (
                                                <CheckCircle2 className="h-5 w-5 text-brand-primary shrink-0" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Feature Configuration Section */}
                    <div className="lg:col-span-2">
                        {!selectedTenant ? (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center h-full flex flex-col items-center justify-center">
                                <div className="p-4 bg-brand-surface rounded-2xl mb-4 text-brand-primary">
                                    <Building2 className="h-10 w-10" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">Select a Tenant</h3>
                                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                                    Pick a tenant from the list to manage their feature permissions.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Header for Selected Tenant */}
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-brand-surface rounded-xl text-brand-primary">
                                                <Building2 className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900">{selectedTenant.company_name}</h3>
                                                <p className="text-xs text-brand-primary font-bold uppercase tracking-widest">{selectedTenant.name}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Status</span>
                                            <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100 uppercase tracking-wider animate-pulse">
                                                Active
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Feature Controls */}
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 pb-2 border-b border-gray-100">
                                        Feature Configuration
                                    </h4>

                                    <div className="space-y-8">
                                        {/* Document Upload Feature */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-50 bg-gray-50/30 hover:bg-gray-50/80 transition-all">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h5 className="text-sm font-bold text-gray-900">Document Upload System</h5>
                                                    <span className="text-[10px] px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full font-bold uppercase tracking-widest">Core</span>
                                                </div>
                                                <p className="text-xs text-gray-500 leading-relaxed max-w-md">
                                                    Allows the tenant to upload and manage documents (CR12, Certificates, Identifications) within their dashboard.
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2">
                                                <button
                                                    onClick={() => setFeatures({ ...features, document_upload_enabled: !features.document_upload_enabled })}
                                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 shadow-inner
                            ${features.document_upload_enabled ? "bg-brand-primary" : "bg-gray-200"}`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-300 shadow-md ring-1 ring-black/5
                               ${features.document_upload_enabled ? "translate-x-6" : "translate-x-1"}`}
                                                    />
                                                </button>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${features.document_upload_enabled ? "text-brand-primary" : "text-gray-400"}`}>
                                                    {features.document_upload_enabled ? "Enabled" : "Disabled"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Image Upload Feature */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-gray-50 bg-gray-50/30 hover:bg-gray-50/80 transition-all">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h5 className="text-sm font-bold text-gray-900">Image Upload System</h5>
                                                    <span className="text-[10px] px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full font-bold uppercase tracking-widest">Core</span>
                                                </div>
                                                <p className="text-xs text-gray-500 leading-relaxed max-w-md">
                                                    Allows the tenant to upload and manage images (Passport, ID, Business Images, Security Items) within their dashboard.
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2">
                                                <button
                                                    onClick={() => setFeatures({ ...features, image_upload_enabled: !features.image_upload_enabled })}
                                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 shadow-inner
                            ${features.image_upload_enabled ? "bg-brand-primary" : "bg-gray-200"}`}
                                                >
                                                    <span
                                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-300 shadow-md ring-1 ring-black/5
                               ${features.image_upload_enabled ? "translate-x-6" : "translate-x-1"}`}
                                                    />
                                                </button>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${features.image_upload_enabled ? "text-brand-primary" : "text-gray-400"}`}>
                                                    {features.image_upload_enabled ? "Enabled" : "Disabled"}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Placeholder for more features */}

                                        <div className="opacity-40 p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/10">
                                            <p className="text-xs text-center text-gray-400 font-medium italic">Additional features can be added here in future updates...</p>
                                        </div>
                                    </div>

                                    {/* Feedback Messages */}
                                    {error && (
                                        <div className="mt-8 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-600 text-sm animate-in fade-in duration-300">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <p className="font-medium">{error}</p>
                                        </div>
                                    )}
                                    {success && (
                                        <div className="mt-8 p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2 text-emerald-600 text-sm animate-in fade-in duration-300">
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            <p className="font-medium">{success}</p>
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    <div className="mt-10 flex justify-end">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="px-8 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-btn disabled:opacity-50 transition-all shadow-lg hover:shadow-brand-primary/20 flex items-center gap-3 text-sm font-bold"
                                        >
                                            {saving ? (
                                                <RotateCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="h-4 w-4" />
                                            )}
                                            {saving ? "Saving Changes..." : "Apply Permissions"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(88, 106, 177, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(88, 106, 177, 0.2);
        }
      `}</style>
        </div>
    );
}

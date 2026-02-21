import { useState, useEffect } from 'react';
import { useAuth } from "../../../hooks/userAuth";
import { supabase } from "../../../supabaseClient";
import {
  CogIcon,
  ExclamationTriangleIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  BuildingLibraryIcon,
  MapIcon,
  QuestionMarkCircleIcon,
  InformationCircleIcon,
  ArrowsUpDownIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline";

const PenaltySettingsManager = () => {
  const { profile } = useAuth();
  // State management
  const [settings, setSettings] = useState([]);
  const [filteredSettings, setFilteredSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, branch, region
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, inactive

  // Form state
  const [formData, setFormData] = useState({
    branch_id: '',
    region_id: '',
    is_active: true,
    penalty_rate: 10.00,
    penalty_type: 'arrears_percentage',
    grace_period_days: 7,
    max_penalty_amount: '',
    min_arrears_amount: 100.00,
    effective_date: new Date().toISOString().split('T')[0]
  });

  const [errors, setErrors] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch initial data
  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData();
    }
  }, [profile]);

  // Filter settings when search or filters change
  useEffect(() => {
    let filtered = settings;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(setting => {
        if (filterType === 'branch') return setting.branch_id;
        if (filterType === 'region') return setting.region_id;
        return true;
      });
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(setting => {
        if (filterStatus === 'active') return setting.is_active;
        if (filterStatus === 'inactive') return !setting.is_active;
        return true;
      });
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(setting => {
        const branchName = setting.branches?.name?.toLowerCase() || '';
        const regionName = setting.regions?.name?.toLowerCase() || '';
        const penaltyType = setting.penalty_type?.toLowerCase() || '';

        return branchName.includes(term) ||
          regionName.includes(term) ||
          penaltyType.includes(term);
      });
    }

    setFilteredSettings(filtered);
  }, [settings, searchTerm, filterType, filterStatus]);

  const fetchData = async () => {
    if (!profile?.tenant_id) return;
    setLoading(true);
    try {
      // Fetch penalty settings with branch and region data
      const { data: settingsData, error: settingsError } = await supabase
        .from("penalty_settings")
        .select(`
          *,
          branches (
            id,
            name,
            region_id
          ),
          regions (
            id,
            name
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .order('updated_at', { ascending: false });

      if (settingsError) throw settingsError;

      // Fetch branches for dropdown
      const { data: branchesData } = await supabase
        .from("branches")
        .select("id, name, region_id")
        .eq('tenant_id', profile.tenant_id)
        .order("name");

      // Fetch regions for dropdown
      const { data: regionsData } = await supabase
        .from("regions")
        .select("id, name")
        .eq('tenant_id', profile.tenant_id)
        .order("name");

      setSettings(settingsData || []);
      setFilteredSettings(settingsData || []);
      setBranches(branchesData || []);
      setRegions(regionsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Must have either branch OR region, not both
    if (formData.branch_id && formData.region_id) {
      newErrors.branch_id = "Cannot set both branch and region. Choose one.";
      newErrors.region_id = "Cannot set both branch and region. Choose one.";
    }

    // Penalty rate validation
    if (formData.penalty_rate < 0 || formData.penalty_rate > 100) {
      newErrors.penalty_rate = "Penalty rate must be between 0 and 100%";
    }

    // Grace period validation
    if (formData.grace_period_days < 0) {
      newErrors.grace_period_days = "Grace period cannot be negative";
    }

    // Min arrears validation
    if (formData.min_arrears_amount < 0) {
      newErrors.min_arrears_amount = "Minimum arrears cannot be negative";
    }

    // Max penalty validation (if provided)
    if (formData.max_penalty_amount && formData.max_penalty_amount < 0) {
      newErrors.max_penalty_amount = "Maximum penalty cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        ...formData,
        tenant_id: profile.tenant_id,
        branch_id: formData.branch_id || null,
        region_id: formData.region_id || null,
        max_penalty_amount: formData.max_penalty_amount || null,
        updated_at: new Date().toISOString()
      };

      if (editingSetting) {
        // Update existing setting
        const { error } = await supabase
          .from("penalty_settings")
          .update(payload)
          .eq("id", editingSetting.id)
          .eq("tenant_id", profile.tenant_id);

        if (error) throw error;
      } else {
        // Insert new setting
        const { error } = await supabase
          .from("penalty_settings")
          .insert([payload]);

        if (error) throw error;
      }

      // Reset form and refresh data
      resetForm();
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving penalty setting:", error);
      alert("Error saving settings: " + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (setting) => {
    setEditingSetting(setting);
    setFormData({
      branch_id: setting.branch_id || '',
      region_id: setting.region_id || '',
      is_active: setting.is_active,
      penalty_rate: setting.penalty_rate,
      penalty_type: setting.penalty_type,
      grace_period_days: setting.grace_period_days,
      max_penalty_amount: setting.max_penalty_amount || '',
      min_arrears_amount: setting.min_arrears_amount,
      effective_date: setting.effective_date || new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this penalty setting?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("penalty_settings")
        .delete()
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id);

      if (error) throw error;

      fetchData(); // Refresh the list
    } catch (error) {
      console.error("Error deleting penalty setting:", error);
      alert("Error deleting setting: " + error.message);
    }
  };

  const handleDuplicate = async (setting) => {
    setEditingSetting(null);
    setFormData({
      branch_id: setting.branch_id || '',
      region_id: setting.region_id || '',
      is_active: setting.is_active,
      penalty_rate: setting.penalty_rate,
      penalty_type: setting.penalty_type,
      grace_period_days: setting.grace_period_days,
      max_penalty_amount: setting.max_penalty_amount || '',
      min_arrears_amount: setting.min_arrears_amount,
      effective_date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      branch_id: '',
      region_id: '',
      is_active: true,
      penalty_rate: 10.00,
      penalty_type: 'arrears_percentage',
      grace_period_days: 7,
      max_penalty_amount: '',
      min_arrears_amount: 100.00,
      effective_date: new Date().toISOString().split('T')[0]
    });
    setEditingSetting(null);
    setErrors({});
  };

  const getPenaltyTypeLabel = (type) => {
    const types = {
      'arrears_percentage': 'Percentage of Arrears',
      'flat_fee': 'Flat Fee',
      'daily_fee': 'Daily Fee'
    };
    return types[type] || type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Modal component
  const PenaltySettingsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CogIcon className="h-8 w-8 text-indigo-600" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingSetting ? 'Edit Penalty Setting' : 'New Penalty Setting'}
                </h2>
                <p className="text-gray-600 text-sm">
                  Configure penalty rules for {formData.branch_id ? 'branch' : formData.region_id ? 'region' : 'global'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <XCircleIcon className="h-6 w-6 text-gray-500" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Scope Selection */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <ArrowsUpDownIcon className="h-5 w-5" />
                Scope Selection
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apply to Branch
                  </label>
                  <select
                    name="branch_id"
                    value={formData.branch_id}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-lg ${errors.branch_id ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">-- Select a branch --</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                  {errors.branch_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.branch_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apply to Region
                  </label>
                  <select
                    name="region_id"
                    value={formData.region_id}
                    onChange={handleInputChange}
                    className={`w-full p-2 border rounded-lg ${errors.region_id ? 'border-red-500' : 'border-gray-300'}`}
                  >
                    <option value="">-- Select a region --</option>
                    {regions.map(region => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                  {errors.region_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.region_id}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                <InformationCircleIcon className="h-4 w-4" />
                Note: Choose either a branch OR a region. Leave both empty for global default.
              </p>
            </div>

            {/* Basic Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-indigo-600"
                  />
                  <span className="font-medium text-gray-700">Active</span>
                </label>
                <p className="text-xs text-gray-500">
                  Enable or disable penalty calculation
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Penalty Type
                </label>
                <select
                  name="penalty_type"
                  value={formData.penalty_type}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="arrears_percentage">Percentage of Arrears</option>
                  <option value="flat_fee">Flat Fee</option>
                  <option value="daily_fee">Daily Fee</option>
                </select>
              </div>
            </div>

            {/* Rate & Amount Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Penalty Rate (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    name="penalty_rate"
                    value={formData.penalty_rate}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className={`w-full p-2 border rounded-lg pr-10 ${errors.penalty_rate ? 'border-red-500' : 'border-gray-300'}`}
                  />
                  <span className="absolute right-3 top-2 text-gray-500">%</span>
                </div>
                {errors.penalty_rate && (
                  <p className="text-red-500 text-sm mt-1">{errors.penalty_rate}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grace Period (days)
                </label>
                <input
                  type="number"
                  name="grace_period_days"
                  value={formData.grace_period_days}
                  onChange={handleInputChange}
                  min="0"
                  className={`w-full p-2 border rounded-lg ${errors.grace_period_days ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.grace_period_days && (
                  <p className="text-red-500 text-sm mt-1">{errors.grace_period_days}</p>
                )}
              </div>
            </div>

            {/* Amount Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Penalty (KES)
                  <span className="text-gray-500 text-xs ml-1">(Optional)</span>
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="max_penalty_amount"
                    value={formData.max_penalty_amount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    placeholder="No limit"
                    className={`w-full p-2 pl-10 border rounded-lg ${errors.max_penalty_amount ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>
                {errors.max_penalty_amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.max_penalty_amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Arrears (KES)
                </label>
                <div className="relative">
                  <CurrencyDollarIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="number"
                    name="min_arrears_amount"
                    value={formData.min_arrears_amount}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className={`w-full p-2 pl-10 border rounded-lg ${errors.min_arrears_amount ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </div>
                {errors.min_arrears_amount && (
                  <p className="text-red-500 text-sm mt-1">{errors.min_arrears_amount}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Penalties apply only when arrears exceed this amount
                </p>
              </div>
            </div>

            {/* Effective Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Effective Date
              </label>
              <div className="relative">
                <CalendarDaysIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  name="effective_date"
                  value={formData.effective_date}
                  onChange={handleInputChange}
                  className="w-full p-2 pl-10 border border-gray-300 rounded-lg"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                When these settings should take effect
              </p>
            </div>

            {/* Help Text */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <QuestionMarkCircleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-800">How Penalties Work:</h4>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>• Penalties apply only after the grace period expires</li>
                    <li>• "Percentage of Arrears": Penalty = Arrears × Rate%</li>
                    <li>• "Flat Fee": Fixed penalty amount per overdue installment</li>
                    <li>• "Daily Fee": Penalty increases daily by specified amount</li>
                    <li>• Maximum penalty caps the total penalty amount</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200">
            <button
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  {editingSetting ? 'Update Settings' : 'Create Settings'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4 mx-auto"></div>
          <p className="text-gray-600 font-medium">Loading penalty settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
      {isModalOpen && <PenaltySettingsModal />}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <CogIcon className="h-8 w-8 text-indigo-600" />
                Penalty Settings Manager
              </h1>
              <p className="text-gray-600 mt-2">
                Configure and manage penalty rules for loans across branches and regions
              </p>
            </div>
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              New Penalty Setting
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Settings</p>
                  <p className="text-2xl font-bold text-gray-900">{settings.length}</p>
                </div>
                <CogIcon className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Settings</p>
                  <p className="text-2xl font-bold text-green-600">
                    {settings.filter(s => s.is_active).length}
                  </p>
                </div>
                <CheckCircleIcon className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Branch Settings</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {settings.filter(s => s.branch_id).length}
                  </p>
                </div>
                <BuildingLibraryIcon className="h-8 w-8 text-purple-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Region Settings</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {settings.filter(s => s.region_id).length}
                  </p>
                </div>
                <MapIcon className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  placeholder="Search by branch, region, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scope Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Types</option>
                  <option value="branch">Branch Only</option>
                  <option value="region">Region Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterStatus('all');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Settings Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Scope
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Penalty Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Rate/Grace
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Limits
                    </th>
                    <th className="px6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Effective Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSettings.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center">
                        <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-900 font-medium">No penalty settings found</p>
                        <p className="text-gray-600 mt-1">
                          {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Create your first penalty setting'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSettings.map((setting) => (
                      <tr key={setting.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {setting.branch_id ? (
                              <>
                                <BuildingLibraryIcon className="h-5 w-5 text-purple-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {setting.branches?.name || 'Unknown Branch'}
                                  </div>
                                  <div className="text-xs text-gray-500">Branch Setting</div>
                                </div>
                              </>
                            ) : setting.region_id ? (
                              <>
                                <MapIcon className="h-5 w-5 text-orange-500" />
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {setting.regions?.name || 'Unknown Region'}
                                  </div>
                                  <div className="text-xs text-gray-500">Region Setting</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <CogIcon className="h-5 w-5 text-gray-500" />
                                <div>
                                  <div className="font-medium text-gray-900">Global Default</div>
                                  <div className="text-xs text-gray-500">Applies to all</div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {setting.is_active ? (
                              <>
                                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                  Active
                                </span>
                              </>
                            ) : (
                              <>
                                <EyeSlashIcon className="h-5 w-5 text-red-500" />
                                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                                  Inactive
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {getPenaltyTypeLabel(setting.penalty_type)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {setting.penalty_type === 'arrears_percentage' && `${setting.penalty_rate}% of arrears`}
                            {setting.penalty_type === 'flat_fee' && `KES ${setting.penalty_rate}`}
                            {setting.penalty_type === 'daily_fee' && `KES ${setting.penalty_rate}/day`}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <ExclamationTriangleIcon className="h-4 w-4 text-blue-500" />
                              <span className="text-sm">{setting.penalty_rate}%</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CalendarDaysIcon className="h-4 w-4 text-green-500" />
                              <span className="text-sm">{setting.grace_period_days} days grace</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="text-gray-900">
                              Min: KES {parseFloat(setting.min_arrears_amount).toLocaleString()}
                            </div>
                            {setting.max_penalty_amount && (
                              <div className="text-gray-900">
                                Max: KES {parseFloat(setting.max_penalty_amount).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatDate(setting.effective_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(setting.updated_at).toLocaleDateString('en-GB')}
                          <br />
                          <span className="text-xs">
                            {new Date(setting.updated_at).toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(setting)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(setting)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                              title="Duplicate"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(setting.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Information Footer */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800">Penalty Settings Priority</h4>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>1. <strong>Branch-specific settings</strong> take highest priority</li>
                  <li>2. <strong>Region settings</strong> apply to all branches in the region</li>
                  <li>3. <strong>Global default</strong> applies when no branch/region setting exists</li>
                  <li className="text-xs text-blue-600 italic mt-2">
                    Note: Settings are evaluated from most specific to most general
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PenaltySettingsManager;
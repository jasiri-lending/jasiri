import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BuildingOfficeIcon,
  UsersIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  CreditCardIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  GlobeAltIcon,
  PaintBrushIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  ShieldCheckIcon,
  KeyIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowUpRightIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EllipsisVerticalIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknotesIcon,
  ClockIcon,
  UserGroupIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChevronUpDownIcon,
  UserPlusIcon,
  ChartBarIcon,
  IdentificationIcon,
  WalletIcon,
  DocumentTextIcon,
  DevicePhoneMobileIcon,
  CogIcon,
  AdjustmentsHorizontalIcon,
  UserCircleIcon,
  UserIcon,
  CheckBadgeIcon
} from "@heroicons/react/24/outline";
import { supabase } from "../../../supabaseClient";
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Optimized Stat Card Component
const StatCard = ({ name, value, change, icon: Icon, color, changeType, description, loading }) => {
  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-2">{name}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 rounded animate-pulse"></div>
              ) : (
                value
              )}
            </p>
            {change && (
              <span className={`text-sm font-medium flex items-center gap-1 ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                {changeType === 'positive' ? (
                  <ArrowUpRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
                {change}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">{description}</p>
        </div>
        <div className={`${color} p-3 rounded-lg ml-4 flex-shrink-0`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
};

// Mask sensitive information
const maskSensitive = (text) => {
  if (!text) return '';
  if (text.length <= 4) return '••••';
  return '••••' + text.slice(-4);
};

// Pre-defined color classes for badges to avoid dynamic class names
const roleColorClasses = {
  admin: 'bg-emerald-100 text-emerald-800',
  operation_officer: 'bg-amber-100 text-amber-800',
  regional_manager: 'bg-blue-100 text-blue-800',
  relationship_officer: 'bg-indigo-100 text-indigo-800',
  customer_service_officer: 'bg-violet-100 text-violet-800',
  credit_analyst_officer: 'bg-rose-100 text-rose-800',
  branch_manager: 'bg-cyan-100 text-cyan-800',
};

const statusColorClasses = {
  pending: 'bg-yellow-100 text-yellow-800',
  bm_review: 'bg-blue-100 text-blue-800',
  ca_review: 'bg-purple-100 text-purple-800',
  cso_review: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statsColors = [
  { bg: 'bg-emerald-100', text: 'text-emerald-600', border: 'border-emerald-200' },
  { bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  { bg: 'bg-violet-100', text: 'text-violet-600', border: 'border-violet-200' },
  { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' },
  { bg: 'bg-cyan-100', text: 'text-cyan-600', border: 'border-cyan-200' },
  { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
  { bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
];

const roles = [
  { value: "admin", label: "Admin" },
  { value: "operation_officer", label: "Operation Officer" },
  { value: "regional_manager", label: "Regional Manager" },
  { value: "relationship_officer", label: "Relationship Officer" },
  { value: "customer_service_officer", label: "Customer Service Officer" },
  { value: "credit_analyst_officer", label: "Credit Analyst Officer" },
  { value: "branch_manager", label: "Branch Manager" },
];

const customerStatuses = [
  { value: "pending", label: "Pending" },
  { value: "bm_review", label: "BM Review" },
  { value: "ca_review", label: "CA Review" },
  { value: "cso_review", label: "CSO Review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const tabs = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'users', label: 'Users', icon: UserCircleIcon },
  { id: 'branches', label: 'Branches', icon: BuildingOfficeIcon },
  { id: 'regions', label: 'Regions', icon: MapPinIcon },
  { id: 'customers', label: 'Customers', icon: UserGroupIcon },
  { id: 'loans', label: 'Loans', icon: CreditCardIcon },
  { id: 'mpesa', label: 'MPESA', icon: CurrencyDollarIcon },
  { id: 'settings', label: 'Settings', icon: CogIcon },
];

const TenantViewPage = () => {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [mpesaConfig, setMpesaConfig] = useState(null);
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [mpesaTransactions, setMpesaTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterRole, setFilterRole] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fetch tenant basic info first (fastest to load)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // Fetch tenant and mpesa config in parallel (fast queries)
        const [tenantResponse, mpesaResponse] = await Promise.all([
          supabase.from('tenants').select('*').eq('id', tenantId).single(),
          supabase.from('tenant_mpesa_config').select('*').eq('tenant_id', tenantId).maybeSingle()
        ]);

        if (tenantResponse.error) throw tenantResponse.error;

        setTenant(tenantResponse.data);
        setMpesaConfig(mpesaResponse.data);

        // Fetch stats in background
        calculateStats();

      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) fetchInitialData();
  }, [tenantId]);

  // Fetch data for active tab when tab changes
  useEffect(() => {
    if (!tenantId || loading) return;

    const fetchTabData = async () => {
      try {
        setLoading(true);

        switch (activeTab) {
          case 'users':
            const usersData = await fetchUsers();
            setUsers(usersData || []);
            break;
          case 'branches':
            const branchesData = await fetchBranches();
            setBranches(branchesData || []);
            break;
          case 'regions':
            const regionsData = await fetchRegions();
            setRegions(regionsData || []);
            break;
          case 'customers':
            const customersData = await fetchCustomers();
            setCustomers(customersData || []);
            break;
          case 'loans':
            const loansData = await fetchLoans();
            setLoans(loansData || []);
            break;
          case 'mpesa':
            const transactionsData = await fetchMpesaTransactions();
            setMpesaTransactions(transactionsData || []);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error(`Error fetching ${activeTab} data:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchTabData();
  }, [activeTab, tenantId]);

  const calculateStats = useCallback(async () => {
    try {
      // Execute all count queries in parallel
      const [
        usersCount,
        branchesCount,
        regionsCount,
        roUsers,
        repaymentsCount
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('regions').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        supabase.from('users').select('id, role').eq('tenant_id', tenantId).eq('role', 'relationship_officer'),
        supabase.from('loan_payments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      ]);

      const roIds = roUsers.data?.map(u => u.id) || [];
      let customerCount = 0;
      let loanCount = 0;

      // Only fetch counts if there are relationship officers
      if (roIds.length > 0) {
        const [customersCount, loansCount] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }).in('created_by', roIds),
          supabase.from('loans').select('id', { count: 'exact', head: true }).in('booked_by', roIds)
        ]);

        customerCount = customersCount.count || 0;
        loanCount = loansCount.count || 0;
      }

      setStats({
        totalUsers: usersCount.count || 0,
        totalCustomers: customerCount,
        totalLoans: loanCount,
        totalRepayments: repaymentsCount.count || 0,
        totalBranches: branchesCount.count || 0,
        totalRegions: regionsCount.count || 0,
        activeROs: roUsers.data?.length || 0
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [tenantId]);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, phone, created_at, tenant_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100); // Limit results for performance

    if (error) console.error('Error fetching users:', error);
    return data;
  }, [tenantId]);

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, code, address, region_id, created_at, regions:region_id(name)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) console.error('Error fetching branches:', error);
    return data;
  }, [tenantId]);

  const fetchRegions = useCallback(async () => {
    const { data, error } = await supabase
      .from('regions')
      .select('id, name, code, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) console.error('Error fetching regions:', error);
    return data;
  }, [tenantId]);

  const fetchCustomers = useCallback(async () => {
    const { data: roUsers } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'relationship_officer');

    if (!roUsers?.length) return [];

    const { data, error } = await supabase
      .from('customers')
      .select(`
        id,
        Firstname,
        Surname,
        mobile,
        status,
        created_at,
        created_by,
        users:created_by(full_name),
        branch_id,
        branches:branch_id(name)
      `)
      .in('created_by', roUsers.map(u => u.id))
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('Error fetching customers:', error);
    return data;
  }, [tenantId]);

  const fetchLoans = useCallback(async () => {
    const { data: roUsers } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'relationship_officer');

    if (!roUsers?.length) return [];

    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        customers:customer_id(Firstname, Surname, mobile),
        users:booked_by(full_name)
      `)
      .in('booked_by', roUsers.map(u => u.id))
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('Error fetching loans:', error);
    return data;
  }, [tenantId]);

  const fetchMpesaTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from('mpesa_c2b_transactions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) console.error('Error fetching MPESA transactions:', error);
    return data;
  }, [tenantId]);

  const handleManualRefresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      calculateStats(),
      activeTab === 'users' && fetchUsers().then(setUsers),
      activeTab === 'branches' && fetchBranches().then(setBranches),
      activeTab === 'regions' && fetchRegions().then(setRegions),
      activeTab === 'customers' && fetchCustomers().then(setCustomers),
      activeTab === 'loans' && fetchLoans().then(setLoans),
      activeTab === 'mpesa' && fetchMpesaTransactions().then(setMpesaTransactions),
    ]).finally(() => setLoading(false));
  }, [activeTab, calculateStats, fetchUsers, fetchBranches, fetchRegions, fetchCustomers, fetchLoans, fetchMpesaTransactions]);

  const clearFilters = useCallback(() => {
    setFilterRole('');
    setFilterRegion('');
    setFilterBranch('');
    setFilterStatus('');
  }, []);

  // Memoized filtered data
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        (user.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.phone || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = !filterRole || user.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, filterRole]);

  const filteredBranches = useMemo(() => {
    return branches.filter(b =>
      (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [branches, searchQuery]);

  const filteredRegions = useMemo(() => {
    return regions.filter(r =>
      (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [regions, searchQuery]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      const matchesSearch =
        (customer.Firstname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.Surname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (customer.mobile || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = !filterStatus || customer.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [customers, searchQuery, filterStatus]);

  const filteredLoans = useMemo(() => {
    return loans.filter(loan =>
      (loan.customers?.Firstname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (loan.customers?.Surname || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.id.toString().includes(searchQuery)
    );
  }, [loans, searchQuery]);

  const filteredMpesaTransactions = useMemo(() => {
    return mpesaTransactions.filter(transaction =>
      (transaction.transaction_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.phone_number || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [mpesaTransactions, searchQuery]);

  if (loading && !tenant) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#586ab1] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tenant information...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="h-12 w-12 text-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">Tenant not found</p>
        </div>
      </div>
    );
  }

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Tenant Profile Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-600">Tenant Profile</h2>
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
              Active
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="flex items-start">
                <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Company Name</p>
                  <p className="text-lg font-semibold text-slate-600">{tenant.company_name || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-start">
                <IdentificationIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Tenant Owner</p>
                  <p className="text-lg font-semibold text-slate-600">{tenant.name}</p>
                </div>
              </div>

              <div className="flex items-start">
                <GlobeAltIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Tenant Slug</p>
                  <p className="text-lg font-mono font-semibold text-slate-600">{tenant.tenant_slug}</p>
                </div>
              </div>

              <div className="flex items-start">
                <CalendarIcon className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Date Created</p>
                  <p className="text-lg font-semibold text-slate-600">
                    {format(new Date(tenant.created_at), 'MMMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-sm  text-slate-600">Activity Summary</h2>
          <p className="text-sm text-gray-600 mt-1">Key metrics for this tenant</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Users', value: stats.totalUsers || 0, icon: UsersIcon },
              { label: 'Total Customers', value: stats.totalCustomers || 0, icon: UserGroupIcon },
              { label: 'Total Loans', value: stats.totalLoans || 0, icon: DocumentTextIcon },
              { label: 'Active ROs', value: stats.activeROs || 0, icon: UserIcon },
              { label: 'Total Branches', value: stats.totalBranches || 0, icon: BuildingOfficeIcon },
              { label: 'Total Regions', value: stats.totalRegions || 0, icon: MapPinIcon },
              { label: 'Total Repayments', value: stats.totalRepayments || 0, icon: BanknotesIcon },
              { label: 'MPESA Config', value: mpesaConfig ? 'Configured' : 'Not Set', icon: CheckBadgeIcon },
            ].map((stat, index) => {
              const color = statsColors[index % statsColors.length];
              const Icon = stat.icon;
              return (
                <div key={stat.label} className={`bg-white rounded-lg shadow-sm border ${color.border} p-5`}>
                  <div className="flex items-center">
                    <div className={`${color.bg} p-3 rounded-lg`}>
                      <Icon className={`h-6 w-6 ${color.text}`} />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                      <p className={`text-2xl font-bold ${color.text}`}>{stat.value}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MPESA Configuration */}
      {mpesaConfig && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm text-slate-600">MPESA Configuration</h2>
              <button className="px-4 py-2 bg-[#586ab1] text-white text-sm rounded-lg hover:bg-[#4a5a9a] transition-colors flex items-center gap-2">
                <PencilIcon className="h-4 w-4" />
                Edit Config
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { label: 'Paybill Number', value: mpesaConfig.paybill_number || 'Not set' },
                { label: 'Till Number', value: mpesaConfig.till_number || 'Not set' },
                { label: 'Shortcode', value: mpesaConfig.shortcode || 'Not set' },
                { label: 'Consumer Key', value: maskSensitive(mpesaConfig.consumer_key), sensitive: true },
                { label: 'Consumer Secret', value: maskSensitive(mpesaConfig.consumer_secret), sensitive: true },
                { label: 'Passkey', value: maskSensitive(mpesaConfig.passkey), sensitive: true },
                { label: 'Confirmation URL', value: mpesaConfig.confirmation_url || 'Not set', fullWidth: true },
                { label: 'Validation URL', value: mpesaConfig.validation_url || 'Not set', fullWidth: true },
                { label: 'Callback URL', value: mpesaConfig.callback_url || 'Not set', fullWidth: true },
              ].map((field, index) => (
                <div key={index} className={field.fullWidth ? 'md:col-span-2 lg:col-span-3' : ''}>
                  <p className="text-sm font-medium text-gray-700 mb-1">{field.label}</p>
                  <div className={`p-3 bg-gray-50 rounded-lg border border-gray-200 ${field.sensitive ? 'font-mono' : ''}`}>
                    <p className={`text-sm ${field.sensitive ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>
                      {field.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Configured on: {mpesaConfig.created_at ? format(new Date(mpesaConfig.created_at), 'MMMM d, yyyy h:mm a') : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm  text-slate-600">Tenant Users</h2>
            <p className="text-sm text-gray-600 mt-1">
              {filteredUsers.length} users found
            </p>
          </div>

        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-600 font-medium text-sm">
                          {user.full_name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{user.phone || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleColorClasses[user.role] || 'bg-gray-100 text-gray-800'}`}>
                    {roles.find(r => r.value === user.role)?.label || user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(user.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    className="text-[#586ab1] hover:text-[#4a5a9a] mr-3 transition-colors"
                    title="View user"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </button>
                  <button
                    className="text-amber-600 hover:text-amber-800 transition-colors mr-3"
                    title="Edit user"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    className="text-rose-600 hover:text-rose-800 transition-colors"
                    title="Delete user"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <UserCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-sm text-slate-600">Tenant Management</h1>
              <h2 className="text-lg  text-slate-600">{tenant.company_name || tenant.name}</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleManualRefresh}
                disabled={loading}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`h-5 w-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                <h3 className='text-sm text-slate-600'> Refresh</h3>
              </button>
              <button
                onClick={() => navigate('/tenants')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to Tenants
              </button>
            </div>
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const count = {
                  overview: null,
                  users: users.length,
                  branches: branches.length,
                  regions: regions.length,
                  customers: customers.length,
                  loans: loans.length,
                  mpesa: mpesaTransactions.length,
                  settings: null,
                }[tab.id];

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    disabled={loading && tab.id !== activeTab}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${loading && tab.id !== activeTab ? 'opacity-50 cursor-not-allowed' : ''} ${activeTab === tab.id
                        ? 'border-[#586ab1] text-[#586ab1]'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    <Icon className="h-5 w-5 inline-block mr-2" />
                    {tab.label}
                    {count !== null && (
                      <span className="ml-2 bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-1 rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Search and Actions Bar */}
          <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-[#586ab1] focus:border-transparent"
                disabled={loading}
              />
            </div>
            <div className="flex gap-3">
              {['users', 'customers', 'loans'].includes(activeTab) && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <FunnelIcon className="h-5 w-5 mr-2" />
                  Filters
                  {(filterRole || filterRegion || filterBranch || filterStatus) && (
                    <span className="ml-2 bg-[#586ab1] text-white text-xs font-semibold px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </button>
              )}

              {['customers', 'loans', 'mpesa'].includes(activeTab) && (
                <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                  Export
                </button>
              )}
            </div>
          </div>

          {/* Filters Section */}
          {showFilters && (
            <div className="px-6 pb-6 pt-0 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {activeTab === 'users' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                    <div className="relative">
                      <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] appearance-none"
                      >
                        <option value="">All Roles</option>
                        {roles.map(role => (
                          <option key={role.value} value={role.value}>{role.label}</option>
                        ))}
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
                {activeTab === 'customers' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <div className="relative">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#586ab1] appearance-none"
                      >
                        <option value="">All Statuses</option>
                        {customerStatuses.map(status => (
                          <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                      </select>
                      <ChevronUpDownIcon className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-sm text-[#586ab1] hover:text-[#4a5a9a] font-medium"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading State for Tab Content */}
        {loading && activeTab !== 'overview' ? (
          <div className="bg-white rounded-lg shadow p-12 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#586ab1] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading {activeTab} data...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'branches' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Branches</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredBranches.length} branches found
                      </p>
                    </div>

                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredBranches.map((branch) => (
                        <tr key={branch.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{branch.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{branch.regions?.name || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                              {branch.code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600 truncate max-w-xs">{branch.address || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(branch.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              className="text-[#586ab1] hover:text-[#4a5a9a] mr-3 transition-colors"
                              title="View branch"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              className="text-amber-600 hover:text-amber-800 transition-colors mr-3"
                              title="Edit branch"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              className="text-rose-600 hover:text-rose-800 transition-colors"
                              title="Delete branch"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredBranches.length === 0 && (
                    <div className="text-center py-12">
                      <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No branches found</h3>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'regions' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Regions</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredRegions.length} regions found
                      </p>
                    </div>

                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branches</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredRegions.map((region) => {
                        const regionBranches = branches.filter(b => b.region_id === region.id);
                        const regionUsers = users.filter(u => u.region_id === region.id);
                        return (
                          <tr key={region.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap font-medium">{region.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                                {region.code}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                {regionBranches.length}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full">
                                {regionUsers.length}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(new Date(region.created_at), 'MMM d, yyyy')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <button
                                className="text-amber-600 hover:text-amber-800 transition-colors mr-3"
                                title="Edit region"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                className="text-rose-600 hover:text-rose-800 transition-colors"
                                title="Delete region"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {filteredRegions.length === 0 && (
                    <div className="text-center py-12">
                      <MapPinIcon className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No regions found</h3>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'customers' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredCustomers.length} customers found
                      </p>
                    </div>

                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Relationship Officer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.Firstname} {customer.Surname}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.mobile}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.users?.full_name || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{customer.branches?.name || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColorClasses[customer.status] || 'bg-gray-100 text-gray-800'}`}>
                              {customerStatuses.find(s => s.value === customer.status)?.label || customer.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(customer.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              className="text-[#586ab1] hover:text-[#4a5a9a] mr-3 transition-colors"
                              title="View customer"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                            <button
                              className="text-amber-600 hover:text-amber-800 transition-colors mr-3"
                              title="Edit customer"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredCustomers.length === 0 && (
                    <div className="text-center py-12">
                      <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No customers found</h3>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'loans' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Loans</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredLoans.length} loans found
                      </p>
                    </div>
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      Export
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RO</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">#{loan.id}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {loan.customers?.Firstname} {loan.customers?.Surname}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              KES {loan.scored_amount?.toLocaleString() || '0'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${loan.status === 'disbursed'
                                ? 'bg-green-100 text-green-800'
                                : loan.status === 'approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : loan.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {loan.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {loan.users?.full_name || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(loan.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              className="text-[#586ab1] hover:text-[#4a5a9a] transition-colors"
                              title="View loan"
                            >
                              <EyeIcon className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredLoans.length === 0 && (
                    <div className="text-center py-12">
                      <CreditCardIcon className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No loans found</h3>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'mpesa' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-600">MPESA Transactions</h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {filteredMpesaTransactions.length} transactions found
                      </p>
                    </div>
                    <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      Export
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredMpesaTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-mono text-gray-900">
                              {transaction.transaction_id?.slice(-8) || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              KES {transaction.amount?.toLocaleString() || '0'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{transaction.phone_number}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${transaction.status === 'applied'
                                ? 'bg-green-100 text-green-800'
                                : transaction.status === 'failed'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                              {transaction.status || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{transaction.payment_type || 'C2B'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {format(new Date(transaction.created_at), 'MMM d, h:mm a')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredMpesaTransactions.length === 0 && (
                    <div className="text-center py-12">
                      <CurrencyDollarIcon className="h-12 w-12 mx-auto text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No MPESA transactions found</h3>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting your search criteria</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Tenant Settings</h2>
                  <p className="text-sm text-gray-600 mt-1">Manage tenant settings and actions</p>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors">
                      <div className="flex items-center">
                        <PencilIcon className="h-5 w-5 text-[#586ab1] mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Edit Tenant</p>
                          <p className="text-sm text-gray-500">Update tenant information and settings</p>
                        </div>
                      </div>
                    </button>

                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors">
                      <div className="flex items-center">
                        <ShieldCheckIcon className="h-5 w-5 text-amber-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Suspend Tenant</p>
                          <p className="text-sm text-gray-500">Temporarily disable tenant access</p>
                        </div>
                      </div>
                    </button>

                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors">
                      <div className="flex items-center">
                        <KeyIcon className="h-5 w-5 text-purple-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">Reset Passwords</p>
                          <p className="text-sm text-gray-500">Reset passwords for all tenant users</p>
                        </div>
                      </div>
                    </button>

                    <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors">
                      <div className="flex items-center">
                        <ClockIcon className="h-5 w-5 text-gray-600 mr-3" />
                        <div>
                          <p className="font-medium text-gray-900">View Logs</p>
                          <p className="text-sm text-gray-500">View tenant activity logs</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="pt-6 mt-6 border-t border-gray-200">
                    <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                      <TrashIcon className="h-4 w-4" />
                      Delete Tenant
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      Warning: This action cannot be undone. All tenant data will be permanently deleted.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TenantViewPage;
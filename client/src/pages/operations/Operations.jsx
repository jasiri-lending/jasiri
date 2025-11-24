import { useState, useEffect } from 'react';
import { 
  UserPlusIcon, 
  BuildingOfficeIcon, 
  MapPinIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { supabase } from "../../supabaseClient";

export default function OperationsManagement() {
  const [activeTab, setActiveTab] = useState('users');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  
  // Data states
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [regions, setRegions] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Search
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form states
  const [formData, setFormData] = useState({});
  const [editingItem, setEditingItem] = useState(null);

  
// Define roles array
const roles = [
  { value: "admin", label: "Admin" },
  { value: "regional_manager", label: "Regional Manager" },
  { value: "relationship_officer", label: "Relationship Officer" },
  { value: "customer_service_officer", label: "Customer Service Officer" },
  { value: "credit_analyst_officer", label: "Credit Analyst Officer" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "operation_officer", label: "Operation Officer" },
];


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchUsers(),
      fetchBranches(),
      fetchRegions()
    ]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select(`
        id,
        email,
        full_name,
        role,
        profiles (
          branch_id,
          region_id,
          branches (id, name),
          regions (id, name)
        )
      `)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const mapped = data.map((u) => ({
        ...u,
        branch_id: u.profiles?.branch_id,
        region_id: u.profiles?.region_id,
        branches: u.profiles?.branches,
        regions: u.profiles?.regions,
      }));
      setUsers(mapped);
    } else {
      console.error(error);
    }
  };

  const fetchBranches = async () => {
    const { data, error } = await supabase.from("branches").select("*");
    if (!error && data) setBranches(data);
  };

  const fetchRegions = async () => {
    const { data, error } = await supabase.from("regions").select("*");
    if (!error && data) setRegions(data);
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setEditingItem(item);
    
    if (item) {
      setFormData(item);
    } else {
      setFormData({});
    }
    
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
    setFormData({});
  };

 const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);

  try {
    if (modalType === "user") {
      await handleUserSubmit();
    } else if (modalType === "branch") {
      await handleBranchSubmit();
    } else if (modalType === "region") {
      await handleRegionSubmit();
    }

    await fetchData(); // reload table data
    closeModal();
  } catch (error) {
    console.error("❌ Error submitting:", error);
    alert("Error: " + error.message);
  } finally {
    setSubmitting(false);
  }
};


const handleBranchSubmit = async () => {
  const branchData = {
    name: formData.name?.trim(),
    region_id: formData.region_id || null,
    code: formData.code?.trim(),
    address: formData.address?.trim() || null,
    
  };

  if (!branchData.name || !branchData.region_id) {
    throw new Error("Branch name and region are required");
  }

  const query = editingItem
    ? supabase.from("branches").update(branchData).eq("id", editingItem.id)
    : supabase.from("branches").insert(branchData);

  const { error } = await query;
  if (error) throw error;
};


const handleRegionSubmit = async () => {
  const regionData = {
    name: formData.name?.trim(),
    code: formData.code?.trim(),
    // description: formData.description?.trim() || null,
    // status: formData.status || "active",
  };

  if (!regionData.name || !regionData.code) {
    throw new Error("Region name and code are required");
  }

  const query = editingItem
    ? supabase.from("regions").update(regionData).eq("id", editingItem.id)
    : supabase.from("regions").insert(regionData);

  const { error } = await query;
  if (error) throw error;
};


const handleUserSubmit = async () => {
  try {
    if (editingItem) {
      console.log("✏️ Updating existing user:", editingItem.id, formData);

      const { error: userError } = await supabase
        .from("users")
        .update({
          full_name: formData.full_name?.trim(),
          email: formData.email?.trim(),
          role: formData.role,
          phone: formData.phone?.trim() || null,
        })
        .eq("id", editingItem.id);

      if (userError) {
        console.error(" User update error:", userError);
        throw userError;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          branch_id: formData.branch_id || null,
          region_id: formData.region_id || null,
        })
        .eq("id", editingItem.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }
    } else {
      // 1. Validate
      if (!formData.email || !formData.password) {
        throw new Error("Email and password are required");
      }
      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      // 2. Create Auth user with emailRedirectTo to prevent confirmation issues
      console.log("Creating auth user with email:", formData.email);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: formData.full_name?.trim(),
            role: formData.role,
            phone: formData.phone?.trim() || null,
            branch_id: formData.branch_id || null,
            region_id: formData.region_id || null,
          },
        },
      });

      console.log(" Auth response:", { authData, authError });

      if (authError) throw authError;

      const userId = authData?.user?.id;
      if (!userId) throw new Error("Failed to create user in Auth");

      // 3. Wait a moment for triggers to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // 4. Update users table (use upsert to handle trigger conflicts)
      console.log("🟢 Upserting into users table with ID:", userId);
      const { error: userError } = await supabase
        .from("users")
        .upsert({
          id: userId,
          full_name: formData.full_name?.trim(),
          email: formData.email.trim(),
          role: formData.role,
          phone: formData.phone?.trim() || null,
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (userError) {
        console.error("❌ Users upsert error:", userError);
        throw userError;
      }

      // 5. Update profiles table (use upsert to handle trigger conflicts)
      console.log("🟢 Upserting into profiles table with ID:", userId);
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          branch_id: formData.branch_id || null,
          region_id: formData.region_id || null,
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (profileError) {
        console.error("❌ Profiles upsert error:", profileError);
        throw profileError;
      }
    }

    console.log("✅ User operation successful");
    await fetchUsers();
    setEditingItem(null);
    setFormData({});
  } catch (err) {
    console.error("❌ Error saving user (outer catch):", err);
    alert(err.message || "Unexpected error saving user");
  }
};





console.log("Creating user with:", formData.email, formData.password);



  // Delete User + Profile
  const handleDelete = async (type, id) => {
    if (!confirm("Are you sure?")) return;

    try {
      if (type === "user") {
        await supabase.from("profiles").delete().eq("id", id);
        const { error } = await supabase.from("users").delete().eq("id", id);
        if (error) throw error;
        await fetchUsers();
      } else {
        const table = type === "branch" ? "branches" : "regions";
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        if (table === "branches") fetchBranches();
        else fetchRegions();
      }
    } catch (err) {
      console.error(" Error deleting:", err.message);
      alert(err.message);
    }
  };

  // Filter data based on search
  const filteredUsers = users.filter(u => 
    (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredBranches = branches.filter(b =>
    (b.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRegions = regions.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Operations Management</h1>
          <p className="text-gray-600 mt-2">Manage users, branches, and regions</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserPlusIcon className="h-5 w-5 inline-block mr-2" />
                Users
              </button>
              <button
                onClick={() => setActiveTab('branches')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'branches'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BuildingOfficeIcon className="h-5 w-5 inline-block mr-2" />
                Branches
              </button>
              <button
                onClick={() => setActiveTab('regions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'regions'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <MapPinIcon className="h-5 w-5 inline-block mr-2" />
                Regions
              </button>
            </nav>
          </div>

          {/* Search and Add Button */}
          <div className="p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => openModal(activeTab === 'users' ? 'user' : activeTab === 'branches' ? 'branch' : 'region')}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <UserPlusIcon className="h-5 w-5 mr-2" />
              Add {activeTab === 'users' ? 'User' : activeTab === 'branches' ? 'Branch' : 'Region'}
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        ) : (
          <>
            {/* Users Table */}
            {activeTab === 'users' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">{user.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{user.phone || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{user.branches?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{user.regions?.name || 'N/A'}</td>
                      
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openModal('user', user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete('user', user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No users found
                  </div>
                )}
              </div>
            )}

            {/* Branches Table */}
            {activeTab === 'branches' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBranches.map((branch) => (
                      <tr key={branch.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{branch.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{branch.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {regions.find(r => r.id === branch.region_id)?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4">{branch.address || 'N/A'}</td>
                       
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openModal('branch', branch)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete('branch', branch.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredBranches.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No branches found
                  </div>
                )}
              </div>
            )}

            {/* Regions Table */}
            {activeTab === 'regions' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRegions.map((region) => (
                      <tr key={region.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{region.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{region.code}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openModal('region', region)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete('region', region.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRegions.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No regions found
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">
                {editingItem ? 'Edit' : 'Add'} {modalType === 'user' ? 'User' : modalType === 'branch' ? 'Branch' : 'Region'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {/* User Form */}
              {modalType === 'user' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.full_name || ''}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {!editingItem && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                      <input
                        type="password"
                        required
                        value={formData.password || ''}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select
                      required
                      value={formData.role || ''}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Role</option>
                      {roles.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                    <select
                      value={formData.region_id || ''}
                      onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Region</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select
                      value={formData.branch_id || ''}
                      onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Branch Form */}
              {modalType === 'branch' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
                    <select
                      required
                      value={formData.region_id || ''}
                      onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select Region</option>
                      {regions.map(region => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Region Form */}
              {modalType === 'region' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Region Code *</label>
                    <input
                      type="text"
                      required
                      value={formData.code || ''}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="mt-8 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
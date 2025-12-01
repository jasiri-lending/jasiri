import { useState, useEffect, useMemo } from 'react';

function AmendmentsTable({ amendments: propAmendments, loading: propLoading, onEdit, onView, onRefresh }) {
  const [amendments, setAmendments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Constants for cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
  const STORAGE_KEYS = {
    AMENDMENTS: 'amendments_data',
    LAST_FETCH: 'amendments_last_fetch'
  };

  // Load data from localStorage on component mount
  useEffect(() => {
    const loadCachedData = () => {
      try {
        const cachedAmendments = localStorage.getItem(STORAGE_KEYS.AMENDMENTS);
        const cachedLastFetch = localStorage.getItem(STORAGE_KEYS.LAST_FETCH);

        if (cachedAmendments) {
          const amendmentsData = JSON.parse(cachedAmendments);
          setAmendments(amendmentsData);
        }

        if (cachedLastFetch) {
          setLastFetchTime(parseInt(cachedLastFetch));
        }
      } catch (error) {
        console.error('Error loading cached amendments data:', error);
        clearCache();
      }
    };

    loadCachedData();
  }, []);

  // Clear cache function
  const clearCache = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  };

  // Save data to localStorage
  const saveToCache = (amendmentsData) => {
    try {
      const currentTime = Date.now();
      localStorage.setItem(STORAGE_KEYS.AMENDMENTS, JSON.stringify(amendmentsData));
      localStorage.setItem(STORAGE_KEYS.LAST_FETCH, currentTime.toString());
      setLastFetchTime(currentTime);
    } catch (error) {
      console.error('Error saving amendments to cache:', error);
    }
  };

  // Check if cache is valid
  const isCacheValid = () => {
    const currentTime = Date.now();
    return currentTime - lastFetchTime < CACHE_DURATION;
  };

  // Handle incoming props - use cached data if valid, otherwise use props
  useEffect(() => {
    if (propAmendments && propAmendments.length >= 0) {
      if (!isCacheValid() || amendments.length === 0) {
        // If cache is invalid or empty, use props and save to cache
        setAmendments(propAmendments);
        saveToCache(propAmendments);
      }
      // If cache is valid, we keep using the cached data
    }
  }, [propAmendments]);

  // Handle loading state
  useEffect(() => {
    if (propLoading !== undefined) {
      setLoading(propLoading);
    } else {
      // If no loading prop provided, set loading to false after initial load
      setLoading(false);
    }
  }, [propLoading]);

  // Enhanced refresh handler with cache validation
  const handleRefresh = () => {
    // Only clear cache and refresh if cache is invalid or forced refresh is needed
    if (!isCacheValid()) {
      clearCache();
      setLoading(true);
      
      // Call the original onRefresh if provided
      if (onRefresh) {
        onRefresh();
      } else {
        // If no onRefresh provided, simulate refresh by using props
        if (propAmendments) {
          setAmendments(propAmendments);
          saveToCache(propAmendments);
        }
        setLoading(false);
      }
    } else {
      console.log('Cache is still valid, skipping refresh');
      // Optional: Show a message to user that data is fresh
    }
  };

  // Filter amendments based on search term
  const filteredAmendments = useMemo(() => {
    if (!searchTerm.trim()) {
      return amendments;
    }

    const lowercasedSearch = searchTerm.toLowerCase();
    return amendments.filter(amendment => {
      const customer = amendment.customers || {};
      return (
        (customer.Firstname?.toLowerCase() || '').includes(lowercasedSearch) ||
        (customer.Surname?.toLowerCase() || '').includes(lowercasedSearch) ||
        (customer.id_number?.toLowerCase() || '').includes(lowercasedSearch) ||
        (customer.mobile?.toLowerCase() || '').includes(lowercasedSearch) ||
        (customer.business_name?.toLowerCase() || '').includes(lowercasedSearch) ||
        (customer.status?.toLowerCase() || '').includes(lowercasedSearch)
      );
    });
  }, [amendments, searchTerm]);

  // Determine which data to display
  const displayAmendments = filteredAmendments.length > 0 ? filteredAmendments : (amendments.length > 0 ? amendments : (propAmendments || []));
  const displayLoading = loading;

  if (displayLoading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
    </div>
  );
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-gray-50">
        <div>
          <h2 className="text-slate-600">Pending Amendments {amendments.length}</h2>
        
        </div>
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search amendments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={isCacheValid()}
            className={`flex items-center gap-1 px-3 py-2 text-white text-sm rounded-xl transition-all duration-300 hover:shadow-lg ${
              isCacheValid() ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'
            }`}
            style={{ backgroundColor: "#586ab1" }}
            title={isCacheValid() ? "Data is up to date" : "Refresh data"}
          >
            <svg className={`w-4 h-4 ${isCacheValid() ? '' : 'animate-pulse'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Business Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayAmendments.map((amendment) => (
              <tr key={amendment.id || amendment.customer_id} className="hover:bg-gray-50 transition-colors duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {amendment.customers?.Firstname} {amendment.customers?.Surname}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{amendment.customers?.id_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{amendment.customers?.mobile}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{amendment.customers?.business_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${amendment.customers?.status === 'sent_back_by_bm' ? 'bg-orange-100 text-orange-800' : 
                      amendment.customers?.status === 'sent_back_by_ca' ? 'bg-red-100 text-red-800' :
                      amendment.customers?.status === 'sent_back_by_cso' ? 'bg-purple-100 text-purple-800' :
                      'bg-yellow-100 text-yellow-800'}`}>
                    {amendment.customers?.status?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => onView(amendment)} 
                    className="mr-3 text-indigo-600 hover:text-indigo-900 transition-colors duration-200 font-medium"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => onEdit(amendment)} 
                    className="text-green-600 hover:text-green-900 transition-colors duration-200 font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {displayAmendments.length === 0 && (
        <div className="p-8 text-center text-gray-500 bg-gray-50">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-lg font-medium">No amendments found</p>
          <p className="mt-1">
            {searchTerm ? 'Try adjusting your search terms' : 'No pending amendments available'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              Clear search
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default AmendmentsTable;
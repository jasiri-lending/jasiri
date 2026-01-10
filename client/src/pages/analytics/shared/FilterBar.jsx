import React from 'react';
import { Calendar, MapPin, Building } from 'lucide-react';

const FilterBar = ({ dateRange, setDateRange, selectedRegion, setSelectedRegion, selectedBranch, setSelectedBranch, regions = [], branches = [] }) => {
  return (
    <div className="flex flex-wrap gap-4 mt-6">
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
        <Calendar className="w-4 h-4 text-gray-500" />
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="bg-transparent border-none focus:ring-0"
        >
          <option value="all">All Time</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="6months">Last 6 Months</option>
          <option value="year">Last 1 Year</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
        <MapPin className="w-4 h-4 text-gray-500" />
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-transparent border-none focus:ring-0"
        >
          <option value="all">All Regions</option>
          {regions.map(region => (
            <option key={region.name} value={region.name}>{region.name}</option>
          ))}
        </select>
      </div>
      
      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
        <Building className="w-4 h-4 text-gray-500" />
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="bg-transparent border-none focus:ring-0"
        >
          <option value="all">All Branches</option>
          {branches.map(branch => (
            <option key={branch.code} value={branch.code}>{branch.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default FilterBar;
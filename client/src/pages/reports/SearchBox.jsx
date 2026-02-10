import React from "react";
import { Search } from "lucide-react";

/**
 * SearchBox component is memoized to prevent focus loss (cursor bouncing) 
 * when parent component re-renders due to data or grand total updates.
 */
const SearchBox = React.memo(({ value, onChange }) => {
    return (
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Search name, ID, or phone"
                className="border bg-gray-50 border-gray-300 pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm w-64 text-gray-900"
            />
        </div>
    );
});

export default SearchBox;

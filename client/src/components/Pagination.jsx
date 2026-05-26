import React from 'react';
import { ChevronDoubleLeftIcon, ChevronDoubleRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * Pagination component used across loaning pages.
 * Props:
 * - totalItems: number of items after filtering
 * - itemsPerPage: items per page
 * - currentPage: current page index (1‑based)
 * - onPageChange: function(pageNumber) – called when user selects a page
 */
export const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const maxVisiblePages = 5;

  const getPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
    } else {
      pageNumbers.push(1);
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      if (currentPage <= 2) endPage = 4;
      if (currentPage >= totalPages - 1) startPage = totalPages - 3;
      if (startPage > 2) pageNumbers.push('...');
      for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);
      if (endPage < totalPages - 1) pageNumbers.push('...');
      pageNumbers.push(totalPages);
    }
    return pageNumbers;
  };

  return (
    <div className="px-5 py-4 border-t border-gray-200 bg-gray-50/60 rounded-b-2xl">
      <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
        <div className="text-xs text-gray-600">
          Showing <span className=" font-outfit font-semibold text-gray-600">{(currentPage - 1) * itemsPerPage + 1}</span> to
          <span className="font-semibold font-outfit text-gray-600">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of
          <span className="font-semibold font-outfit text-gray-600">{totalItems}</span> results
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400"
            >
              <ChevronDoubleLeftIcon className="h-3 w-3 text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400"
            >
              <ChevronLeftIcon className="h-3 w-3 text-gray-600" />
            </button>
            <div className="flex items-center gap-1 mx-2">
              {getPageNumbers().map((pageNum, idx) =>
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-[10px] text-gray-400">...</span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`px-2.5 py-1 text-[10px] rounded transition-all duration-200 ${currentPage === pageNum ? 'bg-brand-primary text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-800 border border-gray-300 hover:border-gray-400'}`}
                  >
                    {pageNum}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => onPageChange(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400"
            >
              <ChevronRightIcon className="h-3 w-3 text-gray-600" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 border border-gray-300 hover:border-gray-400"
            >
              <ChevronDoubleRightIcon className="h-3 w-3 text-gray-600" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

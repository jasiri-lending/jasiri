import React from "react";
import {
  DocumentTextIcon,
  XMarkIcon,
  CalendarIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";

const VerificationDetailsModal = ({ verification, isOpen, onClose }) => {
  if (!isOpen || !verification) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentTextIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Verification Details
              </h2>
              <p className="text-sm text-gray-600">
                BM Verification Information
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Verification Status */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-700">Status</span>
            <span
              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                verification.status === "verified"
                  ? "bg-green-100 text-green-800"
                  : verification.status === "rejected"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {verification.status?.charAt(0).toUpperCase() +
                verification.status?.slice(1)}
            </span>
          </div>

          {/* Verification Date */}
          {verification.verification_date && (
            <div className="flex items-center space-x-3 p-3">
              <CalendarIcon className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Verified Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(
                    verification.verification_date
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {/* Comments */}
          {verification.comments && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Comments
              </label>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-800">{verification.comments}</p>
              </div>
            </div>
          )}

          {/* Additional Details */}
          <div className="grid grid-cols-1 gap-3 pt-2">
            {verification.verified_amount && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Verified Amount</span>
                <span className="text-sm font-semibold text-green-600">
                  KES {Number(verification.verified_amount).toLocaleString()}
                </span>
              </div>
            )}

            {verification.location && (
              <div className="flex items-center space-x-2">
                <MapPinIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {verification.location}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationDetailsModal;

// src/components/StatusBadge.jsx
import React from 'react';

const StatusBadge = ({ status }) => {
  const getStatusStyles = (status) => {
    const statusValue = typeof status === 'string' ? status.toLowerCase() : '';
    
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      bm_review: 'bg-blue-100 text-blue-800',
      ca_review: 'bg-indigo-100 text-indigo-800',
      cso_review: 'bg-purple-100 text-purple-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      'sent_back_by_bm': 'bg-orange-100 text-orange-800',
      'sent_back_by_ca': 'bg-orange-100 text-orange-800',
      'sent_back_by_cso': 'bg-orange-100 text-orange-800',
      'cso_review_amend': 'bg-purple-100 text-purple-800',
      'bm_review_amend': 'bg-blue-100 text-blue-800',
      'ca_review_amend': 'bg-indigo-100 text-indigo-800',
      successful: 'bg-green-100 text-green-800',
      suspense: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      reconciled: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-800',
      applied: 'bg-green-100 text-green-800'
    };

    return styles[statusValue] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Pending',
      bm_review: 'BM Review',
      ca_review: 'CA Review',
      cso_review: 'CSO Review',
      approved: 'Approved',
      rejected: 'Rejected',
      'sent_back_by_bm': 'Sent Back by BM',
      'sent_back_by_ca': 'Sent Back by CA',
      'sent_back_by_cso': 'Sent Back by CSO',
      'cso_review_amend': 'CSO Review (Amend)',
      'bm_review_amend': 'BM Review (Amend)',
      'ca_review_amend': 'CA Review (Amend)',
      successful: 'Successful',
      suspense: 'Suspense',
      failed: 'Failed',
      reconciled: 'Reconciled',
      archived: 'Archived',
      applied: 'Applied'
    };

    return labels[status?.toLowerCase()] || status || 'Unknown';
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusStyles(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
};

export default StatusBadge;
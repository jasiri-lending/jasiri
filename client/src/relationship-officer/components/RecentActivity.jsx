// src/pages/relationship-officer/components/RecentActivity.jsx
import React from 'react'
import { 
  PhoneIcon, 
  EnvelopeIcon,
  UserPlusIcon 
} from '@heroicons/react/24/outline'

const RecentActivity = ({ activities }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800'
      case 'warm': return 'bg-yellow-100 text-yellow-800'
      case 'cold': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getActivityIcon = (type) => {
    switch (type) {
      case 'phone': return PhoneIcon
      case 'email': return EnvelopeIcon
      default: return UserPlusIcon
    }
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <UserPlusIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No recent activities</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
          <div className="flex-shrink-0">
            <div className={`p-2 rounded-full bg-blue-100 text-blue-600`}>
              <UserPlusIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {activity.full_name}
            </p>
            <p className="text-sm text-gray-500 truncate">{activity.phone}</p>
          </div>
          <div className="flex-shrink-0">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status)}`}>
              {activity.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default RecentActivity
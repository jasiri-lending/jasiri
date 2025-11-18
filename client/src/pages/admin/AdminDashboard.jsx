import { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Coins,
  UserPlus,
  CheckCircle,
  FileBarChart,
  Settings,
  Shield,
  Activity,
  Clock,
  XCircle,
  CreditCard,
} from 'lucide-react';
import { supabase } from "../../supabaseClient";

const AdminDashboard = () => {
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick Actions (static - same as original)
  const quickActions = [
    { 
      name: 'Add User', 
      icon: UserPlus, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      hoverBorder: 'hover:border-blue-300'
    },
    { 
      name: 'Approve Loan', 
      icon: CheckCircle, 
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      hoverBorder: 'hover:border-green-300'
    },
    { 
      name: 'Generate Report', 
      icon: FileBarChart, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      hoverBorder: 'hover:border-purple-300'
    },
    { 
      name: 'System Settings', 
      icon: Settings, 
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      hoverBorder: 'hover:border-red-300'
    },
    { 
      name: 'View Analytics', 
      icon: TrendingUp, 
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      hoverBorder: 'hover:border-cyan-300'
    },
    { 
      name: 'Security Center', 
      icon: Shield, 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      hoverBorder: 'hover:border-yellow-300'
    },
  ];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [
        totalUsers,
        totalCustomers,
        activeLoans,
        totalDisbursed,
        outstandingAmount,
        repaymentRate,
        revenue,
        pendingApprovals,
        overdueLoans,
        recentActivities,
        passwordResetRequests,
        systemAlerts
      ] = await Promise.all([
        fetchTotalUsers(),
        fetchTotalCustomers(),
        fetchActiveLoans(),
        fetchTotalDisbursed(),
        fetchOutstandingAmount(),
        fetchRepaymentRate(),
        fetchRevenue(),
        fetchPendingApprovals(),
        fetchOverdueLoans(),
        fetchRecentActivity(),
        fetchPasswordResetRequests(),
        fetchSystemAlerts()
      ]);

      // Update stats with real data
      setStats([
        { 
          name: 'Total Users', 
          value: totalUsers.toLocaleString(), 
          change: await calculateUserGrowth(), 
          icon: Users, 
          color: 'bg-blue-500', 
          changeType: 'positive',
          description: 'Active system users'
        },
        { 
          name: 'Total Customers', 
          value: totalCustomers.toLocaleString(), 
          change: await calculateCustomerGrowth(), 
          icon: Users, 
          color: 'bg-green-500', 
          changeType: 'positive',
          description: 'Registered customers'
        },
        { 
          name: 'Active Loans', 
          value: activeLoans.toLocaleString(), 
          change: await calculateLoanGrowth(), 
          icon: FileText, 
          color: 'bg-purple-500', 
          changeType: 'positive',
          description: 'Currently running'
        },
        { 
          name: 'Total Disbursed', 
          value: `KES ${(totalDisbursed / 1000000).toFixed(1)}M`, 
          change: await calculateDisbursementGrowth(), 
          icon: DollarSign, 
          color: 'bg-orange-500', 
          changeType: 'positive',
          description: 'This month'
        },
        { 
          name: 'Outstanding', 
          value: `KES ${(outstandingAmount / 1000000).toFixed(1)}M`, 
          change: await calculateOutstandingChange(), 
          icon: AlertTriangle, 
          color: 'bg-cyan-500', 
          changeType: 'negative',
          description: 'Pending collection'
        },
        { 
          name: 'Revenue (MTD)', 
          value: `KES ${(revenue / 1000000).toFixed(1)}M`, 
          change: await calculateRevenueGrowth(), 
          icon: Coins, 
          color: 'bg-indigo-500', 
          changeType: 'positive',
          description: 'Interest & fees'
        },
      ]);

      // Update pending actions with real data
      setPendingActions([
        { 
          title: 'Pending Loan Approvals', 
          count: pendingApprovals, 
          priority: 'high',
          icon: Clock,
          color: 'text-red-600',
          bgColor: 'bg-red-50'
        },
        { 
          title: 'Password Reset Requests', 
          count: passwordResetRequests, 
          priority: 'medium',
          icon: Shield,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50'
        },
        { 
          title: 'Overdue Loans', 
          count: overdueLoans, 
          priority: 'high',
          icon: AlertTriangle,
          color: 'text-orange-600',
          bgColor: 'bg-orange-50'
        },
        { 
          title: 'System Alerts', 
          count: systemAlerts, 
          priority: 'low',
          icon: Activity,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50'
        },
      ]);

      setRecentActivity(recentActivities);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch total users (system users/admins)
  const fetchTotalUsers = async () => {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching users:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch total customers (loan applicants/borrowers)
  const fetchTotalCustomers = async () => {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching customers:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch active loans
  const fetchActiveLoans = async () => {
    const { count, error } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'disbursed', 'approved']);
    
    if (error) {
      console.error('Error fetching active loans:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch total disbursed amount for current month
  const fetchTotalDisbursed = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const { data, error } = await supabase
      .from('loans')
      .select('amount, disbursed_at')
      .eq('status', 'disbursed')
      .gte('disbursed_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('disbursed_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error('Error fetching disbursed amount:', error);
      return 0;
    }

    return data?.reduce((sum, loan) => sum + (loan.amount || 0), 0) || 0;
  };

  // Fetch outstanding amount
  const fetchOutstandingAmount = async () => {
    const { data, error } = await supabase
      .from('loans')
      .select('amount, amount_paid')
      .in('status', ['active', 'disbursed']);

    if (error) {
      console.error('Error fetching outstanding amount:', error);
      return 0;
    }

    return data?.reduce((sum, loan) => {
      const remaining = (loan.amount || 0) - (loan.amount_paid || 0);
      return sum + Math.max(0, remaining);
    }, 0) || 0;
  };

  // Fetch repayment rate
  const fetchRepaymentRate = async () => {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .gte('payment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error fetching payments:', error);
      return 0;
    }

    const totalPayments = payments?.length || 0;
    const onTimePayments = payments?.filter(p => p.status === 'completed' && !p.is_late)?.length || 0;
    
    return totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;
  };

  // Fetch revenue
  const fetchRevenue = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const { data, error } = await supabase
      .from('payments')
      .select('interest_amount, fees, payment_date')
      .eq('status', 'completed')
      .gte('payment_date', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('payment_date', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    if (error) {
      console.error('Error fetching revenue:', error);
      return 0;
    }

    return data?.reduce((sum, payment) => sum + (payment.interest_amount || 0) + (payment.fees || 0), 0) || 0;
  };

  // Fetch pending loan approvals
  const fetchPendingApprovals = async () => {
    const { count, error } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'disbursed');
    
    if (error) {
      console.error('Error fetching pending approvals:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch overdue loans
  const fetchOverdueLoans = async () => {
    const { count, error } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'overdue');
    
    if (error) {
      console.error('Error fetching overdue loans:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch password reset requests
  const fetchPasswordResetRequests = async () => {
    const { count, error } = await supabase
      .from('password_reset_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    if (error) {
      console.error('Error fetching password reset requests:', error);
      return 0;
    }
    
    return count || 0;
  };

  // Fetch system alerts
  const fetchSystemAlerts = async () => {
    const { count, error } = await supabase
      .from('system_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    if (error) {
      console.error('Error fetching system alerts:', error);
      return 0;
    }
    
    return count || 0;
  };
// Fetch recent activity across all regions and branches
  const fetchRecentActivity = async () => {
    try {
      const activities = [];

      // 1. Fetch recent loan activities with customer, region, and branch info
      const { data: loanActivities, error: loansError } = await supabase
        .from("loans")
        .select(`
          *,
          customers:customer_id (
            Firstname,
            Surname
          ),
          regions:region_id (
            region_name
          ),
          branches:branch_id (
            branch_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(2);

      if (loansError) console.error('Loans error:', loansError);

      // 2. Fetch recent payments with customer info
      const { data: recentPayments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          status,
          created_at,
          customers:customer_id (
            Firstname,
            Surname
          )
        `)
        .order('payment_date', { ascending: false })
        .limit(2);

      if (paymentsError) console.error('Payments error:', paymentsError);

      // 3. Fetch new user registrations
      const { data: newUsers, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (usersError) console.error('Users error:', usersError);

      // 4. Fetch new customer registrations with region/branch
      const { data: newCustomers, error: customersError } = await supabase
        .from('customers')
        .select(`
          id,
          Firstname,
          Surname,
          created_at,
          regions:region_id (
            region_name
          ),
          branches:branch_id (
            branch_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(2);

      if (customersError) console.error('Customers error:', customersError);

      // 5. Fetch user login activities (if you have an audit/login table)
      const { data: loginActivities, error: loginError } = await supabase
        .from('user_login_logs')
        .select(`
          id,
          created_at,
          users:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(2);

      if (loginError) console.error('Login logs error:', loginError);

      // Format loan activities
      loanActivities?.forEach(loan => {
        let action = '';
        let type = 'info';
        let icon = FileText;
        const location = loan.branches?.branch_name 
          ? `${loan.branches.branch_name}${loan.regions?.region_name ? `, ${loan.regions.region_name}` : ''}`
          : loan.regions?.region_name || 'Unknown location';

        switch (loan.status) {
          case 'approved':
            action = 'Loan Approved';
            type = 'success';
            icon = CheckCircle;
            break;
          case 'rejected':
            action = 'Loan Rejected';
            type = 'error';
            icon = XCircle;
            break;
          case 'pending':
            action = 'Loan Application';
            type = 'info';
            icon = Clock;
            break;
          case 'disbursed':
            action = 'Loan Disbursed';
            type = 'success';
            icon = DollarSign;
            break;
          default:
            action = 'Loan Updated';
            type = 'info';
            icon = FileText;
        }

        activities.push({
          action,
          user: `${loan.customers?.Firstname || 'Unknown'} ${loan.customers?.Surname || ''}`.trim(),
          details: `KES ${loan.amount?.toLocaleString()} • ${location}`,
          time: loan.updated_at || loan.created_at,
          type,
          icon
        });
      });

      // Format payment activities
      recentPayments?.forEach(payment => {
        activities.push({
          action: 'Payment Received',
          user: `${payment.customers?.Firstname || 'Unknown'} ${payment.customers?.Surname || ''}`.trim(),
          details: `KES ${payment.amount?.toLocaleString()}`,
          time: payment.payment_date || payment.created_at,
          type: payment.status === 'completed' ? 'success' : 'info',
          icon: CreditCard
        });
      });

      // Format new user registrations
      newUsers?.forEach(user => {
        activities.push({
          action: 'New User Registered',
          user: user.full_name || user.email,
          details: `Role: ${user.role || 'User'}`,
          time: user.created_at,
          type: 'info',
          icon: UserPlus
        });
      });

      // Format new customer registrations
      newCustomers?.forEach(customer => {
        const location = customer.branches?.branch_name 
          ? `${customer.branches.branch_name}${customer.regions?.region_name ? `, ${customer.regions.region_name}` : ''}`
          : customer.regions?.region_name || '';

        activities.push({
          action: 'New Customer',
          user: `${customer.Firstname || ''} ${customer.Surname || ''}`.trim() || 'Unknown',
          details: location ? `Registered in ${location}` : 'Registered',
          time: customer.created_at,
          type: 'success',
          icon: Users
        });
      });

      // Format login activities
      loginActivities?.forEach(login => {
        activities.push({
          action: 'User Login',
          user: login.users?.full_name || login.users?.email || 'Unknown',
          details: 'Signed in',
          time: login.created_at,
          type: 'info',
          icon: Activity
        });
      });

      // Sort all activities by time (most recent first) and return top 10
      return activities
        .filter(activity => activity.time) // Remove activities without timestamp
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 10)
        .map(activity => ({
          ...activity,
          time: formatTimeAgo(activity.time)
        }));

    } catch (error) {
      console.error('Error fetching recent activity:', error);
      return [];
    }
  };

  // Growth calculation functions
  const calculateUserGrowth = async () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const { count: currentCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
      .lt('created_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

    const { count: previousCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${lastMonthYear}-${lastMonth.toString().padStart(2, '0')}-01`)
      .lt('created_at', `${lastMonthYear}-${(lastMonth + 1).toString().padStart(2, '0')}-01`);

    if (!previousCount || previousCount === 0) return '+0%';
    
    const growth = ((currentCount - previousCount) / previousCount) * 100;
    return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
  };

  const calculateCustomerGrowth = async () => {
    // Similar implementation as calculateUserGrowth but for customers
    return '+8.2%'; // Placeholder - implement similar to calculateUserGrowth
  };

  const calculateLoanGrowth = async () => {
    // Similar implementation as calculateUserGrowth but for loans
    return '+8.2%'; // Placeholder - implement similar to calculateUserGrowth
  };

  const calculateDisbursementGrowth = async () => {
    // Similar implementation as calculateUserGrowth but for disbursements
    return '+15.3%'; // Placeholder - implement similar to calculateUserGrowth
  };

  const calculateOutstandingChange = async () => {
    // Calculate change in outstanding amount
    return '-3.1%'; // Placeholder - implement similar to calculateUserGrowth
  };

  const calculateRevenueGrowth = async () => {
    // Similar implementation as calculateUserGrowth but for revenue
    return '+18.7%'; // Placeholder - implement similar to calculateUserGrowth
  };

  // Helper function to format time ago
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now - time) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            
          

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {stats.map((stat) => (
                <div 
                  key={stat.name} 
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                      <div className="flex items-center justify-between mt-3">
                        <p className={`text-sm font-medium ${
                          stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stat.change}
                        </p>
                        <p className="text-xs text-gray-500">{stat.description}</p>
                      </div>
                    </div>
                    <div className={`${stat.color} w-14 h-14 rounded-xl flex items-center justify-center ml-4 flex-shrink-0`}>
                      <stat.icon className="h-7 w-7 text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {pendingActions.map((action, index) => (
                <div 
                  key={index}
                  className={`${action.bgColor} rounded-xl p-5 border-2 border-transparent hover:border-gray-200 transition-all duration-200 cursor-pointer`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <action.icon className={`h-6 w-6 ${action.color}`} />
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      action.priority === 'high' ? 'bg-red-100 text-red-700' :
                      action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {action.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">{action.title}</p>
                  <p className={`text-2xl font-bold ${action.color}`}>{action.count}</p>
                </div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              
              {/* Recent Activity */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                  <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    View All
                  </button>
                </div>
                <div className="space-y-4">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div 
                        key={index} 
                        className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors duration-150"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          activity.type === 'success' ? 'bg-green-100' :
                          activity.type === 'warning' ? 'bg-yellow-100' :
                          activity.type === 'error' ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          <activity.icon className={`h-5 w-5 ${
                            activity.type === 'success' ? 'text-green-600' :
                            activity.type === 'warning' ? 'text-yellow-600' :
                            activity.type === 'error' ? 'text-red-600' : 'text-blue-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{activity.action}</p>
                          <p className="text-sm text-gray-600 mt-0.5">
                            <span className="font-medium">{activity.user}</span>
                            {' • '}
                            {activity.details}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No recent activity found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h3>
                <div className="space-y-3">
                  {quickActions.map((action, index) => (
                    <button 
                      key={index}
                      className={`w-full p-4 border-2 border-gray-200 rounded-lg ${action.hoverBorder} hover:shadow-sm transition-all duration-200 text-left group`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`${action.bgColor} w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                          <action.icon className={`h-5 w-5 ${action.color}`} />
                        </div>
                        <span className="text-sm font-medium text-gray-900">{action.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* System Health Status */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-xl shadow-lg p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Shield className="h-6 w-6" />
                    <h3 className="text-xl font-bold">System Health</h3>
                  </div>
                  <p className="text-red-100">All systems operational • Last checked: Just now</p>
                  <div className="flex items-center space-x-6 mt-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Database</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">API Services</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Payment Gateway</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm font-semibold">Online</span>
                  </div>
                  <span className="text-xs text-red-100">Uptime: 99.98%</span>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
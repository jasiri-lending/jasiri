import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, TrendingUp, FileText, Bell, ChevronRight, LogOut, CircleDot } from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import apiClient from '../../services/apiClient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface StatCardProps {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  bg: string;
  index: number;
}

function StatCard({ icon: Icon, label, value, color, bg, index }: StatCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()} className="flex-1 min-w-[45%] m-2">
      <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <View className={`w-10 h-10 rounded-xl items-center justify-center mb-3`} style={{ backgroundColor: bg }}>
          <Icon size={20} color={color} />
        </View>
        <Text className="text-2xl font-bold text-gray-800">{value ?? '-'}</Text>
        <Text className="text-xs text-gray-500 mt-1">{label}</Text>
      </View>
    </Animated.View>
  );
}

interface ActivityItemProps {
  type: string;
  name: string;
  time: string;
  index: number;
}

function ActivityItem({ type, name, time, index }: ActivityItemProps) {
  const colors: Record<string, string> = { customer: '#10B981', lead: '#FACC15', loan: '#1E3A8A' };
  const color = colors[type] ?? '#9CA3AF';
  const labels: Record<string, string> = { customer: 'New Customer', lead: 'New Lead', loan: 'Loan Applied' };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <View className="flex-row items-center py-3 border-b border-gray-100">
        <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <CircleDot size={16} color={color} />
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-sm font-semibold text-gray-700">{labels[type] ?? type}</Text>
          <Text className="text-xs text-gray-400">{name}</Text>
        </View>
        <Text className="text-xs text-gray-400">{time}</Text>
      </View>
    </Animated.View>
  );
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await apiClient.get('/ro/dashboard-stats');
      if (res.data.success) {
        setStats(res.data.stats);
        setRecentActivity(res.data.recentActivity ?? []);
      }
    } catch (e) {
      // Use placeholder data if endpoint not ready
      setStats({ totalCustomers: '--', totalLeads: '--', totalLoans: '--', conversionRate: '--' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const onRefresh = () => { setRefreshing(true); loadDashboard(); };

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 pt-4 pb-6 bg-primary rounded-b-3xl">
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-blue-200 text-sm">{greet()},</Text>
            <Text className="text-white text-xl font-bold mt-1">
              {user?.profile?.full_name ?? 'Relationship Officer'}
            </Text>
            <Text className="text-blue-300 text-xs mt-1">
              {user?.profile?.branch ?? 'Jasiri Field Team'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <LogOut size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} />}
      >
        {/* Stats Section */}
        <View className="px-4 mt-6">
          <Text className="text-lg font-bold text-gray-800 mb-2 px-2">Your Overview</Text>
          {loading ? (
            <ActivityIndicator color="#1E3A8A" size="large" className="mt-10" />
          ) : (
            <View className="flex-row flex-wrap">
              <StatCard icon={Users} label="Total Customers" value={stats?.totalCustomers} color="#1E3A8A" bg="#E7F0FA" index={0} />
              <StatCard icon={TrendingUp} label="Active Leads" value={stats?.totalLeads} color="#10B981" bg="#D1FAE5" index={1} />
              <StatCard icon={FileText} label="Loans Applied" value={stats?.totalLoans} color="#586ab1" bg="#EEF2FF" index={2} />
              <StatCard icon={Bell} label="Conversion Rate" value={stats?.conversionRate} color="#FACC15" bg="#FEF9C3" index={3} />
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View className="px-6 mt-8">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-gray-800">Recent Activity</Text>
            <TouchableOpacity className="flex-row items-center">
              <Text className="text-primary text-sm font-semibold">See All</Text>
              <ChevronRight size={16} color="#1E3A8A" />
            </TouchableOpacity>
          </View>
          <View className="bg-white rounded-2xl px-4 border border-gray-100 shadow-sm">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 6).map((item: any, i: number) => (
                <ActivityItem key={i} type={item.type} name={item.name} time={item.time} index={i} />
              ))
            ) : (
              <View className="py-10 items-center">
                <Text className="text-gray-400">No recent activity yet.</Text>
                <Text className="text-gray-300 text-xs mt-1">Register a customer to get started!</Text>
              </View>
            )}
          </View>
        </View>

        <View className="h-24" />
      </ScrollView>
    </SafeAreaView>
  );
}

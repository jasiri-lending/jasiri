import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, User, ChevronRight, Phone, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import apiClient from '../../services/apiClient';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  id_number: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981', pending: '#FACC15', inactive: '#EF4444', approved: '#1E3A8A',
};

function CustomerCard({ item, index }: { item: Customer; index: number }) {
  const statusColor = STATUS_COLORS[item.status] ?? '#9CA3AF';
  const initials = `${item.first_name?.[0] ?? ''}${item.last_name?.[0] ?? ''}`.toUpperCase();

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <TouchableOpacity className="bg-white mx-4 mb-3 rounded-2xl p-4 shadow-sm border border-gray-100 flex-row items-center">
        <View className="w-11 h-11 rounded-full bg-primary items-center justify-center mr-3">
          <Text className="text-white font-bold text-sm">{initials || '??'}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-gray-800 font-bold text-sm">{item.first_name} {item.last_name}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{item.phone} · ID: {item.id_number}</Text>
          <Text className="text-gray-300 text-xs mt-0.5">{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        <View className="items-end gap-2">
          <View className="px-2 py-1 rounded-full" style={{ backgroundColor: `${statusColor}20` }}>
            <Text className="text-xs font-bold capitalize" style={{ color: statusColor }}>{item.status ?? 'pending'}</Text>
          </View>
          <ChevronRight size={16} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CustomersScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await apiClient.get('/ro/customers');
      setCustomers(res.data.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);
  useEffect(() => {
    if (!search) { setFiltered(customers); return; }
    const q = search.toLowerCase();
    setFiltered(customers.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.phone.includes(q) || c.id_number.includes(q)
    ));
  }, [customers, search]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchCustomers(); }, []);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 pt-4 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-800">Customers</Text>
          <Text className="text-gray-400 text-sm">{customers.length} registered</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/new-customer')}
          className="bg-primary w-10 h-10 rounded-full items-center justify-center shadow-sm"
        >
          <Plus size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View className="flex-row items-center bg-white border border-gray-200 mx-4 rounded-2xl px-4 py-3 mb-4">
        <Search size={18} color="#9CA3AF" />
        <TextInput
          className="flex-1 ml-3 text-gray-700 text-sm"
          placeholder="Search by name, phone, or ID..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#1E3A8A" size="large" className="mt-20" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => <CustomerCard item={item} index={index} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1E3A8A']} />}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <User size={48} color="#D1D5DB" />
              <Text className="text-gray-400 text-lg font-semibold mt-4">No Customers Yet</Text>
              <Text className="text-gray-300 text-sm mt-1">Tap + to register your first customer</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </SafeAreaView>
  );
}

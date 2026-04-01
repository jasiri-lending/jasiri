import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Phone, MessageSquare, User, ChevronRight, Flame, Thermometer, Wind } from 'lucide-react-native';
import apiClient from '../../services/apiClient';
import Animated, { FadeInDown } from 'react-native-reanimated';

type LeadStatus = 'hot' | 'warm' | 'cold';

interface Lead {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  source: string;
  created_at: string;
}

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; icon: any }> = {
  hot:  { label: 'Hot',  color: '#EF4444', bg: '#FEE2E2', icon: Flame },
  warm: { label: 'Warm', color: '#F59E0B', bg: '#FEF3C7', icon: Thermometer },
  cold: { label: 'Cold', color: '#3B82F6', bg: '#DBEAFE', icon: Wind },
};

function LeadCard({ item, index, onStatusChange }: { item: Lead; index: number; onStatusChange: (id: string, status: LeadStatus) => void }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.cold;
  const Icon = cfg.icon;

  const callLead = () => Linking.openURL(`tel:${item.phone}`);
  const whatsappLead = () => {
    const cleaned = item.phone.replace(/\D/g, '').replace(/^0/, '254');
    Linking.openURL(`https://wa.me/${cleaned}`);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View className="bg-white mx-4 mb-3 rounded-2xl p-4 shadow-sm border border-gray-100">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-brand-surface items-center justify-center mr-3">
              <User size={18} color="#2E5E99" />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-bold text-sm">{item.name}</Text>
              <Text className="text-gray-400 text-xs">{item.phone}</Text>
            </View>
          </View>
          <View className="flex-row items-center px-3 py-1 rounded-full" style={{ backgroundColor: cfg.bg }}>
            <Icon size={12} color={cfg.color} />
            <Text className="text-xs font-bold ml-1" style={{ color: cfg.color }}>{cfg.label}</Text>
          </View>
        </View>

        <Text className="text-xs text-gray-400 mb-3">Source: {item.source ?? 'Walk-in'} · {new Date(item.created_at).toLocaleDateString()}</Text>

        {/* Action Buttons */}
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={callLead} className="flex-1 flex-row items-center justify-center bg-primary/10 rounded-xl py-2.5">
            <Phone size={15} color="#1E3A8A" />
            <Text className="text-primary text-xs font-bold ml-1.5">Call</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={whatsappLead} className="flex-1 flex-row items-center justify-center bg-green-50 rounded-xl py-2.5">
            <MessageSquare size={15} color="#10B981" />
            <Text className="text-accent text-xs font-bold ml-1.5">WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const next: LeadStatus = item.status === 'cold' ? 'warm' : item.status === 'warm' ? 'hot' : 'cold';
              onStatusChange(item.id, next);
            }}
            className="flex-1 flex-row items-center justify-center bg-gray-100 rounded-xl py-2.5 border border-gray-200"
          >
            <ChevronRight size={15} color="#6B7280" />
            <Text className="text-gray-600 text-xs font-bold ml-1.5">Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

export default function LeadsScreen() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtered, setFiltered] = useState<Lead[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | LeadStatus>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLeads(); }, []);

  useEffect(() => {
    let data = leads;
    if (activeFilter !== 'all') data = data.filter(l => l.status === activeFilter);
    if (search) data = data.filter(l => l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search));
    setFiltered(data);
  }, [leads, search, activeFilter]);

  const fetchLeads = async () => {
    try {
      const res = await apiClient.get('/ro/leads');
      setLeads(res.data.leads ?? []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: LeadStatus) => {
    try {
      await apiClient.patch(`/ro/leads/${id}`, { status });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } catch {
      Alert.alert('Error', 'Could not update lead status.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-6 pt-4 pb-4">
        <Text className="text-2xl font-bold text-gray-800">My Leads</Text>
        <Text className="text-gray-400 text-sm">{leads.length} total contacts</Text>
      </View>

      {/* Search */}
      <View className="flex-row items-center bg-white border border-gray-200 mx-4 rounded-2xl px-4 py-3 mb-4">
        <Search size={18} color="#9CA3AF" />
        <TextInput
          className="flex-1 ml-3 text-gray-700 text-sm"
          placeholder="Search by name or phone..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filters */}
      <View className="flex-row px-4 mb-4 gap-2">
        {(['all', 'hot', 'warm', 'cold'] as const).map(f => {
          const isCfg = f !== 'all';
          const cfg = isCfg ? STATUS_CONFIG[f] : null;
          const selected = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full border ${selected ? 'border-primary bg-primary' : 'border-gray-200 bg-white'}`}
            >
              <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-500'}`}
                style={!selected && cfg ? { color: cfg.color } : {}}
              >
                {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color="#1E3A8A" size="large" className="mt-20" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <LeadCard item={item} index={index} onStatusChange={updateStatus} />
          )}
          ListEmptyComponent={
            <View className="items-center mt-20">
              <Text className="text-gray-400 text-lg font-semibold">No leads found</Text>
              <Text className="text-gray-300 text-sm mt-1">Start collecting leads from the field!</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

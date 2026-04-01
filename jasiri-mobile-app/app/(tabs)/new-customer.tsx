import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Camera, ChevronLeft, ChevronRight, Check, User, Phone, Home, FileText } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import apiClient from '../../services/apiClient';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';

const STEPS = ['Personal', 'Contact', 'Address', 'Documents'];

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row items-center justify-center mt-4 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <View
            className={`w-8 h-8 rounded-full items-center justify-center ${i < current ? 'bg-accent' : i === current ? 'bg-primary' : 'bg-gray-200'}`}
          >
            {i < current ? (
              <Check size={14} color="#FFF" />
            ) : (
              <Text className={`text-xs font-bold ${i === current ? 'text-white' : 'text-gray-400'}`}>{i + 1}</Text>
            )}
          </View>
          {i < total - 1 && (
            <View className={`h-0.5 w-8 ${i < current ? 'bg-accent' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

function FormInput({ label, icon: Icon, ...props }: any) {
  return (
    <View className="mb-4">
      <Text className="text-gray-600 text-sm font-semibold mb-1 ml-1">{label}</Text>
      <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5">
        {Icon && <Icon size={18} color="#9CA3AF" />}
        <TextInput
          className="flex-1 ml-2 text-gray-800 text-sm"
          placeholderTextColor="#9CA3AF"
          {...props}
        />
      </View>
    </View>
  );
}

export default function NewCustomerScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  const [form, setForm] = useState({
    first_name: '', last_name: '', dob: '', id_number: '', gender: '',
    phone: '', alt_phone: '', email: '',
    address: '', city: '', county: '',
    latitude: '', longitude: '',
    marital_status: '', employment_status: '', business_name: '',
  });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Location access is required.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      set('latitude', loc.coords.latitude.toFixed(7));
      set('longitude', loc.coords.longitude.toFixed(7));
    } catch (e) {
      Alert.alert('Error', 'Could not capture location.');
    } finally {
      setGpsLoading(false);
    }
  };

  const pickPhoto = async (setter: (s: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (!result.canceled && result.assets[0]) setter(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = { ...form };
      const res = await apiClient.post('/ro/customers/register', payload);
      if (res.data.success) {
        Alert.alert('Success!', 'Customer registered successfully.', [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
      } else {
        Alert.alert('Error', res.data.error ?? 'Registration failed.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.first_name && form.last_name && form.id_number;
    if (step === 1) return form.phone;
    if (step === 2) return form.address && form.city;
    return true;
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-4 flex-row items-center border-b border-gray-100 pb-4">
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : router.back()} className="mr-4">
          <ChevronLeft size={24} color="#1E3A8A" />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-bold text-gray-800">New Customer</Text>
          <Text className="text-xs text-gray-400">{STEPS[step]} Information</Text>
        </View>
      </View>

      <StepIndicator current={step} total={STEPS.length} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>

          {/* Step 0: Personal Info */}
          {step === 0 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              {/* Profile Photo */}
              <View className="items-center mb-6">
                <TouchableOpacity onPress={() => pickPhoto(s => setPhoto(s))}>
                  {photo ? (
                    <Image source={{ uri: photo }} className="w-24 h-24 rounded-2xl" />
                  ) : (
                    <View className="w-24 h-24 bg-brand-surface rounded-2xl items-center justify-center border-2 border-dashed border-brand-secondary">
                      <Camera size={28} color="#7BA4D0" />
                      <Text className="text-xs text-brand-secondary mt-1">Passport Photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <FormInput icon={User} label="First Name *" placeholder="Enter first name" value={form.first_name} onChangeText={(v: string) => set('first_name', v)} />
              <FormInput icon={User} label="Last Name *" placeholder="Enter last name" value={form.last_name} onChangeText={(v: string) => set('last_name', v)} />
              <FormInput icon={FileText} label="ID / Passport Number *" placeholder="e.g. 12345678" value={form.id_number} onChangeText={(v: string) => set('id_number', v)} keyboardType="numeric" />
              <FormInput icon={User} label="Date of Birth" placeholder="YYYY-MM-DD" value={form.dob} onChangeText={(v: string) => set('dob', v)} />
              <View className="mb-4">
                <Text className="text-gray-600 text-sm font-semibold mb-2 ml-1">Gender</Text>
                <View className="flex-row gap-3">
                  {['Male', 'Female', 'Other'].map(g => (
                    <TouchableOpacity
                      key={g} onPress={() => set('gender', g)}
                      className={`flex-1 py-3 rounded-xl items-center border ${form.gender === g ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <Text className={`text-sm font-semibold ${form.gender === g ? 'text-white' : 'text-gray-500'}`}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* Step 1: Contact */}
          {step === 1 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              <FormInput icon={Phone} label="Primary Phone *" placeholder="+254 700 000 000" value={form.phone} onChangeText={(v: string) => set('phone', v)} keyboardType="phone-pad" />
              <FormInput icon={Phone} label="Alternative Phone" placeholder="+254 700 000 000 (optional)" value={form.alt_phone} onChangeText={(v: string) => set('alt_phone', v)} keyboardType="phone-pad" />
              <FormInput icon={User} label="Email Address" placeholder="customer@email.com (optional)" value={form.email} onChangeText={(v: string) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
              <View className="mb-4">
                <Text className="text-gray-600 text-sm font-semibold mb-2 ml-1">Employment Status</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['Employed', 'Self-Employed', 'Business Owner', 'Unemployed'].map(s => (
                    <TouchableOpacity key={s} onPress={() => set('employment_status', s)}
                      className={`px-4 py-2 rounded-xl border ${form.employment_status === s ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <Text className={`text-xs font-semibold ${form.employment_status === s ? 'text-white' : 'text-gray-500'}`}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <FormInput icon={User} label="Business / Employer Name" placeholder="Business or employer name" value={form.business_name} onChangeText={(v: string) => set('business_name', v)} />
            </Animated.View>
          )}

          {/* Step 2: Address + GPS */}
          {step === 2 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              <FormInput icon={Home} label="Physical Address *" placeholder="Street / Estate / Village" value={form.address} onChangeText={(v: string) => set('address', v)} />
              <FormInput icon={Home} label="City / Town *" placeholder="e.g. Nairobi" value={form.city} onChangeText={(v: string) => set('city', v)} />
              <FormInput icon={Home} label="County" placeholder="e.g. Nairobi County" value={form.county} onChangeText={(v: string) => set('county', v)} />
              {/* GPS Capture */}
              <TouchableOpacity onPress={captureGPS} disabled={gpsLoading}
                className="flex-row items-center justify-center bg-accent rounded-xl py-4 mt-2 mb-4">
                {gpsLoading ? <ActivityIndicator color="#FFF" size="small" /> : <MapPin size={20} color="#FFF" />}
                <Text className="text-white font-bold ml-2">{gpsLoading ? 'Capturing...' : 'Capture Current Location'}</Text>
              </TouchableOpacity>
              {form.latitude ? (
                <View className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
                  <Text className="text-green-700 text-xs font-semibold">📍 Location Captured</Text>
                  <Text className="text-green-600 text-xs mt-1">Lat: {form.latitude}  |  Lng: {form.longitude}</Text>
                </View>
              ) : null}
            </Animated.View>
          )}

          {/* Step 3: Documents */}
          {step === 3 && (
            <Animated.View entering={FadeInRight} exiting={FadeOutLeft}>
              <View className="mb-6">
                <Text className="text-gray-600 text-sm font-semibold mb-3 ml-1">ID / Passport Photo</Text>
                <TouchableOpacity onPress={() => pickPhoto(s => setIdPhoto(s))}
                  className="border-2 border-dashed border-brand-secondary rounded-2xl h-44 items-center justify-center bg-brand-surface">
                  {idPhoto ? (
                    <Image source={{ uri: idPhoto }} className="w-full h-full rounded-2xl" resizeMode="cover" />
                  ) : (
                    <View className="items-center">
                      <Camera size={36} color="#7BA4D0" />
                      <Text className="text-brand-secondary font-semibold mt-2">Take Photo of ID</Text>
                      <Text className="text-gray-400 text-xs mt-1">Front side, clear and readable</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <Text className="text-yellow-700 font-semibold text-sm">Review Before Submitting</Text>
                <View className="mt-2 space-y-1">
                  <Text className="text-yellow-600 text-xs">✅ Name: {form.first_name} {form.last_name}</Text>
                  <Text className="text-yellow-600 text-xs">✅ ID: {form.id_number}</Text>
                  <Text className="text-yellow-600 text-xs">✅ Phone: {form.phone}</Text>
                  <Text className="text-yellow-600 text-xs">✅ Address: {form.address}, {form.city}</Text>
                  {form.latitude ? <Text className="text-yellow-600 text-xs">✅ GPS: {form.latitude}, {form.longitude}</Text> : <Text className="text-red-500 text-xs">⚠️ GPS Location: Not captured</Text>}
                </View>
              </View>
            </Animated.View>
          )}

          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Navigation */}
      <View className="px-6 pb-8 pt-4 bg-white border-t border-gray-100">
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            onPress={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            className={`flex-row items-center justify-center rounded-2xl py-4 ${canProceed() ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <Text className={`font-bold text-base ${canProceed() ? 'text-white' : 'text-gray-400'}`}>Next: {STEPS[step + 1]}</Text>
            <ChevronRight size={20} color={canProceed() ? '#FFF' : '#9CA3AF'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="flex-row items-center justify-center rounded-2xl py-4 bg-accent"
          >
            {loading ? <ActivityIndicator color="#FFF" /> : (
              <>
                <Check size={20} color="#FFF" />
                <Text className="text-white font-bold text-base ml-2">Submit Registration</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

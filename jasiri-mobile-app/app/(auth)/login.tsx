import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Mail, Fingerprint } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const { signIn, biometricAuth, session } = useAuth();
  const router = useRouter();

  // Try biometrics silently on mount if a session exists
  useEffect(() => {
    (async () => {
      setBioLoading(true);
      const ok = await biometricAuth();
      setBioLoading(false);
      // Navigation handled by useProtectedRoute in AuthProvider
    })();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    const result = await signIn(email.trim(), password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error ?? 'Please check your credentials.');
      return;
    }
    // Navigate to OTP verification
    router.push({ pathname: '/(auth)/verify', params: { userId: result.userId, email: email.trim() } });
  }

  async function handleBiometrics() {
    setBioLoading(true);
    const ok = await biometricAuth();
    setBioLoading(false);
    if (!ok) Alert.alert('Biometric Failed', 'No saved session found. Please log in with your email and password.');
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-8 pt-16" keyboardShouldPersistTaps="handled">

          {/* Brand Header */}
          <View className="items-center mb-12">
            <View className="w-24 h-24 bg-primary rounded-3xl items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <Text className="text-white text-4xl font-bold">J</Text>
            </View>
            <Text className="text-3xl font-bold text-primary">Jasiri RO</Text>
            <Text className="text-gray-400 text-sm mt-1">Relationship Officer Suite</Text>
            <View className="bg-accent/10 px-4 py-1.5 rounded-full mt-3">
              <Text className="text-accent text-xs font-semibold">Field Operations Platform</Text>
            </View>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View className="mb-4">
              <Text className="text-gray-700 text-sm font-semibold mb-2 ml-1">Work Email</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                <Mail size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-gray-800 text-sm"
                  placeholder="you@company.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View className="mb-2">
              <Text className="text-gray-700 text-sm font-semibold mb-2 ml-1">Password</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                <Lock size={20} color="#9CA3AF" />
                <TextInput
                  className="flex-1 ml-3 text-gray-800 text-sm"
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className="rounded-2xl py-5 mt-6 items-center justify-center flex-row shadow-md shadow-primary/20"
              style={{ backgroundColor: '#1E3A8A' }}
            >
              {loading
                ? <ActivityIndicator color="#FFF" />
                : <Text className="text-white font-bold text-base">Sign In & Send Code</Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View className="flex-row items-center my-4">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="text-gray-400 text-xs px-4">or</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Biometric Button */}
            <TouchableOpacity
              onPress={handleBiometrics}
              disabled={bioLoading}
              className="flex-row items-center justify-center border-2 border-brand-surface rounded-2xl py-4"
              style={{ backgroundColor: '#E7F0FA' }}
            >
              {bioLoading
                ? <ActivityIndicator color="#1E3A8A" size="small" />
                : (
                  <>
                    <Fingerprint size={22} color="#1E3A8A" />
                    <Text className="text-primary font-bold ml-2">Use Fingerprint / Face ID</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View className="mt-auto mb-8 items-center pt-8">
            <Text className="text-gray-300 text-xs">Jasiri Lending Platform · v2.0</Text>
            <Text className="text-gray-200 text-xs mt-1">Secured by Supabase</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

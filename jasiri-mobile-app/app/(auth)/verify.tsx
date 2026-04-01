import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock, Fingerprint, ArrowLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function OtpScreen() {
  const { userId, email } = useLocalSearchParams<{ userId: string; email: string }>();
  const { verifyOtp } = useAuth();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }
    setLoading(true);
    const result = await verifyOtp(userId, code);
    setLoading(false);
    if (!result.success) {
      Alert.alert('Verification Failed', result.error ?? 'Invalid code. Please try again.');
    }
    // On success: AuthProvider redirects to (tabs) via onAuthStateChange
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="px-8 pt-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-8">
            <ArrowLeft size={24} color="#1E3A8A" />
          </TouchableOpacity>

          {/* Icon */}
          <View className="w-16 h-16 bg-primary/10 rounded-2xl items-center justify-center mb-6">
            <Lock size={30} color="#1E3A8A" />
          </View>

          <Text className="text-2xl font-bold text-gray-800 mb-2">Verify Your Identity</Text>
          <Text className="text-gray-500 text-sm leading-relaxed mb-2">
            A 6-digit code has been sent to:
          </Text>
          <Text className="text-primary font-semibold mb-8">{email ?? 'your email'}</Text>

          {/* OTP Input */}
          <View className="mb-6">
            <Text className="text-gray-600 text-sm font-semibold mb-2 ml-1">Verification Code</Text>
            <View className="bg-gray-50 border-2 border-primary rounded-2xl px-5 py-4 items-center">
              <TextInput
                className="text-center text-3xl font-bold text-primary tracking-widest w-full"
                placeholder="------"
                placeholderTextColor="#CBD5E1"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleVerify}
            disabled={loading || code.length < 6}
            className={`rounded-2xl py-4 items-center justify-center ${code.length === 6 ? 'bg-primary' : 'bg-gray-200'}`}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text className={`font-bold text-base ${code.length === 6 ? 'text-white' : 'text-gray-400'}`}>
                Verify & Login
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity className="mt-6 items-center">
            <Text className="text-gray-400 text-sm">Didn't receive the code?</Text>
            <Text className="text-primary font-semibold mt-1">Resend Code</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

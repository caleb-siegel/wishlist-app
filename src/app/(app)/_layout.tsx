import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/auth';
import { Colors } from '@/constants/theme';
import { useColorScheme } from 'react-native';

export default function AppLayout() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Auth Guard: Redirect unauthenticated users to sign-in
  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-item"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Add Gift Idea',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="edit-item"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Edit Gift Idea',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="invite-modal"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Share & Partner Access',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="purchase-modal"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Private Purchase Vault',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="add-occasion"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Add Occasion & Reminders',
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
            fontWeight: '600',
          },
        }}
      />
    </Stack>
  );
}

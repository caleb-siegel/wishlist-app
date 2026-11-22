import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [timezone, setTimezone] = useState(
    profile?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'America/New_York'
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Validation Error', 'Display name cannot be empty.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    const { error } = await updateProfile({
      display_name: displayName.trim(),
      timezone: timezone.trim(),
    });

    setSaving(false);

    if (error) {
      Alert.alert('Update Failed', error.message);
    } else {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        ACCOUNT PROFILE
      </Text>

      {/* Profile Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <View
            style={[
              styles.inputWrapper,
              styles.disabledWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Ionicons
              name="mail-outline"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.disabledText, { color: colors.textSecondary }]}>
              {user?.email || 'N/A'}
            </Text>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Display Name
          </Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Name"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Timezone (for 9:00 AM Occasion Reminders)
          </Text>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              value={timezone}
              onChangeText={setTimezone}
              placeholder="e.g. America/New_York"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {saveSuccess && (
          <View style={[styles.successBanner, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Profile saved successfully!
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSaveProfile}
          disabled={saving}
          activeOpacity={0.8}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        ENVIRONMENT & SECURITY
      </Text>

      {/* Status Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Postgres RLS Security
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.badgeText, { color: colors.success }]}>Enforced</Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            Session Storage
          </Text>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              SecureStore (Encrypted)
            </Text>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
            App Milestone
          </Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            Milestone 1: Foundation
          </Text>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity
        style={[
          styles.signOutButton,
          { backgroundColor: colors.dangerLight, borderColor: colors.danger },
        ]}
        onPress={handleSignOut}
        activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
        <Text style={[styles.signOutText, { color: colors.danger }]}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  sectionTitle: {
    ...Typography.small,
    marginTop: Spacing.md,
    marginLeft: Spacing.xs,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.captionBold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  disabledWrapper: {
    opacity: 0.8,
  },
  disabledText: {
    ...Typography.body,
  },
  input: {
    flex: 1,
    ...Typography.body,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  successText: {
    ...Typography.captionBold,
  },
  saveButton: {
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  infoLabel: {
    ...Typography.body,
  },
  infoValue: {
    ...Typography.bodyBold,
  },
  separator: {
    height: 1,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  signOutText: {
    ...Typography.bodyBold,
  },
});

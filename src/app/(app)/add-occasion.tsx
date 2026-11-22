import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { OccasionsService } from '@/services/occasions';
import { SharingService } from '@/services/sharing';
import { NotificationService } from '@/services/notifications';
import { calculateOneMonthPriorDate, calculateNextOccurrence } from '@/utils/date-utils';
import { WishlistShare, Profile } from '@/types/database.types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const QUICK_OCCASIONS = ['🎂 Birthday', '💍 Anniversary', '💝 Valentine\'s Day', '🎄 Christmas'];

export default function AddOccasionScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const now = new Date();
  const [name, setName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(now.getDate());
  const [recursAnnually, setRecursAnnually] = useState(true);

  // Connected partners eligible for reminders
  const [partners, setPartners] = useState<(WishlistShare & { viewer_profile?: Profile })[]>([]);
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<string[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    SharingService.getActiveSharesAsOwner(user.id)
      .then(({ shares }) => {
        setPartners(shares);
        // By default, select all active partners for reminders
        setSelectedPartnerIds(shares.map((s) => s.viewer_user_id));
      })
      .finally(() => setLoadingPartners(false));
  }, [user]);

  // Calculate reminder preview
  const currentYear = now.getFullYear();
  const dateString = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(
    selectedDay
  ).padStart(2, '0')}`;
  const occurrenceInfo = calculateNextOccurrence(dateString, recursAnnually);

  const togglePartnerReminder = (partnerId: string) => {
    if (selectedPartnerIds.includes(partnerId)) {
      setSelectedPartnerIds(selectedPartnerIds.filter((id) => id !== partnerId));
    } else {
      setSelectedPartnerIds([...selectedPartnerIds, partnerId]);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) return;

    // Register push permission
    await NotificationService.registerForPushNotifications(user.id);

    const occasionTitle = name.trim() || 'Special Occasion';
    const ownerName = profile?.display_name || 'Your partner';

    await OccasionsService.triggerTestReminder(ownerName, occasionTitle);
    Alert.alert('Test Notification Sent!', 'Check your notifications bar or lock screen to preview the alert banner.');
  };

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please give this occasion a name (e.g. Birthday).');
      return;
    }

    setIsSaving(true);

    // Request notification permissions if partners are selected
    if (selectedPartnerIds.length > 0) {
      await NotificationService.registerForPushNotifications(user.id);
    }

    const { error } = await OccasionsService.createOccasion({
      owner_user_id: user.id,
      name: name.trim(),
      date: dateString,
      recurs_annually: recursAnnually,
      viewerIdsForReminders: selectedPartnerIds,
    });

    setIsSaving(false);

    if (error) {
      Alert.alert('Save Failed', error.message);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {/* Name Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Occasion Name *</Text>

          {/* Quick chips */}
          <View style={styles.chipRow}>
            {QUICK_OCCASIONS.map((chip) => {
              const cleanChipName = chip.split(' ')[1] || chip;
              return (
                <TouchableOpacity
                  key={chip}
                  style={[
                    styles.chip,
                    name === cleanChipName
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                  ]}
                  onPress={() => setName(cleanChipName)}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: name === cleanChipName ? '#FFFFFF' : colors.text },
                    ]}>
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="e.g. Birthday, Anniversary"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>
        </View>

        {/* Date Selection Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Date</Text>

          <View style={styles.dateSelectorRow}>
            {/* Month Picker */}
            <View style={{ flex: 2, gap: 4 }}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Month</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthScroll}>
                {MONTH_NAMES.map((month, idx) => (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.monthPill,
                      selectedMonth === idx
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    ]}
                    onPress={() => setSelectedMonth(idx)}>
                    <Text
                      style={[
                        styles.monthPillText,
                        { color: selectedMonth === idx ? '#FFFFFF' : colors.text },
                      ]}>
                      {month.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Day Stepper */}
          <View style={styles.dayRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Day of Month:</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setSelectedDay(Math.max(1, selectedDay - 1))}>
                <Ionicons name="remove" size={18} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.stepValue, { color: colors.text }]}>{selectedDay}</Text>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: colors.backgroundElement }]}
                onPress={() => setSelectedDay(Math.min(31, selectedDay + 1))}>
                <Ionicons name="add" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Recurs annually toggle */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: colors.text }]}>Recurs Annually</Text>
              <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                Repeats every year automatically
              </Text>
            </View>
            <Switch
              value={recursAnnually}
              onValueChange={setRecursAnnually}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>

        {/* 1-Month Reminder Schedule Preview */}
        <View
          style={[
            styles.previewCard,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}>
          <Ionicons name="notifications" size={24} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.previewTitle, { color: colors.primary }]}>
              1-Month Push Reminder
            </Text>
            <Text style={[styles.previewBody, { color: colors.textSecondary }]}>
              Scheduled for:{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {occurrenceInfo.nextReminderDate.toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                at 9:00 AM
              </Text>
            </Text>
            <Text style={[styles.previewSubtext, { color: colors.textSecondary }]}>
              ({occurrenceInfo.daysUntilOccasion} days until occasion)
            </Text>
          </View>
        </View>

        {/* Partner Reminders Selection */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Who Should Receive Reminders?
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Select connected partners to receive the 1-month-prior notification.
          </Text>

          {loadingPartners ? (
            <ActivityIndicator color={colors.primary} />
          ) : partners.length === 0 ? (
            <Text style={[styles.noPartnersText, { color: colors.textSecondary }]}>
              You haven't connected with any partners yet. You can invite a partner anytime under the
              Shared tab.
            </Text>
          ) : (
            partners.map((partner) => {
              const isSelected = selectedPartnerIds.includes(partner.viewer_user_id);
              const partnerName = partner.viewer_profile?.display_name || 'Partner';

              return (
                <TouchableOpacity
                  key={partner.id}
                  style={[
                    styles.partnerRow,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    isSelected && { borderColor: colors.primary },
                  ]}
                  onPress={() => togglePartnerReminder(partner.viewer_user_id)}
                  activeOpacity={0.8}>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.partnerRowName, { color: colors.text }]}>
                      {partnerName}
                    </Text>
                    <Text style={[styles.partnerRowSub, { color: colors.textSecondary }]}>
                      Will be reminded 1 month before
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Instant Test Alert Button */}
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSendTestNotification}
          activeOpacity={0.8}>
          <Ionicons name="paper-plane-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.testButtonText, { color: colors.primary }]}>
            Send Immediate Test Alert (Preview on Phone)
          </Text>
        </TouchableOpacity>

        {/* Save CTA */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            isSaving && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Occasion</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  sectionHeading: {
    ...Typography.h3,
  },
  sectionSubtitle: {
    ...Typography.caption,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.captionBold,
  },
  inputWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
  },
  input: {
    ...Typography.body,
    height: '100%',
  },
  dateSelectorRow: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.captionBold,
  },
  monthScroll: {
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  monthPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  monthPillText: {
    ...Typography.captionBold,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepValue: {
    ...Typography.h2,
    minWidth: 32,
    textAlign: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  toggleTitle: {
    ...Typography.bodyBold,
  },
  toggleSubtitle: {
    ...Typography.caption,
  },
  previewCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  previewTitle: {
    ...Typography.bodyBold,
  },
  previewBody: {
    ...Typography.caption,
  },
  previewSubtext: {
    ...Typography.small,
  },
  noPartnersText: {
    ...Typography.caption,
    lineHeight: 18,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  partnerRowName: {
    ...Typography.bodyBold,
  },
  partnerRowSub: {
    ...Typography.small,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  testButtonText: {
    ...Typography.captionBold,
  },
  saveButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
});

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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { OccasionsService, ConnectedPartner, OCCASION_COLORS } from '@/services/occasions';
import { NotificationService } from '@/services/notifications';
import { calculateNextOccurrence } from '@/utils/date-utils';
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

const QUICK_OCCASIONS = ['🎂 Birthday', '💍 Anniversary', '💝 Valentine\'s Day', '🎄 Christmas', '🎓 Graduation'];

export default function AddOccasionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ month?: string; day?: string; year?: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const now = new Date();
  const initialMonth =
    params.month !== undefined && !isNaN(Number(params.month))
      ? Number(params.month)
      : now.getMonth();
  const initialDay =
    params.day !== undefined && !isNaN(Number(params.day))
      ? Number(params.day)
      : now.getDate();

  const [name, setName] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(initialMonth); // 0-indexed
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [recursAnnually, setRecursAnnually] = useState(true);

  // Partner selection
  const [partners, setPartners] = useState<ConnectedPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(OCCASION_COLORS[0]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    OccasionsService.getConnectedPartners(user.id)
      .then(({ partners: connected }) => {
        setPartners(connected);
        if (connected.length > 0) {
          setSelectedPartnerId(connected[0].userId);
          setSelectedColor(connected[0].colorCode);
        }
      })
      .finally(() => setLoadingPartners(false));
  }, [user]);

  // When user selects a partner, default to their color
  const handleSelectPartner = (partner: ConnectedPartner) => {
    setSelectedPartnerId(partner.userId);
    setSelectedColor(partner.colorCode);
  };

  const handleSelectCustom = () => {
    setSelectedPartnerId(null);
  };

  // Calculate reminder preview
  const currentYear = now.getFullYear();
  const dateString = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(
    selectedDay
  ).padStart(2, '0')}`;
  const occurrenceInfo = calculateNextOccurrence(dateString, recursAnnually);

  const getRecipientDisplayName = () => {
    if (selectedPartnerId) {
      const partner = partners.find((p) => p.userId === selectedPartnerId);
      return partner?.displayName || 'Partner';
    }
    return customRecipientName.trim() || 'Someone special';
  };

  const handleSendTestNotification = async () => {
    if (!user) return;
    await NotificationService.registerForPushNotifications(user.id);
    const recipient = getRecipientDisplayName();
    const occasionTitle = name.trim() || 'Special Occasion';

    await OccasionsService.triggerTestReminder(recipient, occasionTitle);
    Alert.alert('Test Notification Sent!', 'Check your notifications bar or lock screen to preview the reminder banner.');
  };

  const handleSave = async () => {
    if (!user) return;

    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please give this occasion a name (e.g. Birthday).');
      return;
    }

    if (!selectedPartnerId && !customRecipientName.trim()) {
      Alert.alert('Missing Recipient', 'Please select a partner or enter who this occasion is for.');
      return;
    }

    setIsSaving(true);
    await NotificationService.registerForPushNotifications(user.id);

    const partner = partners.find((p) => p.userId === selectedPartnerId);
    const recipientName = partner ? partner.displayName : customRecipientName.trim();

    const { error } = await OccasionsService.createOccasion({
      owner_user_id: user.id,
      recipient_user_id: selectedPartnerId,
      recipient_name: recipientName,
      color_code: selectedColor,
      name: name.trim(),
      date: dateString,
      recurs_annually: recursAnnually,
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
        
        {/* Recipient Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Who is this occasion for? *</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Assign this occasion to a partner who shared their wishlist with you.
          </Text>

          {loadingPartners ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={{ gap: Spacing.sm }}>
              {partners.map((partner) => {
                const isSelected = selectedPartnerId === partner.userId;
                return (
                  <TouchableOpacity
                    key={partner.userId}
                    style={[
                      styles.partnerSelectRow,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                      isSelected && { borderColor: partner.colorCode, borderWidth: 2 },
                    ]}
                    onPress={() => handleSelectPartner(partner)}
                    activeOpacity={0.8}>
                    <View style={[styles.avatarCircle, { backgroundColor: partner.colorCode }]}>
                      <Text style={styles.avatarInitial}>
                        {partner.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partnerName, { color: colors.text }]}>{partner.displayName}</Text>
                      <Text style={[styles.partnerSub, { color: colors.textSecondary }]}>Connected Partner</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={isSelected ? partner.colorCode : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}

              {/* Other / Custom Option */}
              <TouchableOpacity
                style={[
                  styles.partnerSelectRow,
                  { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                  selectedPartnerId === null && { borderColor: colors.primary, borderWidth: 2 },
                ]}
                onPress={handleSelectCustom}
                activeOpacity={0.8}>
                <View style={[styles.avatarCircle, { backgroundColor: colors.textMuted }]}>
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partnerName, { color: colors.text }]}>Other Person / Custom</Text>
                  <Text style={[styles.partnerSub, { color: colors.textSecondary }]}>Add someone else (Mom, Friend, etc.)</Text>
                </View>
                <Ionicons
                  name={selectedPartnerId === null ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={selectedPartnerId === null ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>

              {selectedPartnerId === null && (
                <View
                  style={[
                    styles.inputWrapper,
                    { backgroundColor: colors.backgroundElement, borderColor: colors.border, marginTop: Spacing.xs },
                  ]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    placeholder="Enter name (e.g. Mom, Best Friend)"
                    placeholderTextColor={colors.textMuted}
                    value={customRecipientName}
                    onChangeText={setCustomRecipientName}
                  />
                </View>
              )}
            </View>
          )}
        </View>

        {/* Color Theme Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Event Color Tag</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            This color will highlight their dates on the calendar.
          </Text>

          <View style={styles.colorPaletteRow}>
            {OCCASION_COLORS.map((hex) => {
              const isSelected = selectedColor === hex;
              return (
                <TouchableOpacity
                  key={hex}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: hex },
                    isSelected && styles.colorCircleSelected,
                  ]}
                  onPress={() => setSelectedColor(hex)}
                  activeOpacity={0.8}>
                  {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
                      ? { backgroundColor: selectedColor, borderColor: selectedColor }
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
                        ? { backgroundColor: selectedColor, borderColor: selectedColor }
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
              trackColor={{ false: colors.border, true: selectedColor }}
            />
          </View>
        </View>

        {/* 1-Month Reminder Schedule Preview */}
        <View
          style={[
            styles.previewCard,
            { backgroundColor: `${selectedColor}15`, borderColor: selectedColor },
          ]}>
          <Ionicons name="notifications" size={24} color={selectedColor} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.previewTitle, { color: selectedColor }]}>
              Your 1-Month Shopping Reminder
            </Text>
            <Text style={[styles.previewBody, { color: colors.textSecondary }]}>
              You will be reminded to buy gifts for{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>{getRecipientDisplayName()}</Text> on{' '}
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

        {/* Instant Test Alert Button */}
        <TouchableOpacity
          style={[styles.testButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleSendTestNotification}
          activeOpacity={0.8}>
          <Ionicons name="paper-plane-outline" size={18} color={selectedColor} style={{ marginRight: 6 }} />
          <Text style={[styles.testButtonText, { color: selectedColor }]}>
            Send Immediate Test Alert (Preview on Phone)
          </Text>
        </TouchableOpacity>

        {/* Save CTA */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: selectedColor },
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
  partnerSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  partnerName: {
    ...Typography.bodyBold,
  },
  partnerSub: {
    ...Typography.small,
  },
  colorPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
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

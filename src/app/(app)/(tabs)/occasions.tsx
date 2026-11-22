import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { OccasionsService, OccasionWithReminders, PartnerOccasion } from '@/services/occasions';
import { calculateNextOccurrence, formatOccasionDate } from '@/utils/date-utils';
import { WidgetService } from '@/services/widget';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

type OccasionTab = 'my_dates' | 'partner_dates';

export default function OccasionsScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [activeTab, setActiveTab] = useState<OccasionTab>('my_dates');
  const [myOccasions, setMyOccasions] = useState<OccasionWithReminders[]>([]);
  const [partnerOccasions, setPartnerOccasions] = useState<PartnerOccasion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [myRes, partnerRes] = await Promise.all([
        OccasionsService.getMyOccasions(user.id),
        OccasionsService.getPartnerOccasions(user.id),
      ]);

      setMyOccasions(myRes.occasions);
      setPartnerOccasions(partnerRes.occasions);

      // Sync closest upcoming occasion to widget
      const allOccasions = [...myRes.occasions, ...partnerRes.occasions];
      if (allOccasions.length > 0) {
        const sorted = allOccasions
          .map((occ) => ({
            ...occ,
            info: calculateNextOccurrence(occ.date, occ.recurs_annually),
          }))
          .sort((a, b) => a.info.daysUntilOccasion - b.info.daysUntilOccasion);

        const nearest = sorted[0];
        WidgetService.updateWidgetSnapshot({
          isLoggedIn: true,
          nextOccasion: {
            name: nearest.name,
            date: formatOccasionDate(nearest.date),
            daysRemaining: nearest.info.daysUntilOccasion,
            deepLink: 'wishlist://occasions',
          },
        });
      }
    } catch (e) {
      console.warn('Error loading occasions:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleDeleteOccasion = (occasion: OccasionWithReminders) => {
    Alert.alert(
      'Delete Occasion',
      `Are you sure you want to delete "${occasion.name}"? Scheduled reminders for this occasion will be cancelled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await OccasionsService.deleteOccasion(occasion.id);
            loadData();
          },
        },
      ]
    );
  };

  const handleTestAlert = async (occasionName: string) => {
    const ownerName = profile?.display_name || 'Your partner';
    await OccasionsService.triggerTestReminder(ownerName, occasionName);
    Alert.alert('Test Notification Sent!', 'Check your notifications bar or lock screen to preview.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}>
        <View>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Occasions</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Key gift-giving dates & automatic reminders
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(app)/add-occasion')}
          activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addButtonText}>Add Date</Text>
        </TouchableOpacity>
      </View>

      {/* Segmented Switcher */}
      <View
        style={[
          styles.switcherContainer,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}>
        <TouchableOpacity
          style={[
            styles.switchTab,
            activeTab === 'my_dates' && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('my_dates')}>
          <Text
            style={[
              styles.switchTabText,
              { color: activeTab === 'my_dates' ? colors.primary : colors.textSecondary },
            ]}>
            My Dates ({myOccasions.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.switchTab,
            activeTab === 'partner_dates' && {
              borderBottomColor: colors.primary,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab('partner_dates')}>
          <Text
            style={[
              styles.switchTabText,
              { color: activeTab === 'partner_dates' ? colors.primary : colors.textSecondary },
            ]}>
            Partner Dates ({partnerOccasions.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading occasions...
            </Text>
          </View>
        ) : activeTab === 'my_dates' ? (
          /* ==================== MY OCCASIONS ==================== */
          myOccasions.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="calendar-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Occasions Added</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Add your birthday, anniversary, or holidays. We'll automatically remind your
                connected partner 1 month before so they have time to browse your wishlist and order!
              </Text>

              <TouchableOpacity
                style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(app)/add-occasion')}
                activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyActionButtonText}>Add Your First Occasion</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myOccasions.map((occasion) => {
              const info = calculateNextOccurrence(occasion.date, occasion.recurs_annually);
              const formattedDate = formatOccasionDate(occasion.date);

              return (
                <View
                  key={occasion.id}
                  style={[
                    styles.occasionCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    Shadows?.subtle,
                  ]}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.occasionName, { color: colors.text }]}>
                        {occasion.name}
                      </Text>
                      <Text style={[styles.occasionDateText, { color: colors.textSecondary }]}>
                        📅 {formattedDate}{' '}
                        {occasion.recurs_annually ? '(Annual)' : `(${info.occurrenceYear})`}
                      </Text>
                    </View>

                    {/* Countdown Pill */}
                    <View style={[styles.countdownPill, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.countdownPillText, { color: colors.primary }]}>
                        {info.daysUntilOccasion === 0
                          ? 'Today! 🎉'
                          : info.daysUntilOccasion === 1
                          ? 'Tomorrow'
                          : `in ${info.daysUntilOccasion} days`}
                      </Text>
                    </View>
                  </View>

                  {/* Reminder Info */}
                  <View
                    style={[
                      styles.reminderBox,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    ]}>
                    <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderHeading, { color: colors.text }]}>
                        1-Month Reminder:
                      </Text>
                      <Text style={[styles.reminderDetail, { color: colors.textSecondary }]}>
                        {info.nextReminderDate.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at 9:00 AM
                        {occasion.reminders.length > 0
                          ? ` (Sent to ${occasion.reminders
                              .map((r) => r.viewer_profile?.display_name || 'Partner')
                              .join(', ')})`
                          : ' (No partner selected)'}
                      </Text>
                    </View>
                  </View>

                  {/* Action Row */}
                  <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.testAlertBtn}
                      onPress={() => handleTestAlert(occasion.name)}>
                      <Ionicons name="paper-plane-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                      <Text style={[styles.testAlertText, { color: colors.primary }]}>
                        Send Test Alert
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteOccasion(occasion)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        ) : (
          /* ==================== PARTNER DATES ==================== */
          partnerOccasions.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="heart-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Partner Dates Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                When connected partners add their birthdays or anniversaries, they will appear here
                along with your reminder schedule.
              </Text>
            </View>
          ) : (
            partnerOccasions.map((occasion) => {
              const info = calculateNextOccurrence(occasion.date, occasion.recurs_annually);
              const partnerName = occasion.owner_profile?.display_name || 'Partner';
              const formattedDate = formatOccasionDate(occasion.date);

              return (
                <View
                  key={occasion.id}
                  style={[
                    styles.occasionCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    Shadows?.subtle,
                  ]}>
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.occasionName, { color: colors.text }]}>
                        {partnerName}'s {occasion.name}
                      </Text>
                      <Text style={[styles.occasionDateText, { color: colors.textSecondary }]}>
                        📅 {formattedDate}
                      </Text>
                    </View>

                    <View style={[styles.countdownPill, { backgroundColor: colors.accentLight }]}>
                      <Text style={[styles.countdownPillText, { color: colors.accent }]}>
                        {info.daysUntilOccasion === 0
                          ? 'Today! 🎉'
                          : `in ${info.daysUntilOccasion} days`}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.reminderBox,
                      { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                    ]}>
                    <Ionicons name="notifications-outline" size={16} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reminderHeading, { color: colors.text }]}>
                        Your reminder is scheduled:
                      </Text>
                      <Text style={[styles.reminderDetail, { color: colors.textSecondary }]}>
                        You will receive an alert on{' '}
                        {info.nextReminderDate.toLocaleDateString(undefined, {
                          month: 'long',
                          day: 'numeric',
                        })}{' '}
                        at 9:00 AM (1 month before).
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  screenTitle: {
    ...Typography.h2,
  },
  screenSubtitle: {
    ...Typography.caption,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
  switcherContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  switchTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  switchTabText: {
    ...Typography.captionBold,
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  occasionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  occasionName: {
    ...Typography.h3,
  },
  occasionDateText: {
    ...Typography.body,
  },
  countdownPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  countdownPillText: {
    ...Typography.small,
    fontWeight: '700',
  },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reminderHeading: {
    ...Typography.small,
    fontWeight: '700',
  },
  reminderDetail: {
    ...Typography.caption,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  testAlertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  testAlertText: {
    ...Typography.small,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.sm,
  },
  emptyCard: {
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 320,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyActionButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
});

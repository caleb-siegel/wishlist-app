import React, { useState, useCallback, useMemo } from 'react';
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
import { OccasionsService, ConnectedPartner } from '@/services/occasions';
import { Occasion } from '@/types/database.types';
import {
  calculateNextOccurrence,
  formatOccasionDate,
  doesOccasionMatchDate,
  getDaysInMonth,
  getFirstDayOfWeek,
} from '@/utils/date-utils';
import { WidgetService } from '@/services/widget';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

type ViewMode = 'calendar' | 'list';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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

export default function OccasionsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [partners, setPartners] = useState<ConnectedPartner[]>([]);
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string | null>(null); // null = All
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar State
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(today);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [occRes, partnerRes] = await Promise.all([
        OccasionsService.getMyOccasions(user.id),
        OccasionsService.getConnectedPartners(user.id),
      ]);

      setOccasions(occRes.occasions);
      setPartners(partnerRes.partners);

      // Sync closest upcoming occasion to WidgetKit
      if (occRes.occasions.length > 0) {
        const sorted = occRes.occasions
          .map((occ) => ({
            ...occ,
            info: calculateNextOccurrence(occ.date, occ.recurs_annually),
          }))
          .sort((a, b) => a.info.daysUntilOccasion - b.info.daysUntilOccasion);

        const nearest = sorted[0];
        const recipientName =
          nearest.recipient_profile?.display_name || nearest.recipient_name || 'Someone';

        WidgetService.updateWidgetSnapshot({
          isLoggedIn: true,
          nextOccasion: {
            name: `${recipientName}'s ${nearest.name}`,
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

  // Filter occasions by selected partner
  const filteredOccasions = useMemo(() => {
    if (!selectedPartnerFilter) return occasions;
    return occasions.filter(
      (occ) =>
        occ.recipient_user_id === selectedPartnerFilter ||
        occ.recipient_name?.toLowerCase() === selectedPartnerFilter.toLowerCase()
    );
  }, [occasions, selectedPartnerFilter]);

  // Calendar math
  const daysInMonth = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const firstDayOfWeek = useMemo(() => getFirstDayOfWeek(currentYear, currentMonth), [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedCalendarDate(today);
  };

  const handleOpenAddOccasion = (targetDate?: Date) => {
    const dateToUse = targetDate || (viewMode === 'calendar' ? selectedCalendarDate : new Date());
    router.push({
      pathname: '/(app)/add-occasion',
      params: {
        month: dateToUse.getMonth().toString(),
        day: dateToUse.getDate().toString(),
        year: dateToUse.getFullYear().toString(),
      },
    });
  };

  const handleDeleteOccasion = (occasion: Occasion) => {
    const recipient = occasion.recipient_profile?.display_name || occasion.recipient_name || 'Partner';
    Alert.alert(
      'Delete Occasion',
      `Are you sure you want to delete ${recipient}'s "${occasion.name}"? Scheduled reminders will be cancelled.`,
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

  // Occasions matching the currently selected day on the calendar
  const selectedDayOccasions = useMemo(() => {
    return filteredOccasions.filter((occ) =>
      doesOccasionMatchDate(occ.date, occ.recurs_annually, selectedCalendarDate)
    );
  }, [filteredOccasions, selectedCalendarDate]);

  // Occasions occurring anytime during the viewed month
  const monthOccasions = useMemo(() => {
    return filteredOccasions.filter((occ) => {
      const parts = occ.date.split('-').map(Number);
      const occMonth = parts[1] - 1;
      const occYear = parts[0];
      if (occ.recurs_annually) {
        return occMonth === currentMonth;
      }
      return occYear === currentYear && occMonth === currentMonth;
    });
  }, [filteredOccasions, currentMonth, currentYear]);

  // Helper to render an occasion card
  const renderOccasionCard = (occasion: Occasion) => {
    const info = calculateNextOccurrence(occasion.date, occasion.recurs_annually);
    const formattedDate = formatOccasionDate(occasion.date);
    const recipient =
      occasion.recipient_profile?.display_name || occasion.recipient_name || 'Partner';
    const color = occasion.color_code || colors.primary;

    return (
      <View
        key={occasion.id}
        style={[
          styles.occasionCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <View style={styles.cardHeaderRow}>
          {/* Person Avatar with color code */}
          <View style={[styles.personAvatar, { backgroundColor: color }]}>
            <Text style={styles.personAvatarInitial}>{recipient.charAt(0).toUpperCase()}</Text>
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.recipientBadgeName, { color }]}>{recipient}</Text>
              <View style={[styles.colorDot, { backgroundColor: color }]} />
            </View>
            <Text style={[styles.occasionName, { color: colors.text }]}>{occasion.name}</Text>
            <Text style={[styles.occasionDateSubtext, { color: colors.textSecondary }]}>
              📅 {formattedDate} {occasion.recurs_annually ? '(Annual)' : `(${info.occurrenceYear})`}
            </Text>
          </View>

          {/* Countdown Pill */}
          <View style={[styles.countdownPill, { backgroundColor: `${color}18` }]}>
            <Text style={[styles.countdownPillText, { color }]}>
              {info.daysUntilOccasion === 0
                ? 'Today! 🎉'
                : info.daysUntilOccasion === 1
                ? 'Tomorrow'
                : `in ${info.daysUntilOccasion}d`}
            </Text>
          </View>
        </View>

        {/* Reminder schedule */}
        <View
          style={[
            styles.reminderBanner,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}>
          <Ionicons name="notifications-outline" size={15} color={color} />
          <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
            Reminder scheduled for{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              {info.nextReminderDate.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Text>{' '}
            at 9:00 AM (1 month before)
          </Text>
        </View>

        {/* Action Row */}
        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          {occasion.recipient_user_id ? (
            <TouchableOpacity
              style={[styles.viewWishlistBtn, { backgroundColor: `${color}15` }]}
              onPress={() => router.push('/(app)/(tabs)/shared')}
              activeOpacity={0.8}>
              <Ionicons name="gift-outline" size={14} color={color} style={{ marginRight: 4 }} />
              <Text style={[styles.viewWishlistBtnText, { color }]}>View {recipient}'s Wishlist</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDeleteOccasion(occasion)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
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
          <Text style={[styles.screenTitle, { color: colors.text }]}>Occasions Calendar</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            Color-coded gift dates for your partners
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => handleOpenAddOccasion()}
          activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addButtonText}>Add Date</Text>
        </TouchableOpacity>
      </View>

      {/* View Switcher (Calendar vs List) */}
      <View
        style={[
          styles.viewSwitcherBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}>
        <View style={[styles.segmentedWrapper, { backgroundColor: colors.backgroundElement }]}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              viewMode === 'calendar' && { backgroundColor: colors.card, ...Shadows?.subtle },
            ]}
            onPress={() => setViewMode('calendar')}>
            <Ionicons
              name="calendar"
              size={16}
              color={viewMode === 'calendar' ? colors.primary : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentText,
                { color: viewMode === 'calendar' ? colors.text : colors.textSecondary },
              ]}>
              Calendar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              viewMode === 'list' && { backgroundColor: colors.card, ...Shadows?.subtle },
            ]}
            onPress={() => setViewMode('list')}>
            <Ionicons
              name="list"
              size={16}
              color={viewMode === 'list' ? colors.primary : colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentText,
                { color: viewMode === 'list' ? colors.text : colors.textSecondary },
              ]}>
              List View ({filteredOccasions.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Partner Filter Pills */}
      {(partners.length > 0 || occasions.length > 0) && (
        <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedPartnerFilter === null
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setSelectedPartnerFilter(null)}>
              <Text
                style={[
                  styles.filterPillText,
                  { color: selectedPartnerFilter === null ? '#FFFFFF' : colors.text },
                ]}>
                All People ({occasions.length})
              </Text>
            </TouchableOpacity>

            {partners.map((p) => {
              const isSelected = selectedPartnerFilter === p.userId;
              const count = occasions.filter((o) => o.recipient_user_id === p.userId).length;
              return (
                <TouchableOpacity
                  key={p.userId}
                  style={[
                    styles.filterPill,
                    isSelected
                      ? { backgroundColor: p.colorCode, borderColor: p.colorCode }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                  onPress={() => setSelectedPartnerFilter(isSelected ? null : p.userId)}>
                  <View style={[styles.pillColorDot, { backgroundColor: isSelected ? '#FFFFFF' : p.colorCode }]} />
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}>
                    {p.displayName} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading calendar...
            </Text>
          </View>
        ) : filteredOccasions.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Occasions Set</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add birthdays, anniversaries, and holidays for the people you buy gifts for.
              They will appear color-coded on your calendar with automatic 1-month-prior reminders!
            </Text>

            <TouchableOpacity
              style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(app)/add-occasion')}
              activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionButtonText}>Add An Occasion</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === 'calendar' ? (
          /* ==================== INTERACTIVE MONTH GRID ==================== */
          <View style={{ gap: Spacing.xl }}>
            {/* Calendar Container */}
            <View
              style={[
                styles.calendarCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                Shadows?.subtle,
              ]}>
              {/* Month Navigation */}
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={[styles.navArrowBtn, { backgroundColor: colors.backgroundElement }]}
                  onPress={handlePrevMonth}>
                  <Ionicons name="chevron-back" size={18} color={colors.text} />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.monthHeading, { color: colors.text }]}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.todayBtn, { backgroundColor: colors.backgroundElement }]}
                    onPress={handleJumpToToday}>
                    <Text style={[styles.todayBtnText, { color: colors.primary }]}>Today</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.navArrowBtn, { backgroundColor: colors.backgroundElement }]}
                    onPress={handleNextMonth}>
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekday Labels */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((day, idx) => (
                  <Text key={idx} style={[styles.weekdayLabel, { color: colors.textSecondary }]}>
                    {day}
                  </Text>
                ))}
              </View>

              {/* Day Grid */}
              <View style={styles.gridContainer}>
                {/* Empty offset days */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <View key={`empty-${idx}`} style={styles.dayCell} />
                ))}

                {/* Actual month days */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const cellDate = new Date(currentYear, currentMonth, dayNum);

                  const isToday =
                    cellDate.getFullYear() === today.getFullYear() &&
                    cellDate.getMonth() === today.getMonth() &&
                    cellDate.getDate() === today.getDate();

                  const isSelected =
                    cellDate.getFullYear() === selectedCalendarDate.getFullYear() &&
                    cellDate.getMonth() === selectedCalendarDate.getMonth() &&
                    cellDate.getDate() === selectedCalendarDate.getDate();

                  // Find occasions for this day
                  const dayOccasions = filteredOccasions.filter((occ) =>
                    doesOccasionMatchDate(occ.date, occ.recurs_annually, cellDate)
                  );

                  return (
                    <TouchableOpacity
                      key={`day-${dayNum}`}
                      style={[
                        styles.dayCell,
                        isToday && { backgroundColor: `${colors.primary}12`, borderRadius: BorderRadius.sm },
                        isSelected && {
                          borderColor: colors.primary,
                          borderWidth: 2,
                          borderRadius: BorderRadius.sm,
                        },
                      ]}
                      onPress={() => setSelectedCalendarDate(cellDate)}
                      activeOpacity={0.7}>
                      <Text
                        style={[
                          styles.dayNumText,
                          { color: isToday ? colors.primary : colors.text },
                          isSelected && { fontWeight: 'bold' },
                        ]}>
                        {dayNum}
                      </Text>

                      {/* Color-coded occasion dots */}
                      <View style={styles.dotContainer}>
                        {dayOccasions.slice(0, 3).map((occ, dotIdx) => (
                          <View
                            key={dotIdx}
                            style={[
                              styles.calendarDot,
                              { backgroundColor: occ.color_code || colors.primary },
                            ]}
                          />
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Selected Date Details Panel */}
            <View style={{ gap: Spacing.sm }}>
              <View style={styles.selectedDateHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {selectedCalendarDate.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>

                <TouchableOpacity
                  style={[styles.smallAddBtn, { backgroundColor: colors.backgroundElement }]}
                  onPress={() => handleOpenAddOccasion(selectedCalendarDate)}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={[styles.smallAddBtnText, { color: colors.primary }]}>Add</Text>
                </TouchableOpacity>
              </View>

              {selectedDayOccasions.length === 0 ? (
                <View
                  style={[
                    styles.noDayOccasionsBox,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}>
                  <Text style={[styles.noDayOccasionsText, { color: colors.textSecondary }]}>
                    No occasions on this day.
                  </Text>
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: colors.backgroundElement, marginTop: Spacing.sm }]}
                    onPress={() => handleOpenAddOccasion(selectedCalendarDate)}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={[styles.smallAddBtnText, { color: colors.primary }]}>
                      Add date for {MONTH_NAMES[selectedCalendarDate.getMonth()]} {selectedCalendarDate.getDate()}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                selectedDayOccasions.map(renderOccasionCard)
              )}
            </View>

            {/* All Occasions in this month */}
            {monthOccasions.length > 0 && selectedDayOccasions.length === 0 && (
              <View style={{ gap: Spacing.sm }}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  All Dates in {MONTH_NAMES[currentMonth]}
                </Text>
                {monthOccasions.map(renderOccasionCard)}
              </View>
            )}
          </View>
        ) : (
          /* ==================== LIST VIEW (UPCOMING DATES) ==================== */
          <View style={{ gap: Spacing.md }}>
            {filteredOccasions
              .slice()
              .sort((a, b) => {
                const aInfo = calculateNextOccurrence(a.date, a.recurs_annually);
                const bInfo = calculateNextOccurrence(b.date, b.recurs_annually);
                return aInfo.daysUntilOccasion - bInfo.daysUntilOccasion;
              })
              .map(renderOccasionCard)}
          </View>
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
  viewSwitcherBar: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  segmentedWrapper: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  segmentText: {
    ...Typography.captionBold,
  },
  filterBar: {
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  filterPillText: {
    ...Typography.captionBold,
  },
  pillColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  calendarCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthHeading: {
    ...Typography.h3,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  todayBtnText: {
    ...Typography.small,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  weekdayLabel: {
    ...Typography.small,
    fontWeight: '700',
    width: 38,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayNumText: {
    ...Typography.body,
    fontSize: 14,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: 'center',
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  selectedDateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  smallAddBtnText: {
    ...Typography.small,
    fontWeight: '600',
  },
  noDayOccasionsBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  noDayOccasionsText: {
    ...Typography.caption,
    textAlign: 'center',
  },
  occasionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personAvatarInitial: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  recipientBadgeName: {
    ...Typography.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  colorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  occasionName: {
    ...Typography.h3,
  },
  occasionDateSubtext: {
    ...Typography.caption,
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
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  reminderText: {
    ...Typography.caption,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  viewWishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  viewWishlistBtnText: {
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

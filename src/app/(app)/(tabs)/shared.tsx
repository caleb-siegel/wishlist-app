import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { SharingService, SharedWishlistData } from '@/services/sharing';
import { PurchasesService } from '@/services/purchases';
import { SharingInvitation, PrivatePurchase, WishlistItem } from '@/types/database.types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

type ViewMode = 'wishlists' | 'purchases';
type SortOrder = 'newest' | 'price_asc' | 'price_desc';

export default function SharedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [viewMode, setViewMode] = useState<ViewMode>('wishlists');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Incoming invitations sent to this user
  const [incomingInvites, setIncomingInvites] = useState<SharingInvitation[]>([]);

  // Shared lists with items
  const [sharedLists, setSharedLists] = useState<SharedWishlistData[]>([]);

  // Shopper's private purchases
  const [purchases, setPurchases] = useState<PrivatePurchase[]>([]);

  // Filter & Sort
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [preferenceFilter, setPreferenceFilter] = useState<'all' | 'would_love' | 'just_an_idea'>('all');

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [invitesRes, sharedRes, purchasesRes] = await Promise.all([
        user.email ? SharingService.getIncomingInvitations(user.email) : Promise.resolve({ invitations: [] }),
        SharingService.getSharedWithMe(user.id),
        PurchasesService.getMyPurchases(user.id),
      ]);

      setIncomingInvites(invitesRes.invitations);
      setSharedLists(sharedRes.lists);
      setPurchases(purchasesRes.purchases);
    } catch (e) {
      console.warn('Error loading shared data:', e);
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

  const handleAcceptInvite = async (invitation: SharingInvitation) => {
    if (!user) return;
    setLoading(true);
    const { error } = await SharingService.acceptInvitation(invitation, user.id);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Connected!', 'You can now view this partner\'s wishlist!');
      loadData();
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    await SharingService.declineInvitation(invitationId);
    loadData();
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot Open Link', 'The URL is not supported by your browser.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open link.');
    }
  };

  // Helper to check if an item has already been purchased by this shopper
  const getPurchaseForItem = (itemId: string): PrivatePurchase | undefined => {
    return purchases.find((p) => p.source_item_id === itemId);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Shared With Me</Text>
        <TouchableOpacity
          style={[styles.manageButton, { backgroundColor: colors.primaryLight }]}
          onPress={() => router.push('/(app)/invite-modal')}
          activeOpacity={0.8}>
          <Ionicons name="people" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.manageButtonText, { color: colors.primary }]}>Share List</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={[styles.switcherContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.switchTab,
            viewMode === 'wishlists' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setViewMode('wishlists')}>
          <Text
            style={[
              styles.switchTabText,
              { color: viewMode === 'wishlists' ? colors.primary : colors.textSecondary },
            ]}>
            Partner Wishlists ({sharedLists.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.switchTab,
            viewMode === 'purchases' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
          ]}
          onPress={() => setViewMode('purchases')}>
          <Text
            style={[
              styles.switchTabText,
              { color: viewMode === 'purchases' ? colors.primary : colors.textSecondary },
            ]}>
            My Purchase History ({purchases.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }>
        {/* Incoming Invitations Banner */}
        {incomingInvites.length > 0 && (
          <View style={styles.invitesSection}>
            {incomingInvites.map((inv) => (
              <View
                key={inv.id}
                style={[
                  styles.inviteBanner,
                  { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                  Shadows?.subtle,
                ]}>
                <Ionicons name="mail-unread" size={24} color={colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.inviteTitle, { color: colors.text }]}>
                    New Wishlist Invitation!
                  </Text>
                  <Text style={[styles.inviteSubtitle, { color: colors.textSecondary }]}>
                    A partner invited your email to view their gift wishlist.
                  </Text>
                  <View style={styles.inviteActionRow}>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleAcceptInvite(inv)}>
                      <Text style={styles.acceptBtnText}>Accept Access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.declineBtn, { borderColor: colors.border }]}
                      onPress={() => handleDeclineInvite(inv.id)}>
                      <Text style={[styles.declineBtnText, { color: colors.textSecondary }]}>
                        Decline
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
          </View>
        ) : viewMode === 'purchases' ? (
          /* ==================== VIEW MODE: MY PURCHASE HISTORY ==================== */
          purchases.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="bag-check-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Purchases Logged</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                When you browse partner wishlists, tap "Mark as Purchased" to secretly track what
                you've ordered. Only you can see this list!
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.md }}>
              <View style={[styles.privacyNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text style={[styles.privacyNoteText, { color: colors.textSecondary }]}>
                  This purchase history is private to you. The gift recipients cannot see this list.
                </Text>
              </View>

              {purchases.map((purchase) => (
                <View
                  key={purchase.id}
                  style={[
                    styles.purchaseCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    Shadows?.subtle,
                  ]}>
                  <View style={styles.purchaseHeader}>
                    {purchase.item_image_url ? (
                      <Image
                        source={{ uri: purchase.item_image_url }}
                        style={styles.itemImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.placeholderImage, { backgroundColor: colors.backgroundElement }]}>
                        <Ionicons name="gift-outline" size={24} color={colors.textMuted} />
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                        {purchase.item_title}
                      </Text>
                      {purchase.item_price !== null && (
                        <Text style={[styles.priceTag, { color: colors.text }]}>
                          ${purchase.item_price.toFixed(2)}
                        </Text>
                      )}
                      <Text style={[styles.purchaseDate, { color: colors.textSecondary }]}>
                        Purchased on {new Date(purchase.purchased_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>

                  {purchase.notes && (
                    <View style={[styles.privateNoteBox, { backgroundColor: colors.backgroundElement }]}>
                      <Text style={[styles.privateNoteText, { color: colors.text }]}>
                        🔒 <Text style={{ fontWeight: '600' }}>Your secret note:</Text> {purchase.notes}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={[styles.openLinkButton, { backgroundColor: colors.backgroundElement }]}
                      onPress={() => handleOpenLink(purchase.item_url)}>
                      <Ionicons name="open-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.openLinkText, { color: colors.primary }]}>Store Link</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.editNotesButton}
                      onPress={() =>
                        router.push({
                          pathname: '/(app)/purchase-modal',
                          params: {
                            itemId: purchase.source_item_id || '',
                            itemTitle: purchase.item_title,
                            itemUrl: purchase.item_url,
                            itemImage: purchase.item_image_url || '',
                            itemPrice: purchase.item_price ? purchase.item_price.toString() : '',
                            purchaseId: purchase.id,
                            existingNotes: purchase.notes || '',
                          },
                        })
                      }>
                      <Text style={[styles.editNotesText, { color: colors.primary }]}>Edit / Unmark</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          /* ==================== VIEW MODE: SHARED WISHLISTS ==================== */
          sharedLists.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.backgroundElement }]}>
                <Ionicons name="heart-outline" size={40} color={colors.accent} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Shared Wishlists Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                When a partner or friend enters your email under "Share List", their wishlist will
                appear right here!
              </Text>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(app)/invite-modal')}
                activeOpacity={0.8}>
                <Ionicons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>Invite Someone to Share</Text>
              </TouchableOpacity>
            </View>
          ) : (
            sharedLists.map((listData) => {
              const partnerName =
                listData.ownerProfile?.display_name || 'Partner';

              // Filter & Sort items
              let items = [...listData.items];
              if (preferenceFilter === 'would_love') {
                items = items.filter((i) => i.preference_level === 'would_love');
              } else if (preferenceFilter === 'just_an_idea') {
                items = items.filter((i) => i.preference_level === 'just_an_idea');
              }

              if (sortOrder === 'price_asc') {
                items.sort((a, b) => (a.approx_price ?? 999999) - (b.approx_price ?? 999999));
              } else if (sortOrder === 'price_desc') {
                items.sort((a, b) => (b.approx_price ?? -1) - (a.approx_price ?? -1));
              }

              return (
                <View key={listData.shareId} style={styles.partnerListBlock}>
                  {/* Partner Header */}
                  <View style={styles.partnerHeader}>
                    <View style={[styles.partnerAvatar, { backgroundColor: colors.accentLight }]}>
                      <Text style={[styles.partnerAvatarText, { color: colors.accent }]}>
                        {partnerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.partnerNameHeading, { color: colors.text }]}>
                        {partnerName}'s Wishlist
                      </Text>
                      <Text style={[styles.partnerItemCount, { color: colors.textSecondary }]}>
                        {listData.items.length} gift ideas
                      </Text>
                    </View>
                  </View>

                  {/* Filter & Sort Bar */}
                  <View style={styles.filterSortRow}>
                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        preferenceFilter === 'all'
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => setPreferenceFilter('all')}>
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: preferenceFilter === 'all' ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                        All
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        preferenceFilter === 'would_love'
                          ? { backgroundColor: colors.accent, borderColor: colors.accent }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => setPreferenceFilter('would_love')}>
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: preferenceFilter === 'would_love' ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                        ❤️ Would love
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.filterPill,
                        preferenceFilter === 'just_an_idea'
                          ? { backgroundColor: colors.warning, borderColor: colors.warning }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}
                      onPress={() => setPreferenceFilter('just_an_idea')}>
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: preferenceFilter === 'just_an_idea' ? '#FFFFFF' : colors.textSecondary },
                        ]}>
                        💡 Ideas
                      </Text>
                    </TouchableOpacity>

                    {/* Sort Cycle Button */}
                    <TouchableOpacity
                      style={[styles.sortBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => {
                        if (sortOrder === 'newest') setSortOrder('price_asc');
                        else if (sortOrder === 'price_asc') setSortOrder('price_desc');
                        else setSortOrder('newest');
                      }}>
                      <Ionicons name="swap-vertical" size={14} color={colors.textSecondary} />
                      <Text style={[styles.sortBtnText, { color: colors.textSecondary }]}>
                        {sortOrder === 'newest'
                          ? 'Newest'
                          : sortOrder === 'price_asc'
                          ? '$ Low→High'
                          : '$ High→Low'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Items */}
                  {items.length === 0 ? (
                    <Text style={[styles.noItemsMatch, { color: colors.textSecondary }]}>
                      No items match this filter.
                    </Text>
                  ) : (
                    items.map((item) => {
                      const existingPurchase = getPurchaseForItem(item.id);

                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.itemCard,
                            { backgroundColor: colors.card, borderColor: colors.cardBorder },
                            existingPurchase && { borderColor: colors.success },
                            Shadows?.subtle,
                          ]}>
                          <View style={styles.cardHeader}>
                            {item.image_url ? (
                              <Image
                                source={{ uri: item.image_url }}
                                style={styles.itemImage}
                                contentFit="cover"
                              />
                            ) : (
                              <View
                                style={[
                                  styles.placeholderImage,
                                  { backgroundColor: colors.backgroundElement },
                                ]}>
                                <Ionicons name="gift-outline" size={28} color={colors.textMuted} />
                              </View>
                            )}

                            <View style={styles.itemDetails}>
                              <View style={styles.tagRow}>
                                <View
                                  style={[
                                    styles.badge,
                                    item.preference_level === 'would_love'
                                      ? { backgroundColor: colors.accentLight }
                                      : { backgroundColor: colors.warningLight },
                                  ]}>
                                  <Text
                                    style={[
                                      styles.badgeText,
                                      {
                                        color:
                                          item.preference_level === 'would_love'
                                            ? colors.accent
                                            : colors.warning,
                                      },
                                    ]}>
                                    {item.preference_level === 'would_love'
                                      ? '❤️ Would love'
                                      : '💡 Just an idea'}
                                  </Text>
                                </View>

                                {item.approx_price !== null && (
                                  <Text style={[styles.priceTag, { color: colors.text }]}>
                                    ${item.approx_price.toFixed(2)}
                                  </Text>
                                )}
                              </View>

                              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                                {item.title}
                              </Text>

                              {item.notes ? (
                                <Text style={[styles.itemNotes, { color: colors.textSecondary }]} numberOfLines={2}>
                                  📝 {item.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          {/* Purchase Status Banner if purchased */}
                          {existingPurchase && (
                            <View style={[styles.purchasedStatusBanner, { backgroundColor: colors.successLight }]}>
                              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                              <Text style={[styles.purchasedStatusText, { color: colors.success }]}>
                                Purchased by you (Hidden from recipient)
                              </Text>
                            </View>
                          )}

                          {/* Actions */}
                          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                              style={[styles.openLinkButton, { backgroundColor: colors.backgroundElement }]}
                              onPress={() => handleOpenLink(item.url)}>
                              <Ionicons name="open-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                              <Text style={[styles.openLinkText, { color: colors.primary }]}>Store Link</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.purchaseActionButton,
                                existingPurchase
                                  ? { backgroundColor: colors.successLight, borderColor: colors.success }
                                  : { backgroundColor: colors.card, borderColor: colors.border },
                              ]}
                              onPress={() =>
                                router.push({
                                  pathname: '/(app)/purchase-modal',
                                  params: {
                                    itemId: item.id,
                                    itemTitle: item.title,
                                    itemUrl: item.url,
                                    itemImage: item.image_url || '',
                                    itemPrice: item.approx_price ? item.approx_price.toString() : '',
                                    purchaseId: existingPurchase?.id || '',
                                    existingNotes: existingPurchase?.notes || '',
                                  },
                                })
                              }
                              activeOpacity={0.8}>
                              <Ionicons
                                name={existingPurchase ? 'checkmark-circle' : 'bag-add-outline'}
                                size={16}
                                color={existingPurchase ? colors.success : colors.text}
                                style={{ marginRight: 6 }}
                              />
                              <Text
                                style={[
                                  styles.purchaseActionText,
                                  { color: existingPurchase ? colors.success : colors.text },
                                ]}>
                                {existingPurchase ? 'Secret Notes' : 'Mark Purchased'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
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
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  manageButtonText: {
    ...Typography.captionBold,
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
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  invitesSection: {
    gap: Spacing.sm,
  },
  inviteBanner: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  inviteTitle: {
    ...Typography.bodyBold,
  },
  inviteSubtitle: {
    ...Typography.caption,
  },
  inviteActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  acceptBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  acceptBtnText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
  declineBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  declineBtnText: {
    ...Typography.captionBold,
  },
  partnerListBlock: {
    gap: Spacing.md,
  },
  partnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  partnerAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerAvatarText: {
    ...Typography.h3,
  },
  partnerNameHeading: {
    ...Typography.h2,
  },
  partnerItemCount: {
    ...Typography.caption,
  },
  filterSortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterPillText: {
    ...Typography.captionBold,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginLeft: 'auto',
  },
  sortBtnText: {
    ...Typography.small,
    fontWeight: '600',
  },
  noItemsMatch: {
    ...Typography.body,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  itemCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  purchaseCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: Spacing.sm,
  },
  purchaseHeader: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000000',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    gap: 4,
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    fontWeight: '700',
  },
  priceTag: {
    ...Typography.bodyBold,
  },
  itemTitle: {
    ...Typography.bodyBold,
    marginTop: 2,
  },
  itemNotes: {
    ...Typography.caption,
    marginTop: 2,
  },
  purchaseDate: {
    ...Typography.small,
  },
  privateNoteBox: {
    marginHorizontal: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  privateNoteText: {
    ...Typography.caption,
  },
  purchasedStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  purchasedStatusText: {
    ...Typography.small,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  openLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  openLinkText: {
    ...Typography.captionBold,
  },
  purchaseActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  purchaseActionText: {
    ...Typography.captionBold,
  },
  editNotesButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  editNotesText: {
    ...Typography.captionBold,
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
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  privacyNoteText: {
    ...Typography.caption,
    flex: 1,
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
});

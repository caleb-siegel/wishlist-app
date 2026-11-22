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
import { WishlistService } from '@/services/wishlist';
import { WishlistItem, Wishlist } from '@/types/database.types';
import { WidgetService } from '@/services/widget';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

type FilterType = 'all' | 'would_love' | 'just_an_idea';

export default function MyListScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [wishlist, setWishlist] = useState<Wishlist | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setErrorMessage(null);

    try {
      const { wishlist: userList, error: listError } =
        await WishlistService.getOrCreateDefaultWishlist(user.id);

      if (listError || !userList) {
        setErrorMessage(listError?.message || 'Could not load your wishlist.');
        return;
      }

      setWishlist(userList);

      const { items: listItems, error: itemsError } =
        await WishlistService.getWishlistItems(userList.id);

      if (itemsError) {
        setErrorMessage(itemsError.message);
      } else {
        setItems(listItems);
        WidgetService.updateWidgetSnapshot({
          isLoggedIn: true,
          wishlistPreview: listItems.slice(0, 3).map((item) => ({
            title: item.title,
            price: item.approx_price ? `$${item.approx_price.toFixed(2)}` : '',
            deepLink: 'wishlist://my-list',
          })),
        });
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Unexpected error loading wishlist.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Reload when screen gains focus (e.g. after adding or editing an item)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOpenLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot Open Link', 'The URL is not supported by your device browser.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open the link.');
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'would_love') return item.preference_level === 'would_love';
    if (filter === 'just_an_idea') return item.preference_level === 'just_an_idea';
    return true;
  });

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Friend';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Action Bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}>
        <View>
          <Text style={[styles.listTitle, { color: colors.text }]}>
            {wishlist?.name || 'My Wishlist'}
          </Text>
          <Text style={[styles.itemCount, { color: colors.textSecondary }]}>
            {items.length} {items.length === 1 ? 'gift idea' : 'gift ideas'} saved
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(app)/add-item')}
          activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addButtonText}>Add Idea</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      {items.length > 0 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'all'
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setFilter('all')}>
            <Text
              style={[
                styles.filterText,
                { color: filter === 'all' ? '#FFFFFF' : colors.textSecondary },
              ]}>
              All ({items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'would_love'
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setFilter('would_love')}>
            <Text
              style={[
                styles.filterText,
                { color: filter === 'would_love' ? '#FFFFFF' : colors.textSecondary },
              ]}>
              ❤️ Would love ({items.filter((i) => i.preference_level === 'would_love').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterPill,
              filter === 'just_an_idea'
                ? { backgroundColor: colors.warning, borderColor: colors.warning }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => setFilter('just_an_idea')}>
            <Text
              style={[
                styles.filterText,
                { color: filter === 'just_an_idea' ? '#FFFFFF' : colors.textSecondary },
              ]}>
              💡 Ideas ({items.filter((i) => i.preference_level === 'just_an_idea').length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading your wishlist...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Could not load wishlist</Text>
          <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{errorMessage}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        /* Empty State */
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="gift-outline" size={44} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Your wishlist is empty</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Add any gift you've got your eye on by pasting a product link. We'll extract the photo and price automatically!
          </Text>

          <TouchableOpacity
            style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(app)/add-item')}
            activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyActionButtonText}>Add Your First Gift Idea</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Items List */
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }>
          {filteredItems.map((item) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
                Shadows?.subtle,
              ]}>
              <View style={styles.cardHeader}>
                {/* Product Image */}
                {item.image_url ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.itemImage}
                    contentFit="cover"
                    transition={200}
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

                {/* Details */}
                <View style={styles.itemDetails}>
                  <View style={styles.tagRow}>
                    {/* Preference Badge */}
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

                    {/* Price Tag */}
                    {item.approx_price !== null && (
                      <Text style={[styles.priceTag, { color: colors.text }]}>
                        ${item.approx_price.toFixed(2)}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[styles.itemTitle, { color: colors.text }]}
                    numberOfLines={2}>
                    {item.title}
                  </Text>

                  {item.notes ? (
                    <Text
                      style={[styles.itemNotes, { color: colors.textSecondary }]}
                      numberOfLines={2}>
                      📝 {item.notes}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Card Actions */}
              <View
                style={[
                  styles.cardActions,
                  { borderTopColor: colors.border },
                ]}>
                <TouchableOpacity
                  style={[styles.openLinkButton, { backgroundColor: colors.backgroundElement }]}
                  onPress={() => handleOpenLink(item.url)}
                  activeOpacity={0.7}>
                  <Ionicons name="open-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.openLinkText, { color: colors.primary }]}>
                    Open Store Link
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/edit-item',
                      params: {
                        id: item.id,
                        title: item.title,
                        url: item.url,
                        imageUrl: item.image_url || '',
                        price: item.approx_price ? item.approx_price.toString() : '',
                        preference: item.preference_level,
                        notes: item.notes || '',
                      },
                    })
                  }
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
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
  listTitle: {
    ...Typography.h2,
  },
  itemCount: {
    ...Typography.caption,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: {
    ...Typography.captionBold,
  },
  listContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  itemCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  itemImage: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000000',
  },
  placeholderImage: {
    width: 84,
    height: 84,
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
  editButton: {
    padding: Spacing.xs,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
  },
  errorTitle: {
    ...Typography.h3,
  },
  errorBody: {
    ...Typography.body,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  retryButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
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
    maxWidth: 300,
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

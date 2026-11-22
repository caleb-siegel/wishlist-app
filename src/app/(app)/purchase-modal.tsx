import React, { useState } from 'react';
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
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { PurchasesService } from '@/services/purchases';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';
import { WishlistItem } from '@/types/database.types';

export default function PurchaseModal() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const params = useLocalSearchParams<{
    itemId: string;
    itemTitle: string;
    itemUrl: string;
    itemImage?: string;
    itemPrice?: string;
    purchaseId?: string;
    existingNotes?: string;
  }>();

  const isAlreadyPurchased = !!params.purchaseId;

  const [notes, setNotes] = useState(params.existingNotes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleMarkPurchased = async () => {
    if (!user || !params.itemId) return;

    setIsSaving(true);

    const priceNum = params.itemPrice ? parseFloat(params.itemPrice) : null;

    const dummyItem: WishlistItem = {
      id: params.itemId,
      wishlist_id: '',
      title: params.itemTitle,
      url: params.itemUrl,
      image_url: params.itemImage || null,
      approx_price: isNaN(priceNum as any) ? null : priceNum,
      currency: 'USD',
      notes: null,
      preference_level: 'would_love',
      sort_order: 0,
      created_at: '',
      updated_at: '',
    };

    const { error } = await PurchasesService.markAsPurchased(user.id, dummyItem, notes);

    setIsSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  };

  const handleUpdateNotes = async () => {
    if (!params.purchaseId) return;

    setIsSaving(true);
    const { error } = await PurchasesService.updatePurchaseNotes(params.purchaseId, notes);
    setIsSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  };

  const handleUnmarkPurchased = () => {
    Alert.alert(
      'Remove Purchase Marker?',
      'This will remove this item from your private purchase history.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!params.purchaseId) return;
            setIsSaving(true);
            const { error } = await PurchasesService.unmarkAsPurchased(params.purchaseId);
            setIsSaving(false);

            if (error) {
              Alert.alert('Error', error.message);
            } else {
              router.back();
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        {/* Item Summary Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <View style={styles.itemHeader}>
            {params.itemImage ? (
              <Image
                source={{ uri: params.itemImage }}
                style={styles.itemImage}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.placeholderImage,
                  { backgroundColor: colors.backgroundElement },
                ]}>
                <Ionicons name="gift-outline" size={24} color={colors.textMuted} />
              </View>
            )}

            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={2}>
                {params.itemTitle}
              </Text>
              {params.itemPrice ? (
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  ${parseFloat(params.itemPrice).toFixed(2)}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {/* Privacy Assurance Banner */}
        <View
          style={[
            styles.privacyBadge,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}>
          <Ionicons name="eye-off" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.privacyTitle, { color: colors.primary }]}>
              100% Secret to the Recipient
            </Text>
            <Text style={[styles.privacyBody, { color: colors.textSecondary }]}>
              The recipient will never see this purchase mark, your notes, or receive any
              notifications. This is stored exclusively in your private shopper vault.
            </Text>
          </View>
        </View>

        {/* Private Notes Field */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Private Shopper Notes</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Optional notes for yourself (e.g. Order #, arrival date, size ordered, hiding spot).
          </Text>

          <View
            style={[
              styles.textAreaWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <TextInput
              style={[styles.textArea, { color: colors.text }]}
              placeholder="e.g. Ordered on Amazon Nov 22, arriving Tuesday. Hidden in top closet."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        {/* Action Buttons */}
        {isAlreadyPurchased ? (
          <View style={{ gap: Spacing.md }}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                isSaving && { opacity: 0.7 },
              ]}
              onPress={handleUpdateNotes}
              disabled={isSaving}
              activeOpacity={0.8}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Update Private Notes</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.unmarkButton,
                { backgroundColor: colors.dangerLight, borderColor: colors.danger },
                isSaving && { opacity: 0.7 },
              ]}
              onPress={handleUnmarkPurchased}
              disabled={isSaving}
              activeOpacity={0.8}>
              <Text style={[styles.unmarkButtonText, { color: colors.danger }]}>
                Unmark as Purchased
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.success },
              isSaving && { opacity: 0.7 },
            ]}
            onPress={handleMarkPurchased}
            disabled={isSaving}
            activeOpacity={0.8}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Mark as Purchased Privately</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
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
    gap: Spacing.sm,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    backgroundColor: '#000000',
  },
  placeholderImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    ...Typography.bodyBold,
  },
  itemPrice: {
    ...Typography.captionBold,
  },
  privacyBadge: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  privacyTitle: {
    ...Typography.bodyBold,
    marginBottom: 4,
  },
  privacyBody: {
    ...Typography.caption,
    lineHeight: 18,
  },
  sectionHeading: {
    ...Typography.h3,
  },
  sectionSubtitle: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 90,
  },
  textArea: {
    ...Typography.body,
    textAlignVertical: 'top',
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
  unmarkButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unmarkButtonText: {
    ...Typography.bodyBold,
  },
});

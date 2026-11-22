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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { WishlistService } from '@/services/wishlist';
import { fetchLinkMetadata, isValidWebUrl } from '@/services/metadata';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';
import { PreferenceLevel } from '@/types/database.types';

export default function AddItemScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [approxPrice, setApproxPrice] = useState('');
  const [preferenceLevel, setPreferenceLevel] = useState<PreferenceLevel>('would_love');
  const [notes, setNotes] = useState('');

  const [isInspecting, setIsInspecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasInspected, setHasInspected] = useState(false);

  // Best-effort automatic metadata extraction
  const handleInspectUrl = async (targetUrl?: string) => {
    const urlToTest = (targetUrl || url).trim();
    if (!urlToTest) {
      Alert.alert('Missing URL', 'Please paste a valid product link first.');
      return;
    }

    if (!isValidWebUrl(urlToTest)) {
      Alert.alert('Invalid URL', 'Please enter a valid link starting with http:// or https://');
      return;
    }

    setIsInspecting(true);

    try {
      const meta = await fetchLinkMetadata(urlToTest);
      setHasInspected(true);

      if (meta.title && !title) {
        setTitle(meta.title);
      }
      if (meta.imageUrl && !imageUrl) {
        setImageUrl(meta.imageUrl);
      }
      if (meta.approxPrice !== null && !approxPrice) {
        setApproxPrice(meta.approxPrice.toString());
      }
    } catch {
      // Best-effort: ignore and allow manual entry
    } finally {
      setIsInspecting(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      Alert.alert('Missing URL', 'A product link is required.');
      return;
    }

    if (!isValidWebUrl(trimmedUrl)) {
      Alert.alert('Invalid URL', 'Please enter a valid web address starting with http:// or https://');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give this item a title or name.');
      return;
    }

    setIsSaving(true);

    // Get default wishlist
    const { wishlist, error: listError } = await WishlistService.getOrCreateDefaultWishlist(user.id);
    if (listError || !wishlist) {
      setIsSaving(false);
      Alert.alert('Error', 'Could not access your wishlist. Please try again.');
      return;
    }

    const priceNum = approxPrice.trim() ? parseFloat(approxPrice.trim().replace(/[^0-9.]/g, '')) : null;

    const { error: saveError } = await WishlistService.createItem({
      wishlist_id: wishlist.id,
      url: trimmedUrl,
      title: title.trim(),
      image_url: imageUrl.trim() || null,
      approx_price: isNaN(priceNum as any) ? null : priceNum,
      currency: 'USD',
      notes: notes.trim() || null,
      preference_level: preferenceLevel,
    });

    setIsSaving(false);

    if (saveError) {
      Alert.alert('Save Failed', saveError.message);
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
        {/* URL Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>1. Product Link</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Paste any link from Amazon, Target, Etsy, or any web store.
          </Text>

          <View style={styles.urlInputRow}>
            <View
              style={[
                styles.urlInputWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <Ionicons name="link-outline" size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                value={url}
                onChangeText={(text) => {
                  setUrl(text);
                  // If pasted a valid URL, auto-inspect
                  if (isValidWebUrl(text) && !hasInspected) {
                    handleInspectUrl(text);
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.inspectButton,
                { backgroundColor: colors.primary },
                isInspecting && { opacity: 0.7 },
              ]}
              onPress={() => handleInspectUrl()}
              disabled={isInspecting}
              activeOpacity={0.8}>
              {isInspecting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.inspectButtonText}>Auto-fill</Text>
              )}
            </TouchableOpacity>
          </View>

          {isInspecting && (
            <View style={styles.inspectingBanner}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.inspectingText, { color: colors.primary }]}>
                Attempting to auto-extract product details...
              </Text>
            </View>
          )}
        </View>

        {/* Item Details Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>2. Item Details</Text>

          {/* Image Preview if available */}
          {imageUrl ? (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.imagePreview}
                contentFit="cover"
                transition={200}
              />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setImageUrl('')}>
                <Ionicons name="close-circle" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Title input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Title / Name *</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="e.g. Wireless Noise-Cancelling Headphones"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          {/* Price input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Approx. Price ($ USD)</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <Text style={{ color: colors.textSecondary, marginRight: 6 }}>$</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="49.99"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={approxPrice}
                onChangeText={setApproxPrice}
              />
            </View>
          </View>

          {/* Preference Level Segmented Control */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>How much do you want this?</Text>
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[
                  styles.segmentOption,
                  preferenceLevel === 'would_love' && {
                    backgroundColor: colors.accentLight,
                    borderColor: colors.accent,
                  },
                  preferenceLevel !== 'would_love' && {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setPreferenceLevel('would_love')}
                activeOpacity={0.8}>
                <Text style={styles.segmentIcon}>❤️</Text>
                <View>
                  <Text
                    style={[
                      styles.segmentTitle,
                      { color: preferenceLevel === 'would_love' ? colors.accent : colors.text },
                    ]}>
                    Would love this
                  </Text>
                  <Text style={[styles.segmentDesc, { color: colors.textSecondary }]}>
                    Top priority idea
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.segmentOption,
                  preferenceLevel === 'just_an_idea' && {
                    backgroundColor: colors.warningLight,
                    borderColor: colors.warning,
                  },
                  preferenceLevel !== 'just_an_idea' && {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setPreferenceLevel('just_an_idea')}
                activeOpacity={0.8}>
                <Text style={styles.segmentIcon}>💡</Text>
                <View>
                  <Text
                    style={[
                      styles.segmentTitle,
                      { color: preferenceLevel === 'just_an_idea' ? colors.warning : colors.text },
                    ]}>
                    Just an idea
                  </Text>
                  <Text style={[styles.segmentDesc, { color: colors.textSecondary }]}>
                    Casual suggestion
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Notes for your partner (Size, Color, Details)
            </Text>
            <View
              style={[
                styles.textAreaWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <TextInput
                style={[styles.textArea, { color: colors.text }]}
                placeholder="e.g. Size Medium, Matte Black color, or any model with USB-C"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        </View>

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
            <Text style={styles.saveButtonText}>Save to Wishlist</Text>
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
  urlInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  urlInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inspectButton: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inspectButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  inspectingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  inspectingText: {
    ...Typography.captionBold,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 160,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
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
    height: 48,
  },
  input: {
    flex: 1,
    ...Typography.body,
    height: '100%',
  },
  textAreaWrapper: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 80,
  },
  textArea: {
    ...Typography.body,
    textAlignVertical: 'top',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  segmentIcon: {
    fontSize: 22,
  },
  segmentTitle: {
    ...Typography.captionBold,
  },
  segmentDesc: {
    fontSize: 11,
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

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
  useColorScheme,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WishlistService } from '@/services/wishlist';
import { isValidWebUrl } from '@/services/metadata';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';
import { PreferenceLevel } from '@/types/database.types';

export default function EditItemScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    url?: string;
    imageUrl?: string;
    price?: string;
    preference?: string;
    notes?: string;
  }>();

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [url, setUrl] = useState(params.url || '');
  const [title, setTitle] = useState(params.title || '');
  const [imageUrl, setImageUrl] = useState(params.imageUrl || '');
  const [approxPrice, setApproxPrice] = useState(params.price || '');
  const [preferenceLevel, setPreferenceLevel] = useState<PreferenceLevel>(
    (params.preference as PreferenceLevel) || 'would_love'
  );
  const [notes, setNotes] = useState(params.notes || '');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleUpdate = async () => {
    if (!params.id) return;

    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please provide a title for this item.');
      return;
    }

    if (!url.trim() || !isValidWebUrl(url.trim())) {
      Alert.alert('Invalid URL', 'Please enter a valid product link.');
      return;
    }

    setIsSaving(true);

    const priceNum = approxPrice.trim() ? parseFloat(approxPrice.trim().replace(/[^0-9.]/g, '')) : null;

    const { error } = await WishlistService.updateItem(params.id, {
      title: title.trim(),
      url: url.trim(),
      image_url: imageUrl.trim() || null,
      approx_price: isNaN(priceNum as any) ? null : priceNum,
      preference_level: preferenceLevel,
      notes: notes.trim() || null,
    });

    setIsSaving(false);

    if (error) {
      Alert.alert('Update Failed', error.message);
    } else {
      router.back();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Gift Idea',
      'Are you sure you want to remove this item from your wishlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!params.id) return;
            setIsDeleting(true);
            const { error } = await WishlistService.deleteItem(params.id);
            setIsDeleting(false);

            if (error) {
              Alert.alert('Delete Failed', error.message);
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
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.cardBorder },
            Shadows?.subtle,
          ]}>
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

          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Title / Name *</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          {/* URL */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Product Link *</Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Price */}
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
                keyboardType="decimal-pad"
                value={approxPrice}
                onChangeText={setApproxPrice}
              />
            </View>
          </View>

          {/* Preference Level */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Preference Level</Text>
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
                <Text
                  style={[
                    styles.segmentTitle,
                    { color: preferenceLevel === 'would_love' ? colors.accent : colors.text },
                  ]}>
                  Would love this
                </Text>
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
                <Text
                  style={[
                    styles.segmentTitle,
                    { color: preferenceLevel === 'just_an_idea' ? colors.warning : colors.text },
                  ]}>
                  Just an idea
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes */}
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
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            isSaving && { opacity: 0.7 },
          ]}
          onPress={handleUpdate}
          disabled={isSaving}
          activeOpacity={0.8}>
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.deleteButton,
            { backgroundColor: colors.dangerLight, borderColor: colors.danger },
            isDeleting && { opacity: 0.7 },
          ]}
          onPress={handleDelete}
          disabled={isDeleting}
          activeOpacity={0.8}>
          {isDeleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>
              Delete Gift Idea
            </Text>
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
    gap: Spacing.xs,
  },
  segmentIcon: {
    fontSize: 20,
  },
  segmentTitle: {
    ...Typography.captionBold,
  },
  saveButton: {
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  deleteButton: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    ...Typography.bodyBold,
  },
});

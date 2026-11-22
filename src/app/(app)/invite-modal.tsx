import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import { SharingService } from '@/services/sharing';
import { SharingInvitation, WishlistShare, Profile } from '@/types/database.types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

export default function InviteModal() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeShares, setActiveShares] = useState<(WishlistShare & { viewer_profile?: Profile })[]>([]);
  const [pendingInvites, setPendingInvites] = useState<SharingInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSharingData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [sharesRes, invitesRes] = await Promise.all([
      SharingService.getActiveSharesAsOwner(user.id),
      SharingService.getSentInvitations(user.id),
    ]);

    setActiveShares(sharesRes.shares);
    setPendingInvites(invitesRes.invitations);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSharingData();
  }, [loadSharingData]);

  const handleSendInvite = async () => {
    if (!user) return;
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSending(true);

    const { error } = await SharingService.invitePartner(user.id, cleanEmail);

    setIsSending(false);

    if (error) {
      Alert.alert('Invitation Failed', error.message);
    } else {
      setEmail('');
      Alert.alert(
        'Invitation Created!',
        `An invitation was generated for ${cleanEmail}. When they open the app and sign in with this email, they will see your wishlist!`
      );
      loadSharingData();
    }
  };

  const handleRevokeShare = (share: WishlistShare & { viewer_profile?: Profile }) => {
    const partnerName = share.viewer_profile?.display_name || 'this partner';
    Alert.alert(
      'Revoke Access?',
      `Are you sure you want to revoke access for ${partnerName}? They will immediately lose access to your wishlist.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            const { error } = await SharingService.revokeShare(share.id);
            if (error) {
              Alert.alert('Revocation Failed', error.message);
            } else {
              loadSharingData();
            }
          },
        },
      ]
    );
  };

  const handleCancelInvite = (invitationId: string) => {
    Alert.alert('Cancel Invitation', 'Cancel this pending invitation?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Invite',
        style: 'destructive',
        onPress: async () => {
          await SharingService.cancelInvitation(invitationId);
          loadSharingData();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled">
      {/* Intro Explanation */}
      <View
        style={[
          styles.infoCard,
          { backgroundColor: colors.primaryLight, borderColor: colors.primary },
        ]}>
        <Ionicons name="people" size={24} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>
            Share Your Wishlist
          </Text>
          <Text style={[styles.infoBody, { color: colors.textSecondary }]}>
            Invite your partner or a trusted person to view your wishlist. They will be able to see
            your gift ideas and dates, and secretly mark items they buy so you don't receive duplicates.
          </Text>
        </View>
      </View>

      {/* Invite Form */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Invite by Email</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Enter the email address of the person you want to invite.
        </Text>

        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputWrapper,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="partner@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              isSending && { opacity: 0.7 },
            ]}
            onPress={handleSendInvite}
            disabled={isSending}
            activeOpacity={0.8}>
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Invite</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Shares Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionHeaderTitle, { color: colors.textSecondary }]}>
          ACTIVE CONNECTED PARTNERS ({activeShares.length})
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
        ) : activeShares.length === 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}>
            <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>
              No active shares yet. Send an invite above!
            </Text>
          </View>
        ) : (
          activeShares.map((share) => (
            <View
              key={share.id}
              style={[
                styles.shareCard,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
                Shadows?.subtle,
              ]}>
              <View style={styles.partnerInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="person" size={18} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partnerName, { color: colors.text }]}>
                    {share.viewer_profile?.display_name || 'Partner'}
                  </Text>
                  <Text style={[styles.shareBadge, { color: colors.success }]}>
                    ● Active Viewer
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.revokeButton, { borderColor: colors.danger }]}
                onPress={() => handleRevokeShare(share)}>
                <Text style={[styles.revokeButtonText, { color: colors.danger }]}>
                  Revoke
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Pending Invitations Section */}
      {pendingInvites.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionHeaderTitle, { color: colors.textSecondary }]}>
            PENDING INVITATIONS ({pendingInvites.length})
          </Text>

          {pendingInvites.map((inv) => (
            <View
              key={inv.id}
              style={[
                styles.shareCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <View style={styles.partnerInfo}>
                <View style={[styles.avatar, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="time" size={18} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.partnerName, { color: colors.text }]}>
                    {inv.invitee_email}
                  </Text>
                  <Text style={[styles.shareBadge, { color: colors.warning }]}>
                    Waiting for acceptance
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => handleCancelInvite(inv.id)}>
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  infoCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  infoTitle: {
    ...Typography.bodyBold,
    marginBottom: 4,
  },
  infoBody: {
    ...Typography.caption,
    lineHeight: 18,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sectionHeading: {
    ...Typography.h3,
  },
  sectionSubtitle: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  inputWrapper: {
    flex: 1,
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
  sendButton: {
    height: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    ...Typography.bodyBold,
    color: '#FFFFFF',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeaderTitle: {
    ...Typography.small,
    marginLeft: Spacing.xs,
  },
  emptySectionText: {
    ...Typography.body,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  partnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerName: {
    ...Typography.bodyBold,
  },
  shareBadge: {
    ...Typography.small,
    marginTop: 1,
  },
  revokeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  revokeButtonText: {
    ...Typography.captionBold,
  },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  cancelButtonText: {
    ...Typography.caption,
  },
});

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { SharingInvitation, WishlistShare, Profile, UserSearchResult } from '@/types/database.types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '@/constants/theme';

export default function InviteModal() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Direct email invite state
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showEmailSection, setShowEmailSection] = useState(false);

  // Shares & Pending Invites
  const [activeShares, setActiveShares] = useState<(WishlistShare & { viewer_profile?: Profile; viewer_email?: string })[]>([]);
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

  // Debounced search for registered app users
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      if (!user) return;
      const { users, error } = await SharingService.searchUsers(trimmed, user.id);
      setIsSearching(false);
      if (!error && users) {
        setSearchResults(users);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, user]);

  // Invite an existing app user selected from search
  const handleInviteUser = async (targetUser: UserSearchResult) => {
    if (!user) return;

    if (targetUser.status === 'connected') {
      Alert.alert('Already Connected', `${targetUser.display_name || 'This user'} is already an active partner viewing your wishlist.`);
      return;
    }

    if (targetUser.status === 'pending') {
      Alert.alert('Invite Pending', `An invitation has already been sent to ${targetUser.display_name || 'this user'}.`);
      return;
    }

    const targetEmail = targetUser.email || '';
    if (!targetEmail) {
      Alert.alert('Cannot Invite', 'This user does not have an associated email address.');
      return;
    }

    setInvitingUserId(targetUser.id);

    const { error } = await SharingService.invitePartner(user.id, targetEmail, targetUser.id);

    setInvitingUserId(null);

    if (error) {
      Alert.alert('Invitation Failed', error.message);
    } else {
      Alert.alert(
        'Invitation Sent!',
        `An invitation was sent to ${targetUser.display_name || targetEmail}. When they open the app, they can accept access immediately.`
      );
      // Re-trigger search to update statuses
      if (searchQuery.trim().length >= 2) {
        const { users } = await SharingService.searchUsers(searchQuery.trim(), user.id);
        if (users) setSearchResults(users);
      }
      loadSharingData();
    }
  };

  // Invite by email directly (for users not yet on the app or searched)
  const handleSendEmailInvite = async (customEmail?: string) => {
    if (!user) return;
    const targetEmail = (customEmail || email).trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setIsSendingEmail(true);

    const { error } = await SharingService.invitePartner(user.id, targetEmail);

    setIsSendingEmail(false);

    if (error) {
      Alert.alert('Invitation Failed', error.message);
    } else {
      setEmail('');
      setSearchQuery('');
      Alert.alert(
        'Invitation Created!',
        `An invitation was created for ${targetEmail}. When they download the app and sign in with this email, they will see your wishlist!`
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

  const isEmailFormat = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

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
            Search for friends or partners registered on the app, or invite someone by email.
            They will be able to see your gift ideas and secretly mark items they buy.
          </Text>
        </View>
      </View>

      {/* Main Search Section */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Find Someone on the App</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Search for another user by their name or email address.
        </Text>

        <View
          style={[
            styles.searchWrapper,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Search by name or email..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 6 }} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Search Results List */}
        {searchQuery.trim().length >= 2 && (
          <View style={styles.resultsContainer}>
            {isSearching ? (
              <View style={styles.searchStatusBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.searchStatusText, { color: colors.textSecondary }]}>Searching users...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <View style={styles.resultsList}>
                {searchResults.map((targetUser) => {
                  const initial = (targetUser.display_name || targetUser.email || '?').charAt(0).toUpperCase();
                  const isInvitingThis = invitingUserId === targetUser.id;

                  return (
                    <View
                      key={targetUser.id}
                      style={[
                        styles.userResultRow,
                        { borderColor: colors.border },
                      ]}>
                      <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
                      </View>

                      <View style={{ flex: 1, marginRight: Spacing.sm }}>
                        <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                          {targetUser.display_name || 'App User'}
                        </Text>
                        {targetUser.email ? (
                          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                            {targetUser.email}
                          </Text>
                        ) : null}
                      </View>

                      {targetUser.status === 'connected' ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.successLight }]}>
                          <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: colors.success }]}>Connected</Text>
                        </View>
                      ) : targetUser.status === 'pending' ? (
                        <View style={[styles.statusBadge, { backgroundColor: colors.warningLight }]}>
                          <Ionicons name="time" size={14} color={colors.warning} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusBadgeText, { color: colors.warning }]}>Pending</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.inviteUserBtn,
                            { backgroundColor: colors.primary },
                            isInvitingThis && { opacity: 0.7 },
                          ]}
                          onPress={() => handleInviteUser(targetUser)}
                          disabled={isInvitingThis}
                          activeOpacity={0.8}>
                          {isInvitingThis ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="person-add-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                              <Text style={styles.inviteUserBtnText}>Invite</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.noResultBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.noResultTitle, { color: colors.text }]}>
                    No registered user found for "{searchQuery.trim()}"
                  </Text>
                  <Text style={[styles.noResultSubtitle, { color: colors.textSecondary }]}>
                    Not on the app yet? You can invite them with an email address below.
                  </Text>
                </View>

                {isEmailFormat(searchQuery) && (
                  <TouchableOpacity
                    style={[styles.quickEmailBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleSendEmailInvite(searchQuery.trim())}
                    disabled={isSendingEmail}>
                    {isSendingEmail ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.quickEmailBtnText}>Invite Email</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Fallback Email Invite Section */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          Shadows?.subtle,
        ]}>
        <TouchableOpacity
          style={styles.collapsibleHeader}
          onPress={() => setShowEmailSection(!showEmailSection)}
          activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <View>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                Invite by Email (Not on App Yet)
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginBottom: 0 }]}>
                Send an invite to someone who hasn't joined the app yet.
              </Text>
            </View>
          </View>
          <Ionicons
            name={showEmailSection ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {showEmailSection && (
          <View style={styles.emailFormContainer}>
            <View style={styles.inputRow}>
              <View
                style={[
                  styles.inputWrapper,
                  { backgroundColor: colors.backgroundElement, borderColor: colors.border },
                ]}>
                <Ionicons name="mail" size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
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
                  isSendingEmail && { opacity: 0.7 },
                ]}
                onPress={() => handleSendEmailInvite()}
                disabled={isSendingEmail}
                activeOpacity={0.8}>
                {isSendingEmail ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
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
              No active shares yet. Search or invite a partner above!
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
                    {share.viewer_profile?.display_name || share.viewer_email || 'Partner'}
                  </Text>
                  {share.viewer_profile?.email && (
                    <Text style={[styles.partnerSubText, { color: colors.textSecondary }]}>
                      {share.viewer_profile.email}
                    </Text>
                  )}
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
                    {inv.invitee_profile?.display_name || inv.invitee_email}
                  </Text>
                  {inv.invitee_profile?.display_name && (
                    <Text style={[styles.partnerSubText, { color: colors.textSecondary }]}>
                      {inv.invitee_email}
                    </Text>
                  )}
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
  searchWrapper: {
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
  resultsContainer: {
    marginTop: Spacing.xs,
  },
  searchStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchStatusText: {
    ...Typography.caption,
  },
  resultsList: {
    gap: Spacing.xs,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    ...Typography.bodyBold,
  },
  userName: {
    ...Typography.bodyBold,
  },
  userEmail: {
    ...Typography.caption,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  inviteUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  inviteUserBtnText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
  noResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  noResultTitle: {
    ...Typography.bodyBold,
    fontSize: 13,
  },
  noResultSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
  quickEmailBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  quickEmailBtnText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emailFormContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
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
  partnerSubText: {
    ...Typography.small,
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

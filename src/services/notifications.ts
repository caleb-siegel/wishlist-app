import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  /**
   * Asks for notification permissions and registers the push token in Supabase.
   */
  async registerForPushNotifications(userId: string): Promise<string | null> {
    if (!Device.isDevice && Platform.OS !== 'web') {
      console.log('Must use physical device for push notifications');
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });

      const pushToken = tokenData.data;

      // Save token in push_devices table
      if (pushToken && userId) {
        await supabase.from('push_devices').upsert(
          {
            user_id: userId,
            expo_push_token: pushToken,
            platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,expo_push_token' }
        );
      }

      return pushToken;
    } catch (error) {
      console.warn('Failed to register push token:', error);
      return null;
    }
  },

  /**
   * Triggers an immediate test notification on the device.
   */
  async triggerLocalTestNotification(title: string, body: string, data?: Record<string, any>) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // trigger immediately
    });
  },
};

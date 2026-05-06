import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('conflicts', {
      name: 'Schedule Conflicts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function sendConflictNotification(
  date: string,
  jobNameA: string,
  jobNameB: string,
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Schedule Conflict',
      body: `Conflict on ${date} between ${jobNameA} and ${jobNameB}. Confirm anyway?`,
      sound: true,
    },
    trigger: null, // fire immediately
  });
}

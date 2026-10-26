import * as Notifications from 'expo-notifications';

/**
 * Un solo aviso "¿cómo te fue?" por prueba, sin sonido, solo si la persona eligió que le avisemos
 * (COGA: recordatorios solo a petición). El permiso se pide en ese momento, no al instalar.
 */
const MAX_PER_DAY = 5;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function scheduleCheckout(checkinId: string, minutes: number, title: string, body: string) {
  const permission = await Notifications.getPermissionsAsync();
  const granted =
    permission.granted ||
    (permission.canAskAgain &&
      (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } }))
        .granted);
  if (!granted) return false;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (pending.length >= MAX_PER_DAY) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: `checkout-${checkinId}`,
    content: { title, body, sound: false, data: { checkinId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
  });
  return true;
}

/** Al contestar antes de tiempo, el aviso ya no hace falta. */
export async function cancelCheckout(checkinId: string) {
  await Notifications.cancelScheduledNotificationAsync(`checkout-${checkinId}`).catch(() => {});
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

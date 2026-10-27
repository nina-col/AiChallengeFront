import * as Notifications from 'expo-notifications';

/**
 * Avisos locales, sin sonido y solo cuando la persona los pide (COGA: recordatorios a petición).
 * El permiso se pide en ese momento, no al instalar.
 * - "¿Cómo te fue?": uno por prueba, como mucho 5 pendientes.
 * - Resumen semanal: opcional, el día y la hora que la persona elija.
 * El texto que se ve con el teléfono bloqueado nunca dice qué ajuste ni qué molesta (guía de Apple:
 * nada sensible en la pantalla bloqueada). Sin sonido, sin número en el ícono y nunca "urgentes".
 */
const MAX_CHECKOUTS = 5;
const RECAP_ID = 'weekly-recap';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission() {
  const permission = await Notifications.getPermissionsAsync();
  return (
    permission.granted ||
    (permission.canAskAgain &&
      (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } }))
        .granted)
  );
}

export async function scheduleCheckout(checkinId: string, minutes: number, title: string, body: string) {
  if (!(await ensurePermission())) return false;

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  if (pending.filter((n) => n.identifier.startsWith('checkout-')).length >= MAX_CHECKOUTS) return false;

  await Notifications.scheduleNotificationAsync({
    identifier: `checkout-${checkinId}`,
    content: { title, body, sound: false, interruptionLevel: 'active', data: { checkinId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
  });
  return true;
}

/** Al contestar antes de tiempo, el aviso ya no hace falta. */
export async function cancelCheckout(checkinId: string) {
  await Notifications.cancelScheduledNotificationAsync(`checkout-${checkinId}`).catch(() => {});
}

/**
 * `weekday` como lo cuenta iOS: 1 = domingo, 2 = lunes… 7 = sábado. Llega en silencio al centro de
 * notificaciones (`passive`): el resumen puede esperar.
 */
export async function scheduleRecap(weekday: number, hour: number, title: string, body: string) {
  if (!(await ensurePermission())) return false;
  await cancelRecap();
  await Notifications.scheduleNotificationAsync({
    identifier: RECAP_ID,
    content: { title, body, sound: false, interruptionLevel: 'passive', data: { kind: 'recap' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute: 0 },
  });
  return true;
}

export async function cancelRecap() {
  await Notifications.cancelScheduledNotificationAsync(RECAP_ID).catch(() => {});
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

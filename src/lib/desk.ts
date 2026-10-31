import { ITEMS, type ItemId } from '@/components/desk/layers';
import { useProgress } from '@/lib/queries';

/**
 * "Tu escritorio": cada ajuste que pruebas hasta el final deja un objeto en la escena, **haya
 * ayudado o no**. Si solo ganara objeto lo que ayudó, la app estaría premiando una respuesta y
 * empujaría a contestar "ayudó", que es justo el dato que aprende el motor (notas de
 * investigación de retención, regla 1). Es progreso que se acumula y nunca se pierde: no hay
 * rachas ni nada que caduque. Los ajustes "para pedir a tu empresa" no se prueban aquí, pero
 * comparten el objeto de su tema.
 */
export const ITEM_FOR_ADJUSTMENT: Record<string, ItemId> = {
  noise_cancelling: 'headphones',
  earplugs: 'headphones',
  ask_noise_source: 'headphones',
  soft_masking: 'speaker',
  move_from_voices: 'succulent',
  book_quiet_room: 'succulent',
  move_from_smell: 'succulent',
  ask_quiet_desk: 'succulent',
  silence_notifications: 'phone',
  batch_messages: 'phone',
  focus_signal: 'sign',
  ask_focus_hours: 'sign',
  close_blinds: 'blinds',
  rotate_screen: 'blinds',
  turn_from_light: 'blinds',
  screen_brightness: 'screenDim',
  bigger_text: 'screenDim',
  one_window: 'screenDim',
  ask_antiglare: 'screenDim',
  desk_lamp: 'lamp',
  ask_lighting: 'lamp',
  clear_desk: 'tray',
  pick_three: 'tray',
  split_checklist: 'tray',
  easiest_first: 'tray',
  two_minute_start: 'tray',
  write_it_out: 'tray',
  new_first_step: 'tray',
  repeat_back: 'tray',
  check_it_out: 'tray',
  ask_written: 'tray',
  avoid_peak: 'succulent',
  ask_flexible_start: 'succulent',
  hide_self_view: 'phone',
  ask_camera_off: 'phone',
  time_block: 'sign',
  ask_notice_changes: 'sign',
  face_away: 'divider',
  ask_divider: 'divider',
  cooler_spot: 'fan',
  ask_temperature: 'fan',
  ventilate: 'fan',
  warm_layer: 'sweater',
  short_reset: 'mug',
  transition_pause: 'mug',
  ask_remote_focus: 'frame',
};

/** Orden fijo para leerlos con VoiceOver: de izquierda a derecha en la escena. */
const ORDER = (Object.keys(ITEMS) as ItemId[]).sort((a, b) => ITEMS[a].box[0] - ITEMS[b].box[0]);

/** Objetos de los ajustes ya probados (ids de `GET /v1/progress`). */
export function deskItems(tried: string[] | undefined): ItemId[] {
  const owned = new Set((tried ?? []).map((id) => ITEM_FOR_ADJUSTMENT[id]).filter(Boolean));
  return ORDER.filter((item) => owned.has(item));
}

export function useDesk() {
  const progress = useProgress();
  return {
    items: deskItems(progress.data?.tried),
    trials: progress.data?.trials ?? 0,
    ready: progress.isSuccess,
  };
}

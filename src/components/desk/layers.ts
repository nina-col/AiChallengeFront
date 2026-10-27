// Generado por docs/brand/draw_scene.py. No se edita a mano: se cambia el script y se vuelve a correr.

export const SCENE = { width: 64, height: 28 } as const;

export const LAYERS = {
  base: require('@/assets/scene/base.png'),
  plant: require('@/assets/scene/plant.png'),
  plantSway: require('@/assets/scene/plantSway.png'),
  sky: {
    dawn: require('@/assets/scene/sky-dawn.png'),
    day: require('@/assets/scene/sky-day.png'),
    dusk: require('@/assets/scene/sky-dusk.png'),
    night: require('@/assets/scene/sky-night.png'),
  },
  screen: {
    noisy: require('@/assets/scene/screen-noisy.png'),
    mid: require('@/assets/scene/screen-mid.png'),
    calm: require('@/assets/scene/screen-calm.png'),
  },
  screenDim: {
    noisy: require('@/assets/scene/screen-dim-noisy.png'),
    mid: require('@/assets/scene/screen-dim-mid.png'),
    calm: require('@/assets/scene/screen-dim-calm.png'),
  },
  steam: [require('@/assets/scene/steam-0.png'), require('@/assets/scene/steam-1.png')],
  fanAlt: require('@/assets/scene/fan-1.png'),
} as const;

/** Objetos que se ganan, con su caja en pixeles de la escena: [x0, y0, x1, y1]. */
export const ITEMS = {
  headphones: { source: require('@/assets/scene/item-headphones.png'), box: [18, 7, 24, 14] as const },
  lamp: { source: require('@/assets/scene/item-lamp.png'), box: [3, 12, 14, 22] as const },
  tray: { source: require('@/assets/scene/item-tray.png'), box: [13, 17, 19, 21] as const },
  divider: { source: require('@/assets/scene/item-divider.png'), box: [0, 7, 2, 21] as const },
  frame: { source: require('@/assets/scene/item-frame.png'), box: [3, 2, 11, 9] as const },
  sweater: { source: require('@/assets/scene/item-sweater.png'), box: [12, 3, 18, 11] as const },
  speaker: { source: require('@/assets/scene/item-speaker.png'), box: [47, 8, 52, 11] as const },
  fan: { source: require('@/assets/scene/item-fan.png'), box: [54, 7, 56, 11] as const },
  succulent: { source: require('@/assets/scene/item-succulent.png'), box: [58, 8, 60, 11] as const },
  mug: { source: require('@/assets/scene/item-mug.png'), box: [46, 18, 51, 21] as const },
  sign: { source: require('@/assets/scene/item-sign.png'), box: [53, 17, 58, 21] as const },
  phone: { source: require('@/assets/scene/item-phone.png'), box: [60, 15, 62, 21] as const },
  blinds: { source: require('@/assets/scene/item-blinds.png'), box: [21, 2, 42, 12] as const },
  screenDim: { source: null, box: [23, 11, 31, 16] as const },
} as const;

export type ItemId = keyof typeof ITEMS;
export type Sky = keyof typeof LAYERS.sky;
export type Wave = keyof typeof LAYERS.screen;

/**
 * Contrato del cuarto isométrico. Lo comparten:
 * - el generador de sprites (`docs/brand/draw_room.py` → `manifest.ts`, `assets/room/atlas.png` y
 *   `apps/api/catalog/room.json`),
 * - la lógica isométrica pura (`iso`, `occupancy`, `depth`, `hit`, `layout`),
 * - la API, que valida el layout con las mismas reglas.
 * Diseño y razones: docs/research/research_notes/Escritorio isometrico/tecnica.md (§4–§8).
 *
 * Coordenadas: celdas `(x, y)` con origen en la esquina trasera del piso; `x` crece hacia abajo a
 * la derecha y `y` hacia abajo a la izquierda. La pared izquierda está en el plano `x = 0` y la
 * derecha en `y = 0`. Todo se mide en pixeles de arte (1×) y se escala entero al dibujar.
 */

/** Giro en pasos de 90°; 0 = como se modeló. */
export type Facing = 0 | 1 | 2 | 3;

export type Wall = 'left' | 'right';

/** Dónde puede ir un tipo de objeto. */
export type PlaceKind = 'floor' | 'surface' | 'wall';

export type TypeSpec = {
  /** Lugares permitidos, en orden de preferencia para colocarlo solo. Vacío en los modificadores. */
  place: PlaceKind[];
  /**
   * Piso: celdas `[ancho en x, fondo en y]` con `rot` 0.
   * Pared: `[largo a lo largo de la pared, filas]`; cada fila mide 16 px de arte.
   * Superficie: `[1, 1]`.
   */
  footprint: [number, number];
  facings: Facing[];
  /** Alto en px de arte, para apilar y para ordenar. */
  height: number;
  /** Anfitrión: otros objetos pueden ir encima. `z` en px de arte; `slots` en celdas relativas con `rot` 0. */
  surface?: { z: number; slots: [number, number][] };
  /** Alfombra: va en su propia capa, debajo de los muebles, y no choca con ellos. */
  flat?: boolean;
  /** Viene en todo cuarto nuevo (escritorio, silla, planta, monitor). */
  base?: boolean;
  /** Decoración libre desde el primer día. */
  decor?: boolean;
  /**
   * Ajustes del catálogo cuya prueba terminada da este objeto, haya ayudado o no. En los tipos de
   * pared, `facings` 0 = pared derecha y 1 = izquierda; los objetos de superficie toman la
   * orientación de su anfitrión.
   */
  adjustments?: string[];
  /**
   * No es un objeto que se coloca: cambia otra pieza cuando la persona lo tiene.
   * `window`: la persiana sobre la ventana. `monitor`: la variante `dim` de la pantalla.
   */
  modifies?: 'window' | 'monitor';
  variants: string[];
  /** Animaciones de reposo: nombre → número de cuadros (por ejemplo `{ steam: 2 }`). */
  anim?: Record<string, number>;
  label: { es: string; en: string };
};

export type Frame = {
  /** Rectángulo en el atlas, en px: `[x, y, ancho, alto]`. */
  rect: [number, number, number, number];
  /**
   * Pixel del sprite que cae en el punto de apoyo: la esquina trasera de la huella a `z = 0` (piso),
   * la esquina trasera de la celda del slot a la altura `surface.z` (superficie) o la esquina
   * inferior trasera del tramo de pared (pared).
   */
  anchor: [number, number];
  /**
   * Máscara de 1 bit por pixel para el hit test exacto: por filas, sin relleno entre filas
   * (bit `i = y · ancho + x`, el primer pixel en el bit alto), en base64 estándar.
   */
  mask: string;
};

/**
 * Nombres de cuadro en `FRAMES`:
 * - objetos: `${type}.${variant}.r${facing}` y, si anima, `${type}.${variant}.r${facing}:${anim}${n}`;
 * - piso: `floor.${variant}` (una baldosa);
 * - pared: `wall.${variant}.${wall}` (un tramo de una celda de largo) y `window.${variant}.${wall}`
 *   (el tramo con el hueco de la ventana);
 * - cielo detrás de la ventana: `sky.${sky}.${wall}`; persiana: `blinds.${wall}`.
 */
export const objectFrame = (type: string, variant: string, facing: Facing) => `${type}.${variant}.r${facing}`;
export const animFrame = (type: string, variant: string, facing: Facing, anim: string, n: number) =>
  `${objectFrame(type, variant, facing)}:${anim}${n}`;

export type Sky = 'dawn' | 'day' | 'dusk' | 'night';

/** Lo que exporta `manifest.ts` (generado). */
export type Manifest = {
  tile: [number, number];
  voxelsPerTile: number;
  /** Alto de las paredes en px de arte. */
  wallHeight: number;
  atlasSize: [number, number];
  shell: { floors: string[]; walls: string[] };
  types: Record<string, TypeSpec>;
  frames: Record<string, Frame>;
};

/** Catálogo que usa la API para validar (`apps/api/catalog/room.json`): el manifiesto sin cuadros. */
export type RoomCatalog = Pick<Manifest, 'shell' | 'types'> & {
  version: 1;
  size: { w: number; d: number };
  /** Alto de las paredes en px de arte (filas de 16 px); si falta, 48. */
  wallHeight?: number;
};

// ── Layout v1 (se guarda como JSON en `rooms.layout`) ────────────────────────────────────────

export type ItemPlace =
  | { on: 'floor'; x: number; y: number; rot: Facing }
  | { on: 'surface'; host: string; slot: number }
  | { on: 'wall'; wall: Wall; u: number; row: number };

export type RoomItem = {
  /** 8 caracteres `[a-z0-9]`, únicos en el cuarto. */
  uid: string;
  type: string;
  variant: string;
  place: ItemPlace;
};

export type RoomLayout = {
  v: 1;
  size: { w: number; d: number };
  shell: {
    floor: string;
    wall: string;
    /** La ventana ocupa una celda de una pared; `u` es su posición a lo largo de ella. */
    window: { wall: Wall; u: number };
  };
  /** Lo que está en el cuarto. Lo ganado que no está aquí queda en el inventario (se calcula, no se guarda). */
  items: RoomItem[];
  /** Ajustes que la persona fijó en el corcho "Lo que me sirve aquí". La app nunca fija nada por su cuenta. */
  pinned: string[];
};

export const LIMITS = { maxItems: 60, maxBytes: 16384, maxSize: 8 } as const;

/** Un objeto listo para dibujar, en px de arte relativos al origen del lienzo, ya en orden. */
export type DrawItem = {
  frame: string;
  /** Esquina superior izquierda del sprite en el lienzo. */
  x: number;
  y: number;
  /** Objeto del layout al que pertenece (para tocarlo); ausente en piso, paredes y cielo. */
  uid?: string;
};

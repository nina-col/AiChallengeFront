import type { DrawItem, Manifest } from './types';

/**
 * Qué objeto está bajo el dedo (tecnica.md §6.6). Se recorre la `DrawList` de adelante hacia atrás:
 * primero la caja del sprite y luego su máscara de 1 bit. Si no se toca nada pero hay un objeto a
 * menos de `nearestPx` (12 pt pasados a px de arte), gana el más cercano: una taza de 10 px no
 * llega a los 44 pt de un objetivo táctil. Tocar otra vez en el mismo punto recorre los que se pisan.
 *
 * Máscara (contrato con el generador): bits por filas de arriba abajo y de izquierda a derecha, sin
 * relleno al final de cada fila (bit `i = y · ancho + x`), el primero en el bit más alto de cada
 * byte; el último byte se completa con ceros. Luego base64 estándar con `=`. Máscara vacía = caja
 * entera.
 */

export type HitOptions = { nearestPx?: number };

/** Valor de un carácter base64 (`=` y desconocidos cuentan como 0). */
function b64(c: number) {
  'worklet';
  if (c >= 65 && c <= 90) return c - 65;
  if (c >= 97 && c <= 122) return c - 71;
  if (c >= 48 && c <= 57) return c + 4;
  if (c === 43 || c === 45) return 62;
  if (c === 47 || c === 95) return 63;
  return 0;
}

/** ¿Está encendido el pixel `(px, py)` de una máscara de `w` px de ancho? Decodifica solo 4 caracteres. */
export function maskBit(mask: string, w: number, px: number, py: number): boolean {
  'worklet';
  const bit = py * w + px;
  const byte = bit >> 3;
  const group = Math.floor(byte / 3) * 4;
  if (group >= mask.length) return false;
  const v =
    (b64(mask.charCodeAt(group)) << 18) |
    (b64(mask.charCodeAt(group + 1)) << 12) |
    (b64(mask.charCodeAt(group + 2) || 61) << 6) |
    b64(mask.charCodeAt(group + 3) || 61);
  const value = (v >> (16 - 8 * (byte % 3))) & 255;
  return ((value >> (7 - (bit & 7))) & 1) === 1;
}

/** Codifica una máscara (un valor por pixel, por filas). Para el generador y las pruebas. */
export function encodeMask(bits: ArrayLike<number | boolean>): string {
  const bytes: number[] = new Array(Math.ceil(bits.length / 8)).fill(0);
  for (let i = 0; i < bits.length; i++) if (bits[i]) bytes[i >> 3] |= 128 >> (i & 7);
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += abc[(n >> 18) & 63] + abc[(n >> 12) & 63];
    s += i + 1 < bytes.length ? abc[(n >> 6) & 63] : '=';
    s += i + 2 < bytes.length ? abc[n & 63] : '=';
  }
  return s;
}

/** ¿El punto `(ax, ay)` del lienzo cae en un pixel opaco de este cuadro dibujado? */
function hitsItem(item: DrawItem, manifest: Pick<Manifest, 'frames'>, ax: number, ay: number) {
  'worklet';
  const frame = Object.prototype.hasOwnProperty.call(manifest.frames, item.frame) ? manifest.frames[item.frame] : null;
  if (!frame) return false;
  const px = Math.floor(ax - item.x);
  const py = Math.floor(ay - item.y);
  const w = frame.rect[2];
  if (px < 0 || py < 0 || px >= w || py >= frame.rect[3]) return false;
  return !frame.mask || maskBit(frame.mask, w, px, py);
}

/** Objetos (uid) bajo el punto, de adelante hacia atrás, sin repetir. */
export function hitCandidates(drawList: readonly DrawItem[], manifest: Pick<Manifest, 'frames'>, ax: number, ay: number) {
  'worklet';
  const out: string[] = [];
  for (let i = drawList.length - 1; i >= 0; i--) {
    const item = drawList[i];
    if (item.uid && out.indexOf(item.uid) < 0 && hitsItem(item, manifest, ax, ay)) out.push(item.uid);
  }
  return out;
}

/** Objeto más cercano con algún pixel opaco a `maxPx` o menos del punto (empata el de adelante). */
function nearest(drawList: readonly DrawItem[], manifest: Pick<Manifest, 'frames'>, ax: number, ay: number, maxPx: number) {
  'worklet';
  let best: string | null = null;
  let bestD = maxPx * maxPx;
  for (let i = drawList.length - 1; i >= 0; i--) {
    const item = drawList[i];
    if (!item.uid || !Object.prototype.hasOwnProperty.call(manifest.frames, item.frame)) continue;
    const frame = manifest.frames[item.frame];
    const [, , w, h] = frame.rect;
    const lx = ax - item.x;
    const ly = ay - item.y;
    const x0 = Math.max(0, Math.floor(lx - maxPx));
    const x1 = Math.min(w - 1, Math.floor(lx + maxPx));
    const y0 = Math.max(0, Math.floor(ly - maxPx));
    const y1 = Math.min(h - 1, Math.floor(ly + maxPx));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        // Distancia del punto al cuadrado del pixel [px, px+1) × [py, py+1).
        const dx = Math.max(px - lx, 0, lx - (px + 1));
        const dy = Math.max(py - ly, 0, ly - (py + 1));
        const dist = dx * dx + dy * dy;
        if (dist < bestD || (dist === bestD && best === null)) {
          if (frame.mask && !maskBit(frame.mask, w, px, py)) continue;
          best = item.uid;
          bestD = dist;
        }
      }
    }
  }
  return best;
}

/** Objeto bajo el punto `(ax, ay)` en px de arte del lienzo, o el más cercano a `nearestPx`; si no, `null`. */
export function hitTest(
  drawList: readonly DrawItem[],
  manifest: Pick<Manifest, 'frames'>,
  ax: number,
  ay: number,
  options: HitOptions = {},
): string | null {
  'worklet';
  for (let i = drawList.length - 1; i >= 0; i--) {
    const item = drawList[i];
    if (item.uid && hitsItem(item, manifest, ax, ay)) return item.uid;
  }
  return options.nearestPx ? nearest(drawList, manifest, ax, ay, options.nearestPx) : null;
}

/**
 * Para tocar varias veces en el mismo punto: el siguiente de los objetos que se pisan ahí después
 * de `current` (vuelve al primero). Si no hay ninguno exacto, se comporta como `hitTest`.
 */
export function cycleHit(
  drawList: readonly DrawItem[],
  manifest: Pick<Manifest, 'frames'>,
  ax: number,
  ay: number,
  current: string | null,
  options: HitOptions = {},
): string | null {
  'worklet';
  const all = hitCandidates(drawList, manifest, ax, ay);
  if (!all.length) return hitTest(drawList, manifest, ax, ay, options);
  const at = current === null ? -1 : all.indexOf(current);
  return all[(at + 1) % all.length];
}

/**
 * Análisis de 10 s de audio en el teléfono. El audio nunca sale del teléfono: de aquí solo salen
 * tres señales (voces, ruido constante, ruidos repentinos), que no permiten reconstruir lo dicho.
 * Son heurísticas sobre niveles relativos (el micrófono no está calibrado): no son mediciones de
 * decibeles ni de salud, y la persona confirma cada una. Sin dependencias, para poder probarlo aparte.
 */

export type AudioFindings = {
  voices: boolean;
  constant: boolean;
  sudden: boolean;
};

type Pcm = { samples: Float32Array; sampleRate: number };

/** Lee PCM lineal de un WAV (RIFF) o CAF; `null` si el formato no es uno de esos. */
export function decodePcm(bytes: Uint8Array): Pcm | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (bytes.length < 44) return null;
  if (tag(0) === 'RIFF' && tag(8) === 'WAVE') return decodeWav(bytes, view, tag);
  if (tag(0) === 'caff') return decodeCaf(bytes, view, tag);
  return null;
}

function decodeWav(bytes: Uint8Array, view: DataView, tag: (o: number) => string): Pcm | null {
  let offset = 12;
  let format: { channels: number; sampleRate: number; bits: number; float: boolean } | null = null;
  while (offset + 8 <= bytes.length) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      const audioFormat = view.getUint16(body, true);
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
        float: audioFormat === 3,
      };
    } else if (id === 'data' && format) {
      const end = Math.min(body + size, bytes.length);
      return toMono(view, body, end, format.channels, format.bits, format.float, true, format.sampleRate);
    }
    offset = body + size + (size % 2);
  }
  return null;
}

function decodeCaf(bytes: Uint8Array, view: DataView, tag: (o: number) => string): Pcm | null {
  let offset = 8;
  let format: { channels: number; sampleRate: number; bits: number; float: boolean; little: boolean } | null =
    null;
  while (offset + 12 <= bytes.length) {
    const id = tag(offset);
    // Los tamaños de bloque en CAF son de 64 bits big-endian; -1 en `data` significa "hasta el final".
    const high = view.getUint32(offset + 4, false);
    const low = view.getUint32(offset + 8, false);
    const size = high === 0xffffffff ? bytes.length - offset - 12 : high * 2 ** 32 + low;
    const body = offset + 12;
    if (id === 'desc') {
      const flags = view.getUint32(body + 12, false);
      format = {
        sampleRate: view.getFloat64(body, false),
        float: (flags & 1) === 1,
        little: (flags & 2) === 2,
        channels: view.getUint32(body + 28, false),
        bits: view.getUint32(body + 32, false),
      };
    } else if (id === 'data' && format) {
      const start = body + 4; // los primeros 4 bytes son el contador de ediciones
      const end = Math.min(body + size, bytes.length);
      return toMono(view, start, end, format.channels, format.bits, format.float, format.little, format.sampleRate);
    }
    offset = body + size;
  }
  return null;
}

function toMono(
  view: DataView,
  start: number,
  end: number,
  channels: number,
  bits: number,
  float: boolean,
  little: boolean,
  sampleRate: number,
): Pcm | null {
  const bytesPerSample = bits / 8;
  if (![16, 32].includes(bits) || channels < 1) return null;
  const frames = Math.floor((end - start) / (bytesPerSample * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const at = start + (i * channels + c) * bytesPerSample;
      if (float && bits === 32) sum += view.getFloat32(at, little);
      else if (bits === 16) sum += view.getInt16(at, little) / 32768;
      else sum += view.getInt32(at, little) / 2147483648;
    }
    samples[i] = sum / channels;
  }
  return { samples, sampleRate };
}

/** Umbrales heurísticos; se ajustan con grabaciones reales (ver ml/README.md). */
const LIMITS = {
  quietDb: -50,
  constantSpreadDb: 9,
  onsetDb: 14,
  aboveLoudDb: 6,
  minOnsets: 2,
  speechRatio: 0.55,
  syllabicShare: 0.4,
  activeShare: 0.2,
};

export function analyzeAudio({ samples, sampleRate }: Pcm): AudioFindings {
  const frameSize = 2 ** Math.round(Math.log2(sampleRate * 0.032));
  const frameCount = Math.floor(samples.length / frameSize);
  if (frameCount < 20) return { voices: false, constant: false, sudden: false };

  const levels = new Float32Array(frameCount);
  const speechRatio = new Float32Array(frameCount);
  const speechEnergy = new Float32Array(frameCount);
  const window = hann(frameSize);
  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);
  const binHz = sampleRate / frameSize;

  for (let f = 0; f < frameCount; f++) {
    let power = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = samples[f * frameSize + i];
      power += s * s;
      re[i] = s * window[i];
      im[i] = 0;
    }
    levels[f] = 10 * Math.log10(power / frameSize + 1e-12);
    fft(re, im);
    let total = 0;
    let speech = 0;
    for (let k = 1; k < frameSize / 2; k++) {
      const p = re[k] * re[k] + im[k] * im[k];
      const hz = k * binHz;
      total += p;
      if (hz >= 300 && hz <= 3400) speech += p;
    }
    speechRatio[f] = total > 0 ? speech / total : 0;
    speechEnergy[f] = 10 * Math.log10(speech + 1e-12);
  }

  const sorted = Array.from(levels).sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const floor = percentile(0.1);
  const median = percentile(0.5);
  const spread = percentile(0.9) - floor;
  const notQuiet = median > LIMITS.quietDb;

  // Ruidos repentinos: subidas bruscas sobre el nivel reciente, separadas al menos 300 ms y más
  // fuertes que casi todo lo demás. Así las sílabas de una conversación no cuentan como golpes.
  const gap = Math.ceil(0.3 / (frameSize / sampleRate));
  const loudest = percentile(0.9) + LIMITS.aboveLoudDb;
  let onsets = 0;
  let lastOnset = -gap;
  for (let f = 5; f < frameCount; f++) {
    let recent = 0;
    for (let j = f - 5; j < f; j++) recent += levels[j];
    recent /= 5;
    const jump = levels[f] - recent > LIMITS.onsetDb && levels[f] > floor + LIMITS.onsetDb;
    if (jump && levels[f] > loudest && f - lastOnset >= gap) {
      onsets++;
      lastOnset = f;
    }
  }

  // Voces: energía concentrada en la banda del habla y que sube y baja al ritmo de las sílabas (2–8 Hz).
  const active: number[] = [];
  for (let f = 0; f < frameCount; f++) if (levels[f] > floor + 6) active.push(f);
  const activeShare = active.length / frameCount;
  const meanRatio = active.reduce((sum, f) => sum + speechRatio[f], 0) / Math.max(active.length, 1);
  const syllabic = modulationShare(speechEnergy, sampleRate / frameSize, 2, 8, 0.5, 12);

  const voices =
    notQuiet &&
    activeShare > LIMITS.activeShare &&
    meanRatio > LIMITS.speechRatio &&
    syllabic > LIMITS.syllabicShare;
  return {
    voices,
    constant: notQuiet && spread < LIMITS.constantSpreadDb,
    sudden: onsets >= LIMITS.minOnsets,
  };
}

/** Parte de la energía de modulación de `envelope` que cae entre `lo` y `hi` Hz (sobre `minHz`–`maxHz`). */
function modulationShare(envelope: Float32Array, rate: number, lo: number, hi: number, minHz: number, maxHz: number) {
  const n = envelope.length;
  const mean = envelope.reduce((a, b) => a + b, 0) / n;
  let band = 0;
  let total = 0;
  for (let k = 1; k < n / 2; k++) {
    const hz = (k * rate) / n;
    if (hz < minHz || hz > maxHz) continue;
    let r = 0;
    let i = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      r += (envelope[t] - mean) * Math.cos(angle);
      i -= (envelope[t] - mean) * Math.sin(angle);
    }
    const p = r * r + i * i;
    total += p;
    if (hz >= lo && hz <= hi) band += p;
  }
  return total > 0 ? band / total : 0;
}

function hann(size: number) {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return w;
}

/** FFT radix-2 en el lugar; `re.length` debe ser potencia de 2. */
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const cos = Math.cos(angle * k);
        const sin = Math.sin(angle * k);
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cos - im[b] * sin;
        const ti = re[b] * sin + im[b] * cos;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { analyzeAudio, decodePcm } from '@/lib/audio-features';

import { privacyBlur } from '../../modules/privacy-blur';

/** Una posibilidad que la persona confirma: de la foto (con su punto) o del sonido. */
export type Finding = {
  key: string;
  source: 'photo' | 'audio';
  stimulus: string;
  question: string;
  x?: number;
  y?: number;
};

/** Las señales del audio, como preguntas para confirmar. */
export function audioFindings(hints: string[], questions: Record<string, string>): Finding[] {
  return hints.map((stimulus) => ({
    key: `audio-${stimulus}`,
    source: 'audio',
    stimulus,
    question: questions[stimulus] ?? stimulus,
  }));
}

export type PreparedPhoto = { uri: string; width: number; height: number; people: number };

/** Sin el módulo nativo de pixelado (Expo Go, Android) la foto no sale del teléfono. */
export const canAnalyzePhoto = privacyBlur !== null;

/** Analiza el audio grabado y lo borra en el acto: solo quedan los estímulos sugeridos. */
export async function analyzeRecording(uri: string): Promise<string[]> {
  const file = new File(uri);
  try {
    const pcm = decodePcm(await file.bytes());
    if (!pcm) return [];
    const found = analyzeAudio(pcm);
    return [
      found.voices ? 'voices' : null,
      found.constant ? 'noise_constant' : null,
      found.sudden ? 'noise_sudden' : null,
    ].filter((s): s is string => s !== null);
  } finally {
    remove(uri);
  }
}

/** Reduce la foto a 1024 px de ancho, pixela personas y borra las copias intermedias. */
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  if (!privacyBlur) throw new Error('El pixelado no está disponible en esta versión');
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: 1024, height: null }).renderAsync();
  const resized = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  remove(uri);
  try {
    const blurred = await privacyBlur.pixelatePeople(resized.uri);
    return { uri: blurred.uri, width: resized.width, height: resized.height, people: blurred.people };
  } finally {
    remove(resized.uri);
  }
}

export function photoBase64(uri: string) {
  return new File(uri).base64();
}

export function remove(uri?: string) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Si ya no existe, no hay nada que borrar.
  }
}

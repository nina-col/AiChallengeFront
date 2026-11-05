import { useLocale } from '@/i18n';
const es = {
  finishWelcome: 'Completar bienvenida', sessionRequired: 'Completa la bienvenida para guardar tus pruebas.',
  spaces: 'Espacios', home: '¿Qué necesitas ahora?', environment: 'Mi entorno', internal: 'Cómo estoy', unsure: 'No estoy seguro',
  pause: 'Tomar una pausa', summary: 'Tu resumen', spacesHint: 'Tus lugares y los ajustes que has probado en cada uno.',
  emptySpaces: 'Aún no tienes espacios', addSpace: 'Añadir espacio', spaceName: 'Nombre del espacio', openSpace: 'Ver espacio',
  roomHint: 'Los objetos representan cosas probadas, no éxitos. Consulta qué ayudó en el historial del espacio.',
  measures: 'Antes de empezar', discomfort: '¿Cuánto te molesta el entorno?', effort: '¿Cuánto esfuerzo te cuesta la actividad?',
  saved: 'Guardado', saving: 'Guardando…', savedHint: 'Tu información quedó guardada.',
  save: 'Guardar resultado', helpful: '¿Qué tanto te sirvió?', ratingHint: 'Elige un nivel. Puedes cambiarlo antes de guardar.',
  levels: ['Nada', 'Poco', 'Algo', 'Bastante', 'Mucho'], unknown: 'Todavía no lo sé',
  ratingStorageHint: 'La intensidad se guardará solo en este dispositivo.',
  personalRating: 'Tu última valoración', noRating: 'Sin valoración de intensidad', localRating: 'Valoración guardada en este dispositivo.',
  ratingFailed: 'El resultado se guardó, pero no pudimos guardar la intensidad en este dispositivo.',
  legacy: 'Registro anterior: se guardó si ayudó, sin escala de intensidad.',
};
const en: typeof es = {
  finishWelcome: 'Complete welcome', sessionRequired: 'Complete the welcome to save your trials.',
  spaces: 'Spaces', home: 'What do you need now?', environment: 'My surroundings', internal: 'How I feel', unsure: 'I’m not sure',
  pause: 'Take a break', summary: 'Your summary', spacesHint: 'Your places and the adjustments you have tried in each one.',
  emptySpaces: 'No spaces yet', addSpace: 'Add a space', spaceName: 'Space name', openSpace: 'Open space',
  roomHint: 'Objects represent things tried, not successes. Check what helped in the space’s history.',
  measures: 'Before you start', discomfort: 'How much do your surroundings bother you?', effort: 'How much effort does the activity take?',
  saved: 'Saved', saving: 'Saving…', savedHint: 'Your information has been saved.',
  save: 'Save result', helpful: 'How helpful was it?', ratingHint: 'Choose a level. You can change it before saving.',
  levels: ['Not at all', 'A little', 'Somewhat', 'Quite a bit', 'A lot'], unknown: 'I don’t know yet',
  ratingStorageHint: 'The intensity will be saved only on this device.',
  personalRating: 'Your latest rating', noRating: 'No intensity rating', localRating: 'Rating saved on this device.',
  ratingFailed: 'Your result was saved, but its intensity could not be saved on this device.',
  legacy: 'Earlier entry: helpfulness was recorded without an intensity scale.',
};
export function useUxCopy() { return useLocale() === 'es' ? es : en; }

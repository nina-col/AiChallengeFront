import type { IconName } from '@/components/pixel-icons';

/** Qué dibujo acompaña a cada cosa del catálogo. Sin dibujo, la opción sigue con su texto. */
export const DOMAIN_ART: Record<string, IconName> = {
  sound: 'sound',
  light: 'light',
  sight: 'sight',
  body: 'body',
  inner: 'mind',
};

export const TASK_ART: Record<string, IconName> = {
  reading: 'reading',
  writing: 'writing',
  focus: 'focus',
  data: 'data',
  calls: 'calls',
  meetings: 'meetings',
  creative: 'creative',
  routine: 'routine',
  other: 'other',
};

export const FEELING_ART: Record<string, IconName> = {
  focus: 'focus',
  drained: 'drained',
  discomfort: 'discomfort',
  overload: 'overload',
  other: 'other',
};

export const STIMULUS_ART: Record<string, IconName> = {
  voices: 'sound',
  noise_constant: 'sound',
  noise_sudden: 'sound',
  glare: 'light',
  light_bright: 'light',
  light_dim: 'light',
  light_flicker: 'light',
  visual_clutter: 'sight',
  movement: 'sight',
  interruptions: 'sight',
  crowding: 'meetings',
  on_camera: 'sight',
  too_warm: 'body',
  too_cold: 'body',
  smells: 'body',
  humidity: 'body',
  hard_to_start: 'start',
  too_many_tasks: 'organize',
  on_my_mind: 'onmind',
  plan_changed: 'changed',
  unclear_task: 'unclear',
};

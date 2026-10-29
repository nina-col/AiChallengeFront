import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, View } from 'react-native';

import { skyFor } from '@/components/desk/desk-scene';
import { buildDrawList, MONITOR } from '@/components/room/depth';
import { hitTest } from '@/components/room/hit';
import { artToCell, pickScale, roomArtSize } from '@/components/room/iso';
import { ATLAS, MANIFEST } from '@/components/room/manifest';
import { RoomCanvas } from '@/components/room/room-canvas';
import type { RoomLayout } from '@/components/room/types';
import { useTheme } from '@/hooks/use-theme';
import { useFeedback, useMotionLevel } from '@/lib/feedback';

/** Igual que la escena 2D: se mueve como mucho 5 s seguidos (WCAG 2.2.2), un elemento a la vez. */
const ALIVE_MS = 5000;
const TICK_MS = 300;
const SETTLE_FRAME_MS = 150;
/** Tocar varias veces seguidas no repite el sonido. */
const PIXEL_GAP_MS = 2000;
/** En qué cuadros de los 5 s se mueve cada cosa (el resto del tiempo, quietas). */
const TWITCHES: Record<number, string> = { 2: 'spin', 5: 'steam', 6: 'steam', 9: 'wave', 10: 'wave', 13: 'spin' };

type RoomViewProps = {
  layout: RoomLayout;
  /** La persiana y la pantalla tenue, si la persona las ganó. */
  modifiers: { blinds: boolean; dim: boolean };
  /** Objeto elegido (contorno punteado). */
  selected?: string | null;
  /** Tocar un objeto (o fuera de todos: `null`). */
  onSelect?: (uid: string | null) => void;
  /** Con un objeto elegido, tocar una casilla del piso: la persona quiere moverlo ahí. */
  onPressCell?: (cell: { x: number; y: number }) => void;
  /** Al aparecer, la onda del monitor se calma (el momento firma). */
  settle?: boolean;
  accessibilityLabel: string;
};

/**
 * Un cuarto isométrico listo para ver o editar. Calcula la escala entera según el ancho
 * disponible, el cielo según la hora y la animación según el nivel de movimiento:
 * reducido = quieto; tranquilo = solo la onda que se calma; con detalles, además, un objeto a la
 * vez (ventilador, vapor, castor) durante 5 s al aparecer o al tocarlo.
 */
export function RoomView({ layout, modifiers, selected, onSelect, onPressCell, settle, accessibilityLabel }: RoomViewProps) {
  const theme = useTheme();
  const level = useMotionLevel();
  const feedback = useFeedback();
  const [width, setWidth] = useState(0);
  const [sky] = useState(() => skyFor(new Date().getHours()));
  const [wave, setWave] = useState<number | null>(settle && level !== 'reduced' ? 0 : null);
  const [wakes, setWakes] = useState(settle ? 1 : 0);
  const [alive, setAlive] = useState(level === 'detailed');
  const [tick, setTick] = useState(0);
  const lastPixel = useRef(0);

  // La onda: ruidosa → media → tranquila (sin cuadro de animación = reposo).
  useEffect(() => {
    if (!wakes || level === 'reduced') return;
    const timers = [1, null].map((frame, i) => setTimeout(() => setWave(frame), SETTLE_FRAME_MS * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [wakes, level]);

  useEffect(() => {
    if (!alive || level !== 'detailed') return;
    const interval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    const stop = setTimeout(() => setAlive(false), ALIVE_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [alive, wakes, level]);

  useFocusEffect(useCallback(() => () => setAlive(false), []));

  const art = roomArtSize(MANIFEST, layout.size);
  const k = width ? pickScale(width, art.w, PixelRatio.get()) : 0;

  const twitch = alive && level === 'detailed' ? TWITCHES[tick % Math.round(ALIVE_MS / TICK_MS)] : undefined;
  const shownWave = level === 'reduced' ? null : wave;

  const drawList = useMemo(() => {
    const anim: Record<string, { name: string; frame: number }> = {};
    for (const item of layout.items) {
      if (item.type === MONITOR && shownWave !== null) anim[item.uid] = { name: 'wave', frame: shownWave };
      const names = MANIFEST.types[item.type]?.anim;
      if (twitch && names?.[twitch] && item.type !== MONITOR) anim[item.uid] = { name: twitch, frame: 1 };
    }
    return buildDrawList(layout, MANIFEST, { sky, owned: modifiers, anim });
  }, [layout, modifiers, sky, shownWave, twitch]);

  const outline = useMemo(() => {
    const item = selected ? drawList.find((d) => d.uid === selected) : undefined;
    const frame = item ? MANIFEST.frames[item.frame] : undefined;
    if (!item || !frame) return undefined;
    return { x: item.x, y: item.y, w: frame.rect[2], h: frame.rect[3], color: theme.primary };
  }, [selected, drawList, theme.primary]);

  function press(ax: number, ay: number) {
    const uid = hitTest(drawList, MANIFEST, ax, ay, { nearestPx: 6 });
    if (uid) {
      onSelect?.(uid);
    } else if (selected && onPressCell) {
      const cell = artToCell(ax - art.ox, ay - art.oy, layout.size.w, layout.size.d);
      if (cell) onPressCell(cell);
      else onSelect?.(null);
    } else {
      onSelect?.(null);
    }
    if (!onPressCell) wake();
  }

  function wake() {
    const now = Date.now();
    if (now - lastPixel.current > PIXEL_GAP_MS) {
      lastPixel.current = now;
      feedback.cue('pixel');
    }
    if (level === 'reduced') return;
    setWave(0);
    setWakes((w) => w + 1);
    if (level === 'detailed') {
      setTick(0);
      setAlive(true);
    }
  }

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {k ? (
        <RoomCanvas
          drawList={drawList}
          manifest={MANIFEST}
          atlas={ATLAS}
          artSize={art}
          k={k}
          onPressArt={press}
          outline={outline}
          accessibilityLabel={accessibilityLabel}
        />
      ) : null}
    </View>
  );
}

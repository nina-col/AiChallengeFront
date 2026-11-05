import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ITEMS, LAYERS, SCENE, type ItemId, type Sky, type Wave } from '@/components/desk/layers';
import { Motion, Radius } from '@/constants/theme';
import { useFeedback, useMotionLevel } from '@/lib/feedback';

/** La escena se mueve como mucho 5 s seguidos (WCAG 2.2.2) y luego descansa hasta que la toquen. */
const ALIVE_MS = 5000;
const TICK_MS = 300;
/**
 * Qué se mueve en cada cuadro de esos 5 s: un solo elemento a la vez, con pausas largas entre
 * uno y otro. No hay oscilaciones continuas (las de ~0.2 Hz marean; guía de Apple).
 */
const TWITCHES: Record<number, 'sway' | 'steam' | 'fan'> = { 2: 'sway', 6: 'steam', 7: 'steam', 11: 'fan', 13: 'fan' };
/** Tocar varias veces seguidas no repite el sonido: uno cada 2 s como mucho. */
const PIXEL_GAP_MS = 2000;
const SETTLE: Wave[] = ['noisy', 'mid', 'calm'];
const SETTLE_FRAME_MS = 150;
/** Cuándo queda tranquila la onda: ahí suenan los sonidos y la vibración del momento. */
export const SETTLED_MS = SETTLE_FRAME_MS * (SETTLE.length - 1);

/** Objetos que se dibujan como capa propia (la persiana va bajo la pared y la pantalla tenue es una paleta). */
const LAYERED = (Object.keys(ITEMS) as ItemId[]).filter((id) => id !== 'blinds' && id !== 'screenDim');

function skyFor(hour: number): Sky {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

type DeskSceneProps = {
  items: ItemId[];
  /** Objeto recién ganado: aparece con su propia animación. */
  highlight?: ItemId;
  /** Al aparecer, la onda del monitor pasa de ruidosa a tranquila (el entorno que se calma). */
  settle?: boolean;
  /** Tocarla la "despierta": la onda se calma otra vez y, con detalles, la escena se mueve un rato. */
  interactive?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * "Tu escritorio" en pixel art (capas de docs/brand/draw_scene.py). El cielo sigue la hora del
 * teléfono. Con movimiento reducido todo queda quieto; en modo tranquilo solo se calma la onda;
 * con detalles, además, la planta se mece, sale vapor de la taza y el ventilador gira, uno a la
 * vez y con pausas.
 */
export function DeskScene({ items, highlight, settle, interactive, accessibilityLabel, style }: DeskSceneProps) {
  const level = useMotionLevel();
  const feedback = useFeedback();
  const [sky] = useState(() => skyFor(new Date().getHours()));
  const [width, setWidth] = useState(0);
  const [wave, setWave] = useState<Wave>(settle && level !== 'reduced' ? 'noisy' : 'calm');
  const [wakes, setWakes] = useState(settle ? 1 : 0);
  const [alive, setAlive] = useState(level === 'detailed');
  const [tick, setTick] = useState(0);
  const lastPixel = useRef(0);

  const owned = new Set<ItemId>([...items, ...(highlight ? [highlight] : [])]);
  const dim = owned.has('screenDim');

  // La onda pasa por sus tres cuadros cada vez que la escena "despierta".
  useEffect(() => {
    if (!wakes || level === 'reduced') return;
    const timers = SETTLE.slice(1).map((frame, index) =>
      setTimeout(() => setWave(frame), SETTLE_FRAME_MS * (index + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [wakes, level]);

  // Vida de la escena (solo con detalles): pocos cuadros, lentos, y se detiene sola.
  useEffect(() => {
    if (!alive || level !== 'detailed') return;
    const interval = setInterval(() => setTick((t) => t + 1), TICK_MS);
    const stop = setTimeout(() => setAlive(false), ALIVE_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [alive, wakes, level]);

  // Fuera de pantalla (otra pestaña, otra pantalla encima), la escena se queda quieta.
  useFocusEffect(useCallback(() => () => setAlive(false), []));

  function wake() {
    const now = Date.now();
    if (now - lastPixel.current > PIXEL_GAP_MS) {
      lastPixel.current = now;
      feedback.cue('pixel');
    }
    if (level === 'reduced') return;
    setWave('noisy');
    setWakes((w) => w + 1);
    if (level === 'detailed') {
      setTick(0);
      setAlive(true);
    }
  }

  // Si "Reducir movimiento" llega cuando la onda ya empezó, se muestra quieta y tranquila.
  const shownWave = level === 'reduced' ? 'calm' : wave;
  const moving = alive && level === 'detailed';
  const twitch = moving ? TWITCHES[tick % Math.round(ALIVE_MS / TICK_MS)] : undefined;
  const steamFrame = twitch === 'steam' ? 1 : 0;
  const fanFrame = twitch === 'fan' ? 1 : 0;
  const sway = twitch === 'sway';
  const unit = width / SCENE.width;

  const content = (
    <View
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.scene, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <Layer source={LAYERS.sky[sky]} />
      {owned.has('blinds') ? <ItemLayer id="blinds" highlight={highlight} unit={unit} /> : null}
      {SETTLE.map((frame) => (
        <Layer key={frame} source={LAYERS.screen[frame]} visible={shownWave === frame} />
      ))}
      {dim ? (
        <ItemLayer id="screenDim" highlight={highlight} unit={unit} still>
          {SETTLE.map((frame) => (
            <Layer key={frame} source={LAYERS.screenDim[frame]} visible={shownWave === frame} />
          ))}
        </ItemLayer>
      ) : null}
      <Layer source={LAYERS.base} />
      <Layer source={LAYERS.plant} visible={!sway} />
      <Layer source={LAYERS.plantSway} visible={sway} />
      {LAYERED.filter((id) => owned.has(id)).map((id) =>
        id === 'fan' ? (
          <ItemLayer key={id} id={id} highlight={highlight} unit={unit}>
            <Layer source={ITEMS.fan.source} visible={fanFrame === 0} />
            <Layer source={LAYERS.fanAlt} visible={fanFrame === 1} />
          </ItemLayer>
        ) : (
          <ItemLayer key={id} id={id} highlight={highlight} unit={unit} />
        ),
      )}
      {owned.has('mug') ? (
        <>
          <Layer source={LAYERS.steam[0]} visible={steamFrame === 0} />
          <Layer source={LAYERS.steam[1]} visible={steamFrame === 1} />
        </>
      ) : null}
    </View>
  );

  if (!interactive) return content;
  return (
    <Pressable onPress={wake} accessible={false}>
      {content}
    </Pressable>
  );
}

function Layer({ source, visible = true }: { source: number; visible?: boolean }) {
  return <Image source={source} style={[StyleSheet.absoluteFill, { opacity: visible ? 1 : 0 }]} contentFit="fill" />;
}

/**
 * Un objeto de la escena. Si es el recién ganado, aparece: con detalles "cae" dos pixeles y se
 * enciende a saltos; en modo tranquilo es un fundido corto; con movimiento reducido ya está ahí.
 */
function ItemLayer({
  id,
  highlight,
  unit,
  still,
  children,
}: {
  id: ItemId;
  highlight?: ItemId;
  unit: number;
  /** No se desplaza al aparecer (la pantalla tenue solo cambia de color). */
  still?: boolean;
  children?: ReactNode;
}) {
  const level = useMotionLevel();
  const isNew = id === highlight && level !== 'reduced';
  const progress = useSharedValue(isNew ? 0 : 1);

  useEffect(() => {
    if (!isNew) {
      progress.value = 1; // por si "Reducir movimiento" llegó después de montar
      return;
    }
    progress.value = withDelay(
      250,
      level === 'detailed'
        ? withTiming(1, { duration: 420, easing: Easing.steps(5) })
        : withTiming(1, { duration: 250, easing: Motion.easeOut }),
    );
  }, [isNew, level, progress]);

  const drop = level === 'detailed' && !still ? unit * 2 : 0;
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: -drop * (1 - progress.value) }],
  }));

  const source = ITEMS[id].source;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animated]} pointerEvents="none">
      {children ?? (source !== null ? <Layer source={source} /> : null)}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scene: {
    width: '100%',
    aspectRatio: SCENE.width / SCENE.height,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});

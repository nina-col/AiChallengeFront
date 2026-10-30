import { useImage } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, PixelRatio, StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  GestureStateManager,
  usePanGesture,
  type PanGestureActiveEvent,
  type PanGestureEvent,
} from 'react-native-gesture-handler';

import { skyFor } from '@/components/desk/desk-scene';
import { diffLayouts } from '@/components/room/anim';
import { buildDrawList, MONITOR, type DrawOptions } from '@/components/room/depth';
import { beginDrag, dragEnd, dragUpdate, type DragState, type DragUpdate } from '@/components/room/drag';
import { hitTest } from '@/components/room/hit';
import { artToCell, pickScale, roomArtSize, touchToArt } from '@/components/room/iso';
import { ATLAS, MANIFEST } from '@/components/room/manifest';
import {
  addMotion,
  ALIVE_MS,
  changeMotion,
  droppedUid,
  FIRST_TICK,
  firstTwitchTick,
  isMoving,
  mountMotion,
  stepMotion,
  stopMotion,
  TICK_MS,
  twitchCandidates,
  twitchSchedule,
  wakeMotion,
  type Motion,
} from '@/components/room/motion';
import type { Reason } from '@/components/room/occupancy';
import { sceneDrawList } from '@/components/room/overlay';
import { RoomCanvas } from '@/components/room/room-canvas';
import type { DrawItem, ItemPlace, RoomLayout } from '@/components/room/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { useFeedback, useMotionLevel, type MotionLevel } from '@/lib/feedback';

/** Tocar varias veces seguidas no repite el sonido. */
const PIXEL_GAP_MS = 2000;
/** Mantener presionado un objeto este tiempo lo levanta para arrastrarlo; antes, el dedo desplaza la pantalla. */
const LONG_PRESS_MS = 150;
/** Lo pequeño se elige aunque el dedo caiga a unos px de arte (tecnica.md §6.6). */
const NEAREST_PX = 6;
/** Si el teléfono se traba, el reloj de las animaciones no salta más que esto de un cuadro a otro. */
const MAX_STEP_MS = 100;

/** Por qué no se pudo soltar ahí: un motivo de `canPlace` o `surface` (lo que va encima de algo, lejos de todo mueble). */
export type DropProblem = Reason | 'surface';

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
  /** Objeto recién puesto en el cuarto (lo ganado al terminar una prueba): entra con su animación. */
  entering?: string | null;
  /** Al montar, el cuarto se arma con su animación de entrada (según el nivel de movimiento). */
  intro?: boolean;
  /** Modo de edición: casillas válidas del objeto elegido y arrastrar para mover. */
  editing?: boolean;
  /** Al soltar lo que se arrastró en un lugar válido. */
  onDrop?: (uid: string, place: ItemPlace) => void;
  /** Se soltó donde no se puede: el objeto ya volvió a su lugar; aquí llega el motivo para decirlo en texto. */
  onDropFail?: (uid: string, problem: DropProblem) => void;
  /**
   * La llegada terminó: la onda quedó tranquila y lo recién ganado tocó el piso (con `settle` o
   * `entering`, una vez). Ahí va el tono del resultado, nunca antes (DESIGN.md §5).
   */
  onSettled?: () => void;
  accessibilityLabel: string;
};

/** Lo último que se dibujó y las props: lo leen los gestos y el reloj, que corren fuera del render. */
type Live = {
  layout: RoomLayout;
  drawn: DrawItem[];
  level: MotionLevel;
  k: number;
  /** Lo mismo que tocar el lienzo, en px de arte. */
  press: (ax: number, ay: number) => void;
  onSelect?: (uid: string | null) => void;
  onDrop?: (uid: string, place: ItemPlace) => void;
  onDropFail?: (uid: string, problem: DropProblem) => void;
  onSettled?: () => void;
};

type Drag = { state: DragState; update: DragUpdate };

type DragHandlers = {
  begin: (event: PanGestureEvent) => void;
  activate: (event: PanGestureActiveEvent) => void;
  update: (event: PanGestureActiveEvent) => void;
  end: (event: PanGestureActiveEvent & { canceled: boolean }) => void;
  finalize: () => void;
};

/** Hasta dónde se puede correr el dedo y que siga contando como un toque (pt). */
const TAP_SLOP_PT = 10;

/**
 * Un cuarto isométrico listo para ver o editar. Calcula la escala entera según el ancho
 * disponible, el cielo según la hora y el movimiento según el nivel (DESIGN.md §5 y §12):
 * - reducido: quieto (lo recién ganado aparece con un fundido corto);
 * - tranquilo: fundidos y desplazamientos cortos, y la onda del monitor que se calma;
 * - con detalles: además, todo a saltos de pixel y, en reposo, un objeto a la vez (ventilador,
 *   vapor, castor, plantas) durante 5 s como mucho al aparecer o al tocarlo.
 * Los cambios del layout (mover, girar, guardar, sacar) se animan solos al llegar como props.
 * En edición, mantener presionado un objeto lo levanta para arrastrarlo: es un atajo (las flechas
 * y tocar la casilla destino hacen lo mismo) y con lector de pantalla se apaga.
 */
export function RoomView({
  layout,
  modifiers,
  selected,
  onSelect,
  onPressCell,
  settle,
  entering,
  intro,
  editing,
  onDrop,
  onDropFail,
  onSettled,
  accessibilityLabel,
}: RoomViewProps) {
  const t = useT();
  const level = useMotionLevel();
  const feedback = useFeedback();
  const image = useImage(ATLAS);
  const screenReader = useScreenReader();
  const [width, setWidth] = useState(0);
  const [sky] = useState(() => skyFor(new Date().getHours()));
  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const [wakes, setWakes] = useState(settle ? 1 : 0);
  const [alive, setAlive] = useState(level === 'detailed');
  const [tick, setTick] = useState(0);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Lo que se soltó arrastrando, hasta que el cambio de layout que provoca se anima (solo aterriza). */
  const [dropped, setDropped] = useState<{ uid: string; place: ItemPlace } | null>(null);
  const lastPixel = useRef(0);
  const live = useRef<Live | null>(null);

  /** La lista sin animar: para planear animaciones y saber qué puede moverse en reposo. */
  const plain = useMemo(() => buildDrawList(layout, MANIFEST, { sky, owned: modifiers }), [layout, sky, modifiers]);
  const [motion, setMotion] = useState(() => mountMotion(plain, level, { intro, entering, settle }));

  // Un layout nuevo se anima desde lo que se ve; si llega "Reducir movimiento", todo queda en reposo.
  const [seen, setSeen] = useState({ layout, level });
  if (seen.layout !== layout || seen.level !== level) {
    let next = level === 'reduced' ? stopMotion(motion) : motion;
    if (seen.layout !== layout) {
      const events = diffLayouts(seen.layout, layout);
      const before = buildDrawList(seen.layout, MANIFEST, { sky, owned: modifiers });
      next = changeMotion(next, events, before, plain, MANIFEST, level, { entering, dropped: droppedUid(events, dropped) });
      if (dropped) setDropped(null);
    }
    setSeen({ layout, level });
    if (next !== motion) setMotion(next);
  }

  // Fuera de pantalla (otra pantalla encima o la app en segundo plano) nada se mueve.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setAlive(false);
      };
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state !== 'background';
      setForeground(active);
      if (!active) setAlive(false);
    });
    return () => subscription.remove();
  }, []);
  const onScreen = focused && foreground;

  const art = roomArtSize(MANIFEST, layout.size);
  const k = width ? pickScale(width, art.w, PixelRatio.get()) : 0;
  const ready = !!image && k > 0;

  // El reloj de las animaciones: pide cuadros solo mientras algo se mueve y el cuarto se ve, y
  // vuelve a dibujar solo cuando cambia algo a la vista (`stepMotion` devuelve otro objeto).
  const motionRef = useRef<Motion>(motion);
  useLayoutEffect(() => {
    motionRef.current = motion;
  }, [motion]);
  const moving = isMoving(motion);
  /** Cambia de identidad cada vez que se planea algo: el reloj vuelve a empezar desde lo que se ve. */
  const anims = motion.anims;
  useEffect(() => {
    if (!moving || !ready || !onScreen) return;
    let shown = motionRef.current;
    let clock = shown.now;
    let last = performance.now();
    let frame = 0;
    const step = () => {
      const real = performance.now();
      clock += Math.min(real - last, MAX_STEP_MS);
      last = real;
      const next = stepMotion(shown, clock);
      if (next !== shown) {
        if (shown.cue !== null && next.cue === null) live.current?.onSettled?.();
        shown = next;
        setMotion(next);
      }
      if (isMoving(next)) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [anims, moving, ready, onScreen]);

  // Reposo con detalles: un objeto a la vez durante 5 s, nunca a la par de otra animación ni al arrastrar.
  useEffect(() => {
    if (!alive || level !== 'detailed' || !onScreen) return;
    const interval = setInterval(() => setTick((n) => n + 1), TICK_MS);
    const stop = setTimeout(() => setAlive(false), ALIVE_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [alive, wakes, level, onScreen]);
  // Al aparecer, el reposo empieza cuando termina la llegada; al tocar, tras la onda.
  const [arrival] = useState(() => ({ wakes, tick: firstTwitchTick(motion) }));
  const candidates = useMemo(() => twitchCandidates(plain, layout, MANIFEST), [plain, layout]);
  const schedule = useMemo(
    () => twitchSchedule(candidates, wakes, wakes === arrival.wakes ? arrival.tick : FIRST_TICK),
    [candidates, wakes, arrival],
  );
  const twitch = alive && level === 'detailed' && !moving && !drag ? schedule[tick] : undefined;

  const wave = motion.wave;
  const options = useMemo((): DrawOptions => {
    const anim: Record<string, { name: string; frame: number }> = {};
    if (wave !== null) for (const it of layout.items) if (it.type === MONITOR) anim[it.uid] = { name: 'wave', frame: wave };
    if (twitch) anim[twitch.uid] = { name: twitch.name, frame: 1 };
    return { sky, owned: modifiers, anim };
  }, [layout, sky, modifiers, wave, twitch]);

  const drawn = useMemo(
    () =>
      sceneDrawList(layout, MANIFEST, options, {
        level,
        anims: motion.anims,
        sample: motion.sample,
        now: motion.now,
        selected: editing ? selected : null,
        drag,
      }),
    [layout, options, level, motion, editing, selected, drag],
  );

  const outline = useMemo(() => {
    const item = selected && !drag ? drawn.find((d) => d.uid === selected) : undefined;
    const frame = item ? MANIFEST.frames[item.frame] : undefined;
    if (!item || !frame) return undefined;
    return { x: item.x, y: item.y, w: frame.rect[2], h: frame.rect[3] };
  }, [selected, drag, drawn]);

  // El arrastre (tecnica.md §6.2 y §9) corre en el hilo de JS. Solo vuelve a dibujar cuando el
  // fantasma cambia de lugar: `dragUpdate` devuelve el mismo objeto si no.
  const session = useRef<{ state: DragState; update: DragUpdate | null } | null>(null);
  const handlers = useMemo((): DragHandlers => {
    const at = (x: number, y: number, k: number) => touchToArt(x, y, k, PixelRatio.get());
    return {
      begin: (event) => {
        // Solo se levanta un objeto: si el dedo no cae en uno, el gesto se suelta y el toque o el
        // desplazamiento de la pantalla siguen como siempre.
        const current = live.current;
        session.current = null;
        if (current?.k) {
          const p = at(event.x, event.y, current.k);
          const uid = hitTest(current.drawn, MANIFEST, p.ax, p.ay, { nearestPx: NEAREST_PX });
          const state = uid ? beginDrag(current.layout, MANIFEST, uid, p) : null;
          if (state) session.current = { state, update: null };
        }
        if (session.current) return;
        try {
          GestureStateManager.fail(event.handlerTag);
        } catch {
          // Sin el enlace nativo de RNGH: el gesto sigue, pero sin objeto bajo el dedo no hace nada.
        }
      },
      activate: (event) => {
        const current = live.current;
        const s = session.current;
        if (!current || !s) return;
        const update = dragUpdate(s.state, current.layout, MANIFEST, at(event.x, event.y, current.k));
        session.current = { state: s.state, update };
        setDrag({ state: s.state, update });
        current.onSelect?.(s.state.uid);
      },
      update: (event) => {
        const current = live.current;
        const s = session.current;
        if (!current || !s?.update) return;
        const update = dragUpdate(s.state, current.layout, MANIFEST, at(event.x, event.y, current.k), s.update);
        if (update === s.update) return;
        session.current = { state: s.state, update };
        setDrag({ state: s.state, update });
      },
      end: (event) => {
        const current = live.current;
        const s = session.current;
        session.current = null;
        setDrag(null);
        if (current && !s && !event.canceled && Math.hypot(event.translationX, event.translationY) < TAP_SLOP_PT) {
          // Se activó sin objeto bajo el dedo (el `fail` llegó tarde): fue un toque lento, no se pierde.
          const p = at(event.x, event.y, current.k);
          current.press(p.ax, p.ay);
          return;
        }
        if (!current || !s?.update) return;
        const update = event.canceled ? null : s.update;
        const result = dragEnd(s.state, update, current.layout, MANIFEST, current.level, motionRef.current.now);
        if (result.ok) {
          setDropped({ uid: result.uid, place: result.place });
          current.onDrop?.(result.uid, result.place);
          return;
        }
        if (result.back.length) setMotion((m) => addMotion(m, result.back));
        if (result.reason) {
          current.onDropFail?.(result.uid, !s.update.place && result.reason === 'no-slot' ? 'surface' : result.reason);
        }
      },
      finalize: () => {
        session.current = null;
        setDrag(null);
      },
    };
  }, []);

  function press(ax: number, ay: number) {
    const uid = hitTest(drawn, MANIFEST, ax, ay, { nearestPx: NEAREST_PX });
    if (uid) {
      onSelect?.(uid);
    } else if (onPressCell && screenReader) {
      // Con lector de pantalla, activar la imagen "toca" su centro: eso no mueve ni suelta nada
      // (para eso están las acciones de la lista).
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
    setMotion(wakeMotion);
    setWakes((w) => w + 1);
    if (level === 'detailed') {
      setTick(0);
      setAlive(true);
    }
  }

  useLayoutEffect(() => {
    live.current = { layout, drawn, level, k, press, onSelect, onDrop, onDropFail, onSettled };
  });

  // En edición, una línea bajo el cuarto: cómo arrastrar y, mientras se arrastra, si se puede
  // soltar ahí o por qué no (en texto, nunca solo con color).
  const draggable = !!editing && !!onDrop;
  const status = !draggable || screenReader ? null : drag ? dragText(drag.update, t.room) : t.room.dragHint;

  const canvas = k ? (
    <RoomCanvas
      drawList={drawn}
      manifest={MANIFEST}
      image={image}
      artSize={art}
      k={k}
      opacity={motion.sample.room}
      onPressArt={press}
      outline={outline}
      accessibilityLabel={accessibilityLabel}
    />
  ) : null;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.view}>
      {canvas && draggable ? (
        <Draggable enabled={!screenReader} handlers={handlers}>
          {canvas}
        </Draggable>
      ) : (
        canvas
      )}
      {status ? (
        <ThemedText type="footnote" themeColor={drag && !drag.update.valid ? 'text' : 'textSecondary'} style={styles.status}>
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** Qué decir mientras se arrastra: que se puede soltar ahí, o por qué no. */
function dragText(update: DragUpdate, room: ReturnType<typeof useT>['room']) {
  if (update.valid) return room.dropHere;
  if (!update.place && update.reason === 'no-slot') return room.dropOnFurniture;
  return room.reasons[update.reason ?? 'not-placeable'];
}

/**
 * El gesto de arrastre (RNGH 3, `usePanGesture`): se activa tras mantener presionado
 * `LONG_PRESS_MS` sin mover el dedo, así no compite con el desplazamiento de la pantalla ni con
 * tocar. Corre en el hilo de JS (`runOnJS`, sin Reanimated). La configuración no cambia entre
 * renders: los manejadores leen lo último de una referencia.
 */
function Draggable({ enabled, handlers, children }: { enabled: boolean; handlers: DragHandlers; children: ReactNode }) {
  const config = useMemo(
    () => ({
      enabled,
      activateAfterLongPress: LONG_PRESS_MS,
      runOnJS: true,
      disableReanimated: true,
      onBegin: handlers.begin,
      onActivate: handlers.activate,
      onUpdate: handlers.update,
      onDeactivate: handlers.end,
      onFinalize: handlers.finalize,
    }),
    [enabled, handlers],
  );
  const pan = usePanGesture(config);
  return <GestureDetector gesture={pan}>{children}</GestureDetector>;
}

/** ¿Hay un lector de pantalla encendido? Con él no se arrastra: las acciones de la lista hacen lo mismo. */
function useScreenReader() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let current = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (current) setOn(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return on;
}

const styles = StyleSheet.create({
  view: {
    width: '100%',
    gap: Spacing.two,
  },
  status: {
    textAlign: 'center',
  },
});

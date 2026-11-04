import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState, Platform, Pressable, View } from 'react-native';

import { useT } from '@/i18n';
import { useMotionLevel } from '@/lib/feedback';
import { MASCOT_FRAME_MS, MASCOT_REST, mascotCell, mascotMotionReducer } from '@/lib/mascot-motion';
import { useSettings } from '@/lib/settings';

const poses = {
  welcome: { source: require('@/assets/mascot/pixel-welcome-sheet.png'), columns: 2 },
  coffee: { source: require('@/assets/mascot/pixel-coffee-sheet.png'), columns: 2 },
  notebook: { source: require('@/assets/mascot/pixel-notebook.png'), columns: 1 },
} as const;
type Pose = keyof typeof poses;
type Props = { pose: Pose; size?: number; interactive?: boolean };

/** Pixel-art companion. The original cartoon assets are kept as source references. */
export function BeaverMascot({ pose, size = 128, interactive = false }: Props) {
  const { settings } = useSettings();
  if (!settings.showMascot || settings.focusMode) return null;
  return <Sprite key={pose} pose={pose} size={size} interactive={interactive} />;
}

function Sprite({ pose, size = 128, interactive = false }: Props) {
  const t = useT();
  const level = useMotionLevel();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [loaded, setLoaded] = useState(false);
  const [state, dispatch] = useReducer(mascotMotionReducer, MASCOT_REST);
  const welcomed = useRef(false);
  const definition = poses[pose];
  const canPlay = level === 'detailed' && focused && active && loaded && definition.columns === 2;

  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
      if (next !== 'active') dispatch({ type: 'cancel' });
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!canPlay) { dispatch({ type: 'cancel' }); return; }
    if (state.startedAt === null) return;
    const timer = setInterval(() => dispatch({ type: 'tick', now: Date.now() }), MASCOT_FRAME_MS);
    return () => clearInterval(timer);
  }, [canPlay, state.startedAt]);

  useEffect(() => {
    if (pose !== 'welcome' || !canPlay || welcomed.current) return;
    welcomed.current = true;
    dispatch({ type: 'start', now: Date.now() });
  }, [pose, canPlay]);

  const frame = canPlay ? state.frame : 0;
  const { column, row } = mascotCell(frame);
  const sprite = (
    <View style={{ width: size, height: size, overflow: 'hidden' }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Image
        source={definition.source}
        style={{
          position: 'absolute', width: size * definition.columns, height: size * definition.columns,
          left: -column * size, top: -row * size,
          ...(Platform.OS === 'web' ? { imageRendering: 'pixelated' as const } : {}),
        }}
        contentFit="fill"
        allowDownscaling={false}
        onLoad={() => setLoaded(true)}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        transition={0}
      />
    </View>
  );
  if (!interactive || !canPlay) return sprite;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.mascot.animate}
      accessibilityHint={t.mascot.hint}
      accessibilityState={{ busy: state.startedAt !== null }}
      aria-busy={state.startedAt !== null}
      onPress={() => dispatch({ type: 'start', now: Date.now() })}
      style={({ pressed }) => ({ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
      {sprite}
    </Pressable>
  );
}

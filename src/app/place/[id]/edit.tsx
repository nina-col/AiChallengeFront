import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { QueryFeedback } from '@/components/query-feedback';
import { DIM_VARIANT } from '@/components/room/depth';
import { MANIFEST } from '@/components/room/manifest';
import { addItem, move, moveTo, rotate, store, type Dir, type Reason } from '@/components/room/occupancy';
import { autoPlaceWithHost } from '@/components/room/layout';
import { RoomView, type DropProblem } from '@/components/room/room-view';
import type { RoomItem, RoomLayout } from '@/components/room/types';
import { SegmentedChoice } from '@/components/segmented-choice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useLocale, useT } from '@/i18n';
import { ApiError } from '@/lib/api';
import { useFeedback } from '@/lib/feedback';
import { freshUid, useRoom, useSaveRoom } from '@/lib/room';

/** Direcciones en pantalla: el piso isométrico tiene dos ejes en diagonal. */
const FLOOR_DIRS: { dir: Dir; arrow: string }[] = [
  { dir: '-x', arrow: '↖' },
  { dir: '-y', arrow: '↗' },
  { dir: '+y', arrow: '↙' },
  { dir: '+x', arrow: '↘' },
];

/** En la pared: a lo largo de ella (en pantalla, en diagonal) y entre filas. */
function wallDirs(wall: 'left' | 'right'): { dir: Dir; arrow: string }[] {
  const along: { dir: Dir; arrow: string }[] =
    wall === 'right'
      ? [
          { dir: '-x', arrow: '↖' },
          { dir: '+x', arrow: '↘' },
        ]
      : [
          { dir: '-y', arrow: '↗' },
          { dir: '+y', arrow: '↙' },
        ];
  return [...along, { dir: 'up', arrow: '↑' }, { dir: 'down', arrow: '↓' }];
}

/** Las flechas de un objeto según dónde está (las mismas en pantalla y en VoiceOver). */
const dirsFor = (item: RoomItem) => (item.place.on === 'wall' ? wallDirs(item.place.wall) : FLOOR_DIRS);

/**
 * Decorar un cuarto. Todo se puede hacer sin arrastrar (WCAG 2.5.7): se elige un objeto tocándolo,
 * y se mueve con los botones o tocando la casilla destino; arrastrarlo es solo un atajo. Con
 * VoiceOver, cada fila de "En el cuarto" trae las mismas acciones (mover, girar, guardar). La app
 * nunca acomoda nada por su cuenta: solo lo que la persona hace aquí, y se guarda al tocar
 * "Guardar cambios".
 */
export default function EditRoom() {
  const t = useT();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const room = useRoom(id);
  const save = useSaveRoom(id);
  const feedback = useFeedback();
  const [history, setHistory] = useState<RoomLayout[]>([]);
  const [draft, setDraft] = useState<RoomLayout | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [problem, setProblem] = useState<DropProblem | 'full' | null>(null);

  const layout = draft ?? room.layout;
  const label = (type: string) => MANIFEST.types[type]?.label[locale] ?? type;
  const item = layout?.items.find((i) => i.uid === selected);
  const spec = item ? MANIFEST.types[item.type] : undefined;

  /** Aplica un cambio: si no se puede, dice por qué en texto (nunca solo con color). */
  function apply(change: { ok: true; layout: RoomLayout } | { ok: false; reason: Reason }, announce?: string) {
    if (!layout) return;
    if (!change.ok) {
      setProblem(change.reason);
      AccessibilityInfo.announceForAccessibility(t.room.reasons[change.reason]);
      return;
    }
    setProblem(null);
    setHistory((h) => [...h, layout]);
    setDraft(change.layout);
    if (announce) AccessibilityInfo.announceForAccessibility(announce);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setDraft(previous);
    setProblem(null);
  }

  function putFromInventory(type: string) {
    if (!layout) return;
    const next = autoPlaceWithHost(layout, MANIFEST, type, MANIFEST.types[type].variants[0], freshUid);
    if (!next) {
      setProblem('full');
      return;
    }
    const added = next.items[next.items.length - 1];
    apply({ ok: true, layout: next }, t.room.placed(label(type)));
    setSelected(added.uid);
  }

  function putAway(target = item) {
    if (!layout || !target) return;
    const result = store(layout, target.uid);
    apply({ ok: true, layout: result.layout }, t.room.stored(label(target.type)));
    setSelected(null);
  }

  /** Mover, girar y guardar desde una fila de "En el cuarto" (acciones de VoiceOver). */
  function rowActions(target: RoomItem) {
    const s = MANIFEST.types[target.type];
    return [
      { name: 'activate', label: t.room.choose },
      ...dirsFor(target).map(({ dir }) => ({ name: `move:${dir}`, label: t.room.moveHint[dir] })),
      ...(s && s.facings.length > 1 && target.place.on === 'floor' ? [{ name: 'rotate', label: t.room.rotate }] : []),
      { name: 'store', label: t.room.putAway },
    ];
  }

  /** Hace la acción con ese objeto (y lo elige) y anuncia el resultado o el motivo. */
  function rowAction(target: RoomItem, action: string) {
    if (!layout) return;
    setSelected(target.uid);
    setProblem(null);
    if (action === 'rotate') apply(rotate(layout, MANIFEST, target.uid), t.room.rotated);
    else if (action === 'store') putAway(target);
    else if (action.startsWith('move:')) apply(move(layout, MANIFEST, target.uid, action.slice('move:'.length) as Dir), t.room.moved);
  }

  function changeVariant(variant: string) {
    if (!layout || !item) return;
    const others = layout.items.filter((i) => i.uid !== item.uid);
    apply(addItem({ ...layout, items: others }, MANIFEST, { ...item, variant }));
  }

  async function saveAndClose() {
    if (!layout || !draft) {
      router.back();
      return;
    }
    save.mutate(
      { revision: room.revision, layout: draft },
      {
        onSuccess: () => {
          feedback.confirm();
          router.back();
        },
        // Otra pantalla guardó antes: se muestra lo guardado, para no pisarlo (`t.room.conflict` lo dice).
        onError: (error) => {
          if (!(error instanceof ApiError) || error.status !== 409) return;
          setDraft(null);
          setHistory([]);
          setSelected(null);
          setProblem(null);
        },
      },
    );
  }

  /** Salir sin guardar: si hay cambios, se pregunta primero. Es la única salida sin guardar de esta pantalla. */
  function cancel() {
    if (!draft) {
      router.back();
      return;
    }
    Alert.alert(t.room.discardTitle, t.room.discardBody, [
      { text: t.room.discardKeep, style: 'cancel' },
      { text: t.room.discardConfirm, style: 'destructive', onPress: () => router.back() },
    ]);
  }

  // Inventario: lo que la persona tiene y no está en el cuarto (sin siluetas de lo que le falta).
  const placed = new Set(layout?.items.map((i) => i.type));
  const inventory = room.owned.filter((type) => {
    const s = MANIFEST.types[type];
    return s && s.place.length > 0 && !s.modifies && !placed.has(type);
  });
  const variants = spec?.variants.filter((v) => v !== DIM_VARIANT) ?? [];
  const saveError =
    save.error instanceof ApiError && save.error.status === 409
      ? t.room.conflict
      : save.isError
        ? t.common.somethingFailed
        : null;

  return (
    <StepScreen
      title={t.room.decorateTitle}
      hint={t.room.decorateHint}
      footer={
        <>
          <Button title={t.room.save} loading={save.isPending} disabled={!draft} onPress={saveAndClose} />
          <View style={styles.row}>
            <Button variant="secondary" title={t.room.undo} disabled={!history.length} onPress={undo} style={styles.flex} />
            <Button variant="plain" title={t.settings.cancel} onPress={cancel} style={styles.flex} />
          </View>
        </>
      }>
      <QueryFeedback query={{ isPending: room.isPending, isError: room.isError, refetch: room.refetch }} />
      {layout ? (
        <>
          <RoomView
            layout={layout}
            modifiers={room.modifiers}
            selected={selected}
            onSelect={(uid) => {
              setSelected(uid);
              setProblem(null);
            }}
            onPressCell={(cell) => {
              // Lo que también va en el piso (aunque esté encima de algo) va a la casilla tocada, con
              // el mismo giro que marcan sus casillas válidas.
              if (!item || !spec?.place.includes('floor')) return;
              const rot = item.place.on === 'floor' ? item.place.rot : (spec.facings[0] ?? 0);
              apply(moveTo(layout, MANIFEST, item.uid, { on: 'floor', x: cell.x, y: cell.y, rot }), t.room.moved);
            }}
            editing
            onDrop={(uid, place) => {
              setSelected(uid);
              apply(moveTo(layout, MANIFEST, uid, place), t.room.moved);
            }}
            onDropFail={(_, reason) => setProblem(reason)}
            accessibilityLabel={t.room.label('', layout.items.map((i) => label(i.type)))}
          />

          {problem ? (
            <Notice
              text={
                problem === 'full' ? t.room.full : problem === 'surface' ? t.room.dropOnFurniture : t.room.reasons[problem]
              }
            />
          ) : null}
          {saveError ? <Notice text={saveError} /> : null}

          {item && spec ? (
            <Group title={label(item.type)}>
              <GroupRow first>
                <View style={styles.arrows}>
                  {dirsFor(item).map(({ dir, arrow }) => (
                    <Button
                      key={dir}
                      variant="secondary"
                      title={arrow}
                      accessibilityLabel={t.room.moveHint[dir]}
                      onPress={() => apply(move(layout, MANIFEST, item.uid, dir), t.room.moved)}
                      style={styles.arrow}
                    />
                  ))}
                </View>
                <View style={styles.row}>
                  {spec.facings.length > 1 && item.place.on === 'floor' ? (
                    <Button
                      variant="secondary"
                      title={t.room.rotate}
                      onPress={() => apply(rotate(layout, MANIFEST, item.uid), t.room.rotated)}
                      style={styles.flex}
                    />
                  ) : null}
                  <Button variant="secondary" title={t.room.putAway} onPress={() => putAway()} style={styles.flex} />
                </View>
                {variants.length > 1 ? (
                  <SegmentedChoice
                    label={t.room.variant}
                    options={variants.map((v) => ({ id: v, label: t.room.variants[v] ?? v }))}
                    selected={item.variant}
                    onSelect={changeVariant}
                  />
                ) : null}
              </GroupRow>
            </Group>
          ) : null}

          {/*
            Elegir sin tocar el dibujo: para VoiceOver y para quien prefiera una lista. Con VoiceOver
            cada fila es un elemento con acciones (mover en cada dirección, girar, guardar), igual que
            los botones de arriba; el resultado o el motivo se anuncia.
          */}
          <Group title={t.room.inRoomTitle}>
            {layout.items.map((placedItem, index) => (
              <GroupRow key={placedItem.uid} first={index === 0}>
                <View
                  style={styles.row}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={label(placedItem.type)}
                  accessibilityState={{ selected: placedItem.uid === selected }}
                  accessibilityActions={rowActions(placedItem)}
                  onAccessibilityAction={(event) => rowAction(placedItem, event.nativeEvent.actionName)}>
                  <ThemedText style={styles.flex}>{label(placedItem.type)}</ThemedText>
                  <Button
                    variant={placedItem.uid === selected ? 'secondary' : 'plain'}
                    title={placedItem.uid === selected ? t.room.chosen : t.room.choose}
                    accessibilityHint={label(placedItem.type)}
                    onPress={() => {
                      setSelected(placedItem.uid);
                      setProblem(null);
                    }}
                  />
                </View>
              </GroupRow>
            ))}
          </Group>

          {inventory.length ? (
            <Group title={t.room.inventoryTitle} footer={t.room.inventoryFooter}>
              {inventory.map((type, index) => (
                <GroupRow key={type} first={index === 0}>
                  <View style={styles.row}>
                    <ThemedText style={styles.flex}>{label(type)}</ThemedText>
                    <Button variant="plain" title={t.room.put} accessibilityHint={label(type)} onPress={() => putFromInventory(type)} />
                  </View>
                </GroupRow>
              ))}
            </Group>
          ) : null}

          <Group title={t.room.shellTitle}>
            <GroupRow first>
              <ThemedText type="footnote" themeColor="textSecondary">
                {t.room.floor}
              </ThemedText>
              <SegmentedChoice
                label={t.room.floor}
                options={MANIFEST.shell.floors.map((f) => ({ id: f, label: t.room.floors[f] ?? f }))}
                selected={layout.shell.floor}
                onSelect={(floor) => apply({ ok: true, layout: { ...layout, shell: { ...layout.shell, floor } } })}
              />
            </GroupRow>
            <GroupRow>
              <ThemedText type="footnote" themeColor="textSecondary">
                {t.room.wall}
              </ThemedText>
              <SegmentedChoice
                label={t.room.wall}
                options={MANIFEST.shell.walls.map((w) => ({ id: w, label: t.room.walls[w] ?? w }))}
                selected={layout.shell.wall}
                onSelect={(wall) => apply({ ok: true, layout: { ...layout, shell: { ...layout.shell, wall } } })}
              />
            </GroupRow>
          </Group>
        </>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  arrows: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  arrow: {
    flex: 1,
    paddingHorizontal: 0,
  },
});

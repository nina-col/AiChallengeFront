import { SaveNotice } from '@/components/save-notice';
import { useUxCopy } from '@/lib/ux-copy';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { QueryFeedback } from '@/components/query-feedback';
import { MANIFEST } from '@/components/room/manifest';
import { RoomView } from '@/components/room/room-view';
import { SegmentedChoice } from '@/components/segmented-choice';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLocale, useT } from '@/i18n';
import { api } from '@/lib/api';
import { keys, queryClient, useLabels, useMemory } from '@/lib/queries';
import { useRoom, useSaveRoom } from '@/lib/room';
import { useSettings } from '@/lib/settings';

/**
 * "Lo que sé de este lugar": su cuarto isométrico (si la persona lo quiere ver) y, siempre en
 * texto, lo que suele molestar aquí, lo que se probó (ayudara o no, con sus números reales) y lo
 * que no se puede hacer. Tocar un objeto del cuarto dice qué es y qué se sabe de él, igual para
 * lo que ayudó y lo que no. "Usarlo otra vez" abre un registro corto directo a ese ajuste. El
 * corcho lo llena solo la persona: la app nunca destaca nada por su cuenta.
 */
export default function Place() {
  const t = useT();
  const copy = useUxCopy();
  const theme = useTheme();
  const locale = useLocale();
  const labels = useLabels();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memory = useMemory(id);
  const room = useRoom(id);
  const saveRoom = useSaveRoom(id);
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const data = memory.data;
  const blocked = new Set((data?.blocked ?? []).map((a) => a.id));
  const pinned = room.layout?.pinned ?? [];
  // En modo concentración no hay escenas: solo el texto, que dice lo mismo.
  const showRoom = settings.placeView === 'room' && settings.showDesk && !settings.focusMode && !!room.layout && !room.needsUpdate;
  const typeLabel = (type: string) => MANIFEST.types[type]?.label[locale] ?? type;

  // Lo que se sabe del objeto elegido: sus ajustes probados aquí, con números reales.
  const selectedItem = room.layout?.items.find((item) => item.uid === selected);
  const selectedSpec = selectedItem ? MANIFEST.types[selectedItem.type] : undefined;
  const selectedTried = selectedSpec
    ? (data?.tried ?? []).filter((entry) => selectedSpec.adjustments?.includes(entry.adjustment.id))
    : [];

  function togglePin(adjustmentId: string) {
    if (!room.layout) return;
    const next = pinned.includes(adjustmentId) ? pinned.filter((p) => p !== adjustmentId) : [...pinned, adjustmentId];
    saveRoom.mutate({ revision: room.revision, layout: { ...room.layout, pinned: next } });
  }

  const reset = useMutation({
    mutationFn: () => api.resetSpace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.memory(id) });
      queryClient.invalidateQueries({ queryKey: keys.playbook });
    },
  });

  function confirmReset() {
    Alert.alert(t.place.changedConfirmTitle, t.place.changedConfirmBody, [
      { text: t.settings.cancel, style: 'cancel' },
      { text: t.place.changedConfirm, onPress: () => reset.mutate() },
    ]);
  }

  function repeatAdjustment(adjustment: string, stimulus: string | null) {
    router.push({ pathname: '/checkin/repeat', params: { adjustment, stimulus: stimulus ?? '', space: id } });
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      <SaveNotice />
      <QueryFeedback query={memory} />

      {data ? (
        <>
          <View style={styles.heading}>
            <ThemedText type="title" accessibilityRole="header">
              {data.space.name}
            </ThemedText>
            <ThemedText type="callout" themeColor="textSecondary">
              {data.trials ? t.place.counter(data.trials, data.known) : t.place.empty}
            </ThemedText>
          </View>

          {settings.focusMode ? null : (
            <SegmentedChoice
              label={t.room.viewLabel}
              options={[
                { id: 'room', label: t.room.viewRoom },
                { id: 'list', label: t.room.viewList },
              ]}
              selected={settings.placeView}
              onSelect={(view) => update({ placeView: view as 'room' | 'list', ...(view === 'room' ? { showDesk: true } : {}) })}
            />
          )}

          {showRoom && room.layout ? (
            <View style={styles.room}>
              <RoomView
                layout={room.layout}
                modifiers={room.modifiers}
                selected={selected}
                onSelect={setSelected}
                settle
                accessibilityLabel={t.room.label(
                  data.space.name,
                  room.layout.items.map((item) => typeLabel(item.type)),
                )}
              />
              {selectedItem ? (
                <Group>
                  <GroupRow first>
                    <ThemedText type="bodyStrong">{typeLabel(selectedItem.type)}</ThemedText>
                    {selectedTried.map((entry) => (
                      <ThemedText key={entry.adjustment.id} type="footnote" themeColor="textSecondary">
                        {t.room.itemEvidence(entry.adjustment.title, t.place.evidence(entry.helped, entry.trials))}
                      </ThemedText>
                    ))}
                    {selectedTried.length ? null : (
                      <ThemedText type="footnote" themeColor="textSecondary">
                        {selectedSpec?.decor || selectedSpec?.base ? t.room.decorItem : t.room.triedElsewhere}
                      </ThemedText>
                    )}
                  </GroupRow>
                </Group>
              ) : (
                <ThemedText type="footnote" themeColor="textSecondary" style={styles.center}>
                  {t.room.tapHint}
                </ThemedText>
              )}
              <Button
                variant="secondary"
                title={t.room.decorate}
                onPress={() => router.push({ pathname: '/place/[id]/edit', params: { id } })}
              />
            </View>
          ) : null}

          {pinned.length ? (
            <Group title={t.room.corkTitle} footer={t.room.corkFooter}>
              {pinned.map((adjustmentId, index) => (
                <GroupRow key={adjustmentId} first={index === 0}>
                  <ThemedText>
                    {data.tried.find((e) => e.adjustment.id === adjustmentId)?.adjustment.title ?? adjustmentId}
                  </ThemedText>
                </GroupRow>
              ))}
            </Group>
          ) : null}

          {data.stimuli.length ? (
            <Group title={t.place.stimuliTitle}>
              {data.stimuli.map((item, index) => (
                <GroupRow key={item.stimulus} first={index === 0}>
                  <View style={styles.row}>
                    <ThemedText style={styles.flex}>{item.label}</ThemedText>
                    <ThemedText type="footnote" themeColor="textSecondary">
                      {t.place.times(item.times)}
                    </ThemedText>
                  </View>
                </GroupRow>
              ))}
            </Group>
          ) : null}

          <ThemedText type="footnote" themeColor="textSecondary">{copy.roomHint}</ThemedText>
          {data.tried.length ? (
            <Group title={t.place.triedTitle} footer={t.place.triedFooter}>
              {data.tried.map((entry, index) => (
                <GroupRow key={entry.adjustment.id} first={index === 0}>
                  <ThemedText type="bodyStrong">{entry.adjustment.title}</ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {[
                      entry.stimulus ? t.playbook.forStimulus(labels.stimulus(entry.stimulus)) : null,
                      t.place.evidence(entry.helped, entry.trials),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                  {blocked.has(entry.adjustment.id) ? null : (
                    <Button
                      variant="secondary"
                      title={t.place.useAgain}
                      accessibilityHint={entry.adjustment.title}
                      onPress={() => repeatAdjustment(entry.adjustment.id, entry.stimulus)}
                    />
                  )}
                  {room.layout && !room.needsUpdate ? (
                    <Button
                      variant="plain"
                      title={pinned.includes(entry.adjustment.id) ? t.room.unpin : t.room.pin}
                      accessibilityHint={entry.adjustment.title}
                      disabled={saveRoom.isPending}
                      style={styles.inline}
                      onPress={() => togglePin(entry.adjustment.id)}
                    />
                  ) : null}
                </GroupRow>
              ))}
            </Group>
          ) : null}

          {data.blocked.length ? (
            <Group title={t.place.blockedTitle}>
              {data.blocked.map((adjustment, index) => (
                <GroupRow key={adjustment.id} first={index === 0}>
                  <ThemedText>{adjustment.title}</ThemedText>
                </GroupRow>
              ))}
            </Group>
          ) : null}

          <Group title={t.place.changedTitle}>
            <GroupRow first>
              <ThemedText type="callout">{t.place.changedBody}</ThemedText>
              {data.space.reset_at ? (
                <ThemedText type="footnote" themeColor="textSecondary">
                  {t.place.changedOn(new Date(data.space.reset_at).toLocaleDateString(locale))}
                </ThemedText>
              ) : null}
              <Button
                variant="plain"
                title={t.place.changed}
                loading={reset.isPending}
                style={styles.inline}
                onPress={confirmReset}
              />
            </GroupRow>
          </Group>
          {reset.isError || saveRoom.isError ? <Notice text={t.common.somethingFailed} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  heading: {
    gap: Spacing.two,
  },
  room: {
    gap: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  inline: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    minHeight: 44,
  },
});

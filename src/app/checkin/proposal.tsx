import { useMutation } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { contentEntering } from '@/lib/animations';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { ITEM_FOR_ADJUSTMENT } from '@/lib/desk';
import { useMotionLevel } from '@/lib/feedback';
import { useLabels } from '@/lib/queries';
import type { Proposal } from '@/lib/types';

export default function ProposalScreen() {
  const t = useT();
  const theme = useTheme();
  const labels = useLabels();
  const level = useMotionLevel();
  const { draft, update } = useCheckinDraft();
  const result = draft.result;
  const proposal = result?.proposal;

  const decline = useMutation({
    mutationFn: (reason: 'other_idea' | 'cannot_here') => api.decline(result!.checkin.id, reason),
    onSuccess: (next) => update({ result: next }),
  });

  if (!result) return null;

  if (!proposal) {
    const nothingClear = !result.checkin.focus_stimulus;
    return (
      <StepScreen
        title={nothingClear ? t.proposal.noneTitle : t.proposal.exhaustedTitle}
        hint={nothingClear ? t.proposal.noneBody : t.proposal.exhaustedBody}
        footer={<Button title={t.common.backToToday} onPress={() => router.dismissTo('/today')} />}
      />
    );
  }

  const { adjustment } = proposal;
  const kindLabel = {
    self: t.proposal.selfKind,
    ask: t.proposal.askKind,
    baseline: t.proposal.baselineKind,
  }[adjustment.kind];
  const kindIcon = { self: 'hand.raised', ask: 'envelope', baseline: 'equal.circle' }[adjustment.kind];

  function prepareRequest() {
    api.abandon(result!.checkin.id).catch(() => {});
    router.dismissTo('/today');
    router.push({
      pathname: '/request',
      params: {
        adjustment: adjustment.id,
        task: result!.checkin.task,
        stimulus: result!.checkin.focus_stimulus ?? '',
        place: result!.checkin.space?.name ?? '',
        feeling: result!.checkin.feeling,
      },
    });
  }

  const footer = (
    <>
      {adjustment.kind === 'ask' ? (
        <Button title={t.proposal.prepareRequest} onPress={prepareRequest} />
      ) : (
        <Button
          title={adjustment.kind === 'baseline' ? t.proposal.baselineAccept : t.proposal.accept}
          onPress={() => router.push('/checkin/reminder')}
        />
      )}
      <Button
        variant="secondary"
        title={adjustment.kind === 'baseline' ? t.proposal.baselineDecline : t.proposal.otherIdea}
        loading={decline.isPending && decline.variables === 'other_idea'}
        onPress={() => decline.mutate('other_idea')}
      />
      {adjustment.kind === 'self' ? (
        <Button
          variant="plain"
          title={t.proposal.cannotHere}
          loading={decline.isPending && decline.variables === 'cannot_here'}
          onPress={() => decline.mutate('cannot_here')}
        />
      ) : null}
    </>
  );

  return (
    <StepScreen title={adjustment.title} footer={footer}>
      {/* Fundido breve al cambiar de sugerencia: muestra que es otra idea. Sin movimiento si se pidió. */}
      <Animated.View
        key={adjustment.id}
        entering={contentEntering(level)}
        style={styles.body}>
        <View style={[styles.kind, { backgroundColor: theme.backgroundSelected }]}>
          <SymbolView name={kindIcon as never} size={18} tintColor={theme.primary} accessibilityElementsHidden />
          <ThemedText type="footnote">{kindLabel}</ThemedText>
        </View>
        <ThemedText>{adjustment.steps}</ThemedText>
        <View style={styles.why}>
          <ThemedText type="footnote" themeColor="textSecondary">
            {t.proposal.whyLabel}
          </ThemedText>
          <ThemedText type="callout">{adjustment.why}</ThemedText>
        </View>
        <ThemedText type="footnote" themeColor="textSecondary">
          {reasonText(proposal, t, labels.stimulus(result.checkin.focus_stimulus ?? ''))}
        </ThemedText>
        {adjustment.kind === 'self' && ITEM_FOR_ADJUSTMENT[adjustment.id] ? (
          <View style={styles.desk}>
            <SymbolView name="sparkles" size={14} tintColor={theme.accent} accessibilityElementsHidden />
            <ThemedText type="footnote" themeColor="textSecondary">
              {t.desk.afterTrial}
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>
      {decline.isError ? <Notice text={t.common.somethingFailed} /> : null}
    </StepScreen>
  );
}

function reasonText(proposal: Proposal, t: ReturnType<typeof useT>, stimulus: string) {
  const reason = proposal.reason;
  switch (reason.kind) {
    case 'first_try':
      return t.proposal.firstTry(stimulus);
    case 'exploring':
      return t.proposal.exploring;
    case 'comparison':
      return t.proposal.comparison;
    case 'tried_here':
      return t.proposal.triedHere(reason.helped, reason.trials);
    case 'tried_elsewhere':
      return t.proposal.triedElsewhere(reason.helped, reason.trials);
  }
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  kind: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.lg,
  },
  why: {
    gap: Spacing.one,
  },
  desk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

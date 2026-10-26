import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { StepScreen } from '@/components/step-screen';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { useCheckinDraft } from '@/lib/checkin-draft';
import { useCheckinSteps } from '@/lib/checkin-steps';
import { keys, queryClient, useSpaces } from '@/lib/queries';

export default function Place() {
  const t = useT();
  const spaces = useSpaces();
  const steps = useCheckinSteps();
  const { draft, update } = useCheckinDraft();
  const [name, setName] = useState('');

  const choose = (spaceId: string) => {
    update({ spaceId });
    steps.goAfter('place');
  };

  const add = useMutation({
    mutationFn: () => api.createSpace(name.trim(), 'other'),
    onSuccess: (space) => {
      queryClient.setQueryData(keys.spaces, [...(spaces.data ?? []), space]);
      choose(space.id);
    },
  });

  return (
    <StepScreen step={t.checkin.step(steps.number('place'), steps.total)} title={t.checkin.placeTitle}>
      {spaces.data?.length ? (
        <ChoiceList
          options={spaces.data.map((s) => ({ id: s.id, label: s.name }))}
          selected={draft.spaceId ? [draft.spaceId] : []}
          onSelect={choose}
        />
      ) : null}
      <View style={{ gap: Spacing.two }}>
        <TextField
          label={t.checkin.newPlacePlaceholder}
          placeholder={t.checkin.newPlacePlaceholder}
          value={name}
          onChangeText={setName}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => name.trim() && add.mutate()}
        />
        <Button
          variant="secondary"
          title={t.checkin.addPlace}
          disabled={!name.trim()}
          loading={add.isPending}
          onPress={() => add.mutate()}
        />
      </View>
      {add.isError ? <Notice text={t.common.offline} /> : null}
    </StepScreen>
  );
}

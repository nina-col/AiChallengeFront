import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button } from '@/components/button';
import { Group, GroupRow } from '@/components/group';
import { Notice } from '@/components/notice';
import { QueryFeedback } from '@/components/query-feedback';
import { SaveFeedback } from '@/components/save-feedback';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import { keys, queryClient, useSpaces } from '@/lib/queries';
import { useUxCopy } from '@/lib/ux-copy';

export default function Spaces() {
  const copy = useUxCopy();
  const t = useT();
  const theme = useTheme();
  const spaces = useSpaces();
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => api.createSpace(name.trim(), 'other'),
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: keys.spaces });
    },
  });

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={{ padding: 24, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 48 }}>
      <ThemedText themeColor="textSecondary">{copy.spacesHint}</ThemedText>
      <QueryFeedback query={spaces} />
      {spaces.isSuccess && !spaces.data.length ? <ThemedText type="headline">{copy.emptySpaces}</ThemedText> : null}
      {spaces.data?.map(space => (
        <Group key={space.id} title={space.name}>
          <GroupRow first>
            <ThemedText type="footnote">{copy.roomHint}</ThemedText>
            <Button title={copy.openSpace} variant="secondary" onPress={() => router.push({ pathname: '/place/[id]', params: { id: space.id } })} />
          </GroupRow>
        </Group>
      ))}
      <Group title={copy.addSpace}>
        <GroupRow first>
          <TextField label={copy.spaceName} maxLength={60} value={name} onChangeText={value => { setName(value); create.reset(); }} editable={!create.isPending} />
          <Button title={copy.addSpace} disabled={!name.trim()} loading={create.isPending} onPress={() => create.mutate()} />
        </GroupRow>
      </Group>
      {create.isPending || create.isSuccess ? <SaveFeedback pending={create.isPending} /> : null}
      {create.isError ? <Notice text={t.common.somethingFailed} /> : null}
    </ScrollView>
  );
}

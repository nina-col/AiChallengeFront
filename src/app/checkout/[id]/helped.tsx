import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/button';
import { RatingScale } from '@/components/rating-scale';
import { ChoiceList } from '@/components/choice-list';
import { Notice } from '@/components/notice';
import { SaveFeedback } from '@/components/save-feedback';
import { StepScreen } from '@/components/step-screen';
import { ThemedText } from '@/components/themed-text';
import { useT } from '@/i18n';
import { useSaveOutcome } from '@/lib/checkout';
import { ratingAttribution } from '@/lib/helpfulness';
import { useUxCopy } from '@/lib/ux-copy';
export default function CheckoutHelped() {
 const t=useT(); const copy=useUxCopy(); const [score,setScore]=useState<number|null>();
 const {id,discomfort,effort}=useLocalSearchParams<{id:string;discomfort:string;effort:string}>();const save=useSaveOutcome(id);
 return <StepScreen title={copy.helpful} hint={copy.ratingHint} footer={<Button title={copy.save} disabled={score===undefined} loading={save.isPending} onPress={()=>score!==undefined && save.mutate({discomfort:Number(discomfort),effort:Number(effort),attribution:ratingAttribution(score),score})}/>}>
  <RatingScale labels={copy.levels} value={score ?? undefined} onChange={setScore} disabled={save.isPending} />
  <ChoiceList options={[{id:"unknown",label:copy.unknown}]} selected={score===null?["unknown"]:[]} disabled={save.isPending} onSelect={()=>setScore(null)} />
  <ThemedText type="footnote" themeColor="textSecondary">{copy.ratingStorageHint}</ThemedText>
  {save.isPending?<SaveFeedback pending/>:null}
  {save.isError?<Notice text={t.common.somethingFailed}/>:null}
 </StepScreen>;
}

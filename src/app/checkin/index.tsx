import { CheckinActions } from '@/components/checkin-actions';
import { StepScreen } from '@/components/step-screen';
import { useUxCopy } from '@/lib/ux-copy';
export default function CheckinEntry() {
 return <StepScreen title={useUxCopy().home}><CheckinActions /></StepScreen>;
}

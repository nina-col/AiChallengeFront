import { SaveFeedback } from '@/components/save-feedback';
import { useSaveNotice } from '@/lib/save-notice';

export function SaveNotice() {
  return useSaveNotice() ? <SaveFeedback /> : null;
}

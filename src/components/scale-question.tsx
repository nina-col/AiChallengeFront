import { RatingScale } from '@/components/rating-scale';
import { useT } from '@/i18n';

/** Five labeled levels with large targets, no preselected answer. */
export function ScaleQuestion({ value, onChange, disabled = false }: { value?: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <RatingScale value={value} onChange={onChange} labels={useT().common.scale} disabled={disabled} />;
}

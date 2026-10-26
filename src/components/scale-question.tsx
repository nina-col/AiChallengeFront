import { ChoiceList } from '@/components/choice-list';
import { useT } from '@/i18n';

/**
 * Escala de 5 puntos con una palabra en cada punto y botones, no deslizador
 * (los deslizadores se dejan sin contestar más seguido). Medida propia, no clínica.
 */
export function ScaleQuestion({ value, onChange }: { value?: number; onChange: (value: number) => void }) {
  const t = useT();
  const options = t.common.scale.map((label, index) => ({ id: String(index + 1), label: `${index + 1} · ${label}` }));
  return (
    <ChoiceList
      options={options}
      selected={value ? [String(value)] : []}
      onSelect={(id) => onChange(Number(id))}
    />
  );
}

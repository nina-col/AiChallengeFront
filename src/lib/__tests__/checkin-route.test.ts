import { checkinOrder, INNER_DOMAIN, INNER_STIMULI, innerOrder, isInner } from '@/lib/checkin-route';
import { toNewCheckin, type Draft } from '@/lib/checkin-draft';

jest.mock('@/lib/scan', () => ({ remove: jest.fn() }));

describe('lo cognitivo', () => {
  it('no pasa por el escaneo ni por la molestia del entorno', () => {
    expect(innerOrder(false)).toEqual(['task', 'effort', INNER_DOMAIN]);
    expect(innerOrder(true)).toEqual(['task', 'effort', 'place', INNER_DOMAIN]);
    expect(checkinOrder(false, ['sound'])).toContain('discomfort');
  });

  it('solo reconoce sus categorías', () => {
    for (const id of INNER_STIMULI) expect(isInner(id)).toBe(true);
    expect([isInner('voices'), isInner(null), isInner(undefined)]).toEqual([false, false, false]);
  });

  it('el esfuerzo hace de medida, y al servidor solo llegan categorías', () => {
    const draft: Draft = { route: 'inner', task: 'writing', feeling: 'focus', effort: 4, answers: { hard_to_start: 'yes' }, sources: {} };
    const sent = toNewCheckin(draft, 'hard_to_start');
    expect(sent).toMatchObject({ discomfort_before: 4, effort_before: 4, focus_stimulus: 'hard_to_start' });
    expect(sent.observations).toEqual([{ stimulus: 'hard_to_start', response: 'yes', source: 'question' }]);
  });
});

describe('recorrido sensorial agrupado', () => {
  it('mantiene todas las áreas elegidas y elimina pantallas duplicadas', () => {
    expect(checkinOrder(false, ['light'])).toEqual(['task', 'discomfort', 'scan', 'light']);
    expect(checkinOrder(true, ['sound', 'body'])).toEqual(['task', 'place', 'discomfort', 'scan', 'sound', 'body']);
  });
});

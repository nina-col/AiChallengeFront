import { deskItems } from '@/lib/desk';

describe('deskItems', () => {
  it('da un objeto por tema probado, sin repetir y en orden de la escena', () => {
    expect(deskItems(['earplugs', 'noise_cancelling', 'desk_lamp'])).toEqual(['lamp', 'headphones']);
  });

  it('ignora ajustes sin objeto y listas vacías', () => {
    expect(deskItems(['no_change'])).toEqual([]);
    expect(deskItems(undefined)).toEqual([]);
  });
});

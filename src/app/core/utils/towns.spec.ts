import { inTown, townsOf } from './towns';

describe('towns', () => {
  const locations = [
    'Allée des Douaniers, Dinard',
    'Casino de Dinard',
    'Basilique Saint-Sauveur, Dinan',
    'Dinan, 22100, Dinan',
    'Départ gare de Saint-Malo',
    'Digue du Sillon, Saint-Malo',
    'Combourg',
  ];

  it('regroupe les adresses par ville', () => {
    expect(townsOf(locations)).toEqual([
      { name: 'Combourg', count: 1 },
      { name: 'Dinan', count: 2 },
      { name: 'Dinard', count: 2 },
      { name: 'Saint-Malo', count: 2 },
    ]);
  });

  it('ne confond pas Dinan et Dinard', () => {
    expect(inTown('Casino de Dinard', 'Dinan')).toBe(false);
    expect(inTown('Casino de Dinard', 'Dinard')).toBe(true);
    expect(inTown('Départ de saint malo', 'Saint-Malo')).toBe(true);
  });
});

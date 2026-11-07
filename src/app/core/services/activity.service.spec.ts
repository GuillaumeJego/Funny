import { normalizePage } from './activity.service';

describe('normalizePage', () => {
  it('retire les identifiants et les paramètres', () => {
    expect(normalizePage('/membres/6a8f12bc34de56f7?tab=amis')).toBe('/membres/:id');
    expect(normalizePage('/sorties/69f0a1b2c3d4e5f6/modifier')).toBe('/sorties/:id/modifier');
    expect(normalizePage('/dashboard?sortie=abc')).toBe('/dashboard');
    expect(normalizePage('/mes-sorties')).toBe('/mes-sorties');
  });
});

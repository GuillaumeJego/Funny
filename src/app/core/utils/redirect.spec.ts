import { safeRedirect } from './redirect';

describe('safeRedirect', () => {
  it('garde une page de Funny, avec ses paramètres', () => {
    expect(safeRedirect('/dashboard?sortie=s1')).toBe('/dashboard?sortie=s1');
  });

  it('refuse un autre site ou une adresse bizarre', () => {
    for (const bad of ['https://pirate.com', '//pirate.com', '/\\pirate.com', 'dashboard', '']) {
      expect(safeRedirect(bad)).toBeNull();
    }
  });

  it('ignore la page de connexion elle-même', () => {
    expect(safeRedirect('/login?redirect=x')).toBeNull();
    expect(safeRedirect(null)).toBeNull();
  });
});

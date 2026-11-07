import { distanceKm } from './distance';

describe('distanceKm', () => {
  it('donne environ 23 km entre Saint-Malo et Dinan', () => {
    const saintMalo = { lat: 48.6493, lng: -2.0257 };
    const dinan = { lat: 48.4545, lng: -2.0465 };
    expect(distanceKm(saintMalo, dinan)).toBeGreaterThan(20);
    expect(distanceKm(saintMalo, dinan)).toBeLessThan(25);
  });

  it('vaut zéro pour un même point', () => {
    expect(distanceKm({ lat: 48.6, lng: -2 }, { lat: 48.6, lng: -2 })).toBe(0);
  });
});

/** Texte simplifié pour comparer des noms de lieux : minuscules, sans accents ni ponctuation. */
function simplify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** L'adresse d'une sortie est-elle dans cette ville ? (« Casino de Dinard » → Dinard, pas Dinan) */
export function inTown(location: string | null | undefined, town: string): boolean {
  if (!location) return false;
  return ` ${simplify(location)} `.includes(` ${simplify(town)} `);
}

/**
 * Les villes des adresses : la dernière partie après une virgule (« Digue du Sillon, Saint-Malo »
 * → Saint-Malo). Une adresse sans virgule est rangée dans une ville connue qu'elle cite, sinon
 * elle compte comme ville. Chaque ville vient avec le nombre d'adresses qu'elle regroupe.
 */
export function townsOf(locations: string[]): { name: string; count: number }[] {
  const names = new Map<string, string>();
  const add = (name: string) => {
    const key = simplify(name);
    if (key && !names.has(key)) names.set(key, name);
  };
  const parts = (location: string) =>
    location
      .split(',')
      .map((p) => p.trim().replace(/^\d{5}\s*/, ''))
      .filter((p) => p && !/^\d+$/.test(p));

  for (const location of locations) {
    const p = parts(location);
    if (p.length > 1) add(p[p.length - 1]);
  }
  for (const location of locations) {
    const p = parts(location);
    if (p.length === 1 && ![...names.values()].some((t) => inTown(location, t))) add(p[0]);
  }
  return [...names.values()]
    .map((name) => ({ name, count: locations.filter((l) => inTown(l, name)).length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

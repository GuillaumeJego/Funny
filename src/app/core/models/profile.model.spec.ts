import { isNewMember } from './profile.model';

describe('isNewMember', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

  it('est nouveau pendant 2 semaines', () => {
    expect(isNewMember(daysAgo(13), now)).toBe(true);
  });

  it("n'est plus nouveau après 2 semaines", () => {
    expect(isNewMember(daysAgo(15), now)).toBe(false);
  });

  it('sans date, pas nouveau', () => {
    expect(isNewMember(undefined, now)).toBe(false);
  });
});

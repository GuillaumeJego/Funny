import { describe, expect, it } from 'vitest';
import { EVIDENCE_MESSAGES, collectEvidence } from '../shared/moderation.js';
import { createFakeApi } from './fake-api.js';

function api(count = 3) {
  const messages = Array.from({ length: count }, (_, i) => ({
    $id: `m${i}`,
    $createdAt: `2026-11-07T10:${String(i).padStart(2, '0')}:00.000Z`,
    conversation_id: 'conv',
    sender_id: i % 2 ? 'a' : 'b',
    content: `message ${i}`,
    type: 'text',
  }));
  messages.push({ ...messages[0], $id: 'autre', conversation_id: 'ailleurs' });
  return createFakeApi({ conversations: [{ $id: 'conv' }], messages }, { conv: ['a', 'b'] });
}

describe('collectEvidence', () => {
  it('joint les derniers messages de la conversation, dans l’ordre', async () => {
    const evidence = await collectEvidence(api(), 'conv', 'a');
    expect(evidence.map((m) => m.id)).toEqual(['m0', 'm1', 'm2']);
    expect(evidence[1]).toMatchObject({ sender_id: 'a', content: 'message 1' });
  });

  it('garde seulement les plus récents', async () => {
    const evidence = await collectEvidence(api(40), 'conv', 'a');
    expect(evidence).toHaveLength(EVIDENCE_MESSAGES);
    expect(evidence.at(-1).id).toBe('m39');
  });

  it('refuse un membre qui ne fait pas partie de la conversation', async () => {
    await expect(collectEvidence(api(), 'conv', 'intrus')).rejects.toMatchObject({ status: 403 });
  });

  it('sans conversation, rien n’est joint', async () => {
    expect(await collectEvidence(api(), undefined, 'a')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { requireEditable } from '../shared/protection.js';
import { createFakeApi } from './fake-api.js';

const api = () =>
  createFakeApi({
    member_status: [
      { $id: 'dev', role: 'developer' },
      { $id: 'admin', role: 'admin' },
      { $id: 'membre', role: 'user' },
    ],
  });

describe('requireEditable', () => {
  it('un admin ne peut pas agir sur le compte développeur', async () => {
    await expect(requireEditable(api(), 'admin', 'dev')).rejects.toMatchObject({ status: 403 });
  });

  it('personne ne peut agir sur son propre compte', async () => {
    await expect(requireEditable(api(), 'admin', 'admin')).rejects.toMatchObject({ status: 403 });
  });

  it('un admin peut agir sur un membre, un développeur sur un admin', async () => {
    await expect(requireEditable(api(), 'admin', 'membre')).resolves.toBeUndefined();
    await expect(requireEditable(api(), 'dev', 'admin')).resolves.toBeUndefined();
  });
});

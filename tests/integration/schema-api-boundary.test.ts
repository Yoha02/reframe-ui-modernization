// @vitest-environment node
import { expect, it } from 'vitest';
import { GenerationRunSchema } from '../../src/shared/schemas';
import fixture from '../fixtures/schemas/generation-run.valid.json';

it('validates JSON crossing the Worker response boundary', async () => {
  const response = Response.json(fixture);
  const parsed = GenerationRunSchema.safeParse(await response.json());
  expect(parsed.success).toBe(true);
});
it('does not silently accept a credential accidentally added to an API response', async () => {
  const response = Response.json({ ...fixture, apiKey: 'FAKE_TEST_SECRET' });
  expect(GenerationRunSchema.safeParse(await response.json()).success).toBe(false);
});

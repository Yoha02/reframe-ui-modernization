// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import worker from '../../src/worker';
import { context, emptyEnv } from '../fixtures/runtime-env';

describe('Worker routing boundary', () => {
  it('returns JSON 404 for unknown API routes without needing bindings', async () => {
    const response = await worker.fetch(new Request('https://reframe.test/api/unknown'), emptyEnv, context);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'not_found', path: '/api/unknown' });
  });
  it('never lets unknown API requests fall through to static HTML', async () => {
    const fetch = vi.fn();
    await worker.fetch(new Request('https://reframe.test/api'), { ASSETS: { fetch } }, context);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('serves frontend routes through the optional static binding', async () => {
    const request = new Request('https://reframe.test/');
    const fetch = vi.fn().mockResolvedValue(new Response('<html>Reframe</html>'));
    expect((await worker.fetch(request, { ASSETS: { fetch } }, context)).status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(request);
  });
  it('reports missing static configuration honestly', async () => {
    expect((await worker.fetch(new Request('https://reframe.test/'), emptyEnv, context)).status).toBe(503);
  });
});

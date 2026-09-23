import type { RuntimeContext, RuntimeEnv } from '../../src/worker';
export const emptyEnv: RuntimeEnv = {};
export const context: RuntimeContext = { waitUntil: () => { throw new Error('Background tasks are not expected during bootstrap.'); } };

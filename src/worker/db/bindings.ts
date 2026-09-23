export interface D1Result<T = Record<string, unknown>> { results: T[]; success: boolean; meta?: { changes?: number }; }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface D1Binding {
  prepare(sql: string): D1Statement;
  batch<T = Record<string, unknown>>(statements: D1Statement[]): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<unknown>;
}
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string, public readonly details?: unknown) { super(message); this.name = 'ApiError'; }
}
export function requireDB(env: { DB?: D1Binding }): D1Binding {
  if (!env.DB) throw new ApiError('DATABASE_UNAVAILABLE',503,'Project storage is not configured.');
  return env.DB;
}

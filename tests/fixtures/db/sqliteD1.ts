import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { D1Binding, D1Result, D1Statement } from '../../../src/worker/db/bindings';
class Statement implements D1Statement {
  constructor(private db: DatabaseSync,readonly sql: string,private values: SQLInputValue[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db,this.sql,values as SQLInputValue[]); }
  async first<T>() { return (this.db.prepare(this.sql).get(...this.values) as T | undefined) ?? null; }
  async all<T>(): Promise<D1Result<T>> {
    const before = this.db.prepare('SELECT total_changes() AS n').get()!.n as number;
    const results = this.db.prepare(this.sql).all(...this.values) as T[];
    const after = this.db.prepare('SELECT total_changes() AS n').get()!.n as number;
    return { success: true,results,meta: { changes: after - before } };
  }
  async run(): Promise<D1Result> { const result = this.db.prepare(this.sql).run(...this.values); return { success: true,results: [],meta: { changes: Number(result.changes) } }; }
}
export class SqliteD1 implements D1Binding {
  readonly sqlite = new DatabaseSync(':memory:');
  constructor(migration: string) { this.sqlite.exec('PRAGMA foreign_keys = ON'); this.sqlite.exec(migration); }
  prepare(sql: string) { return new Statement(this.sqlite,sql); }
  async exec(sql: string) { this.sqlite.exec(sql); }
  async batch<T>(statements: D1Statement[]): Promise<D1Result<T>[]> {
    this.sqlite.exec('BEGIN');
    try { const results: D1Result<T>[] = []; for (const statement of statements) results.push(await statement.all<T>()); this.sqlite.exec('COMMIT'); return results; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
  close() { this.sqlite.close(); }
}

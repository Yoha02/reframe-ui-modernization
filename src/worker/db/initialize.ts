import migration from '../../../migrations/0001_initial_workflow.sql?raw';
import type { D1Binding } from './bindings';
export async function ensureDatabase(db: D1Binding) {
  const exists = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Projects'").first();
  if (exists) return;
  const statements = migration.split(/;\s*(?=CREATE|--|$)/i).map(value => value.trim()).filter(Boolean)
    .map(sql => sql.replace(/\bCREATE (TABLE|INDEX|TRIGGER) /,'CREATE $1 IF NOT EXISTS '));
  await db.batch(statements.map(sql => db.prepare(sql)));
}

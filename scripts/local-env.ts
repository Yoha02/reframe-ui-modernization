import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const names = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_BUDGET_USD', 'SESSION_SIGNING_SECRET', 'RELEASE_ORIGIN', 'RELEASE_PUBLISH_SECRET'] as const;

export function selectLocalBindings(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(names.flatMap(name => env[name]?.trim() ? [[name, env[name]!.trim()]] : []));
}

export function loadLocalBindings() {
  if (existsSync('.env')) loadEnvFile('.env');
  return selectLocalBindings(process.env);
}

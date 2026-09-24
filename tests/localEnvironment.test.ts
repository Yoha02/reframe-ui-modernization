import { describe, expect, it } from 'vitest';
import { selectLocalBindings } from '../scripts/local-env';

describe('local server configuration', () => {
  it('passes only named server settings and excludes unrelated credentials and flags', () => {
    expect(selectLocalBindings({ OPENAI_API_KEY: ' test-placeholder ', OPENAI_BUDGET_USD: '10', GITHUB_TOKEN: 'other-placeholder', LOCAL_DEVELOPMENT: 'false', VITE_API_KEY: 'unsafe-placeholder' })).toEqual({ OPENAI_API_KEY: 'test-placeholder', OPENAI_BUDGET_USD: '10' });
  });
  it('leaves absent or blank settings unconfigured', () => {
    expect(selectLocalBindings({ OPENAI_API_KEY: ' ', OPENAI_BUDGET_USD: '' })).toEqual({});
  });
});

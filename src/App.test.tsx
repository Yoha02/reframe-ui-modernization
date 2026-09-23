import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps import disabled when the backend is unavailable', async () => {
  vi.spyOn(window,'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ message: 'The workspace is unavailable.' },{ status: 503 })));
  const { container } = render(<App />);
  expect(screen.getByRole('link', { name: 'Reframe home' })).toBeTruthy();
  expect(screen.getByRole('navigation', { name: 'Modernization workflow' })).toBeTruthy();
  expect(screen.getByText('Design system')).toBeTruthy();
  expect(screen.getByText('Publish')).toBeTruthy();
  expect(screen.getByText('Setup needed')).toBeTruthy();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Reimagine Space Jam/ }).hasAttribute('disabled')).toBe(true);
  expect(container.querySelector('[data-site-theme]')).toBeNull();
});

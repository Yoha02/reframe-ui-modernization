import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);
it('renders the fixed workbench without backend state or generated site tokens', () => {
  const { container } = render(<App />);
  expect(screen.getByRole('link', { name: 'Reframe home' })).toBeTruthy();
  expect(screen.getByRole('complementary', { name: 'Modernization workflow' })).toBeTruthy();
  expect(screen.getByText('Design system')).toBeTruthy();
  expect(screen.getByText('Publish')).toBeTruthy();
  expect(screen.getByText('In development')).toBeTruthy();
  expect(container.querySelector('[data-site-theme]')).toBeNull();
});

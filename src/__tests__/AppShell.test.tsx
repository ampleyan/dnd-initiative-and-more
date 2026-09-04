import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../components/AppShell';

describe('AppShell', () => {
  it('keeps navigation, content, and overlays available in the application shell', () => {
    render(
      <AppShell
        sidebar={<nav aria-label="Primary navigation">Navigation</nav>}
        main={<main><section aria-label="Page content">Encounter vault</section></main>}
        afterMain={<><aside aria-label="Combatant details">Details</aside><div role="dialog">Quick action</div></>}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    expect(screen.getByRole('main')).toHaveTextContent('Encounter vault');
    expect(screen.getByRole('complementary', { name: 'Combatant details' })).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveTextContent('Quick action');
  });
});

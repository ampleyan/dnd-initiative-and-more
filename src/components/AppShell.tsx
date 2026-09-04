import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar?: ReactNode;
  main: ReactNode;
  afterMain?: ReactNode;
}

/**
 * Visual composition boundary for the signed-in application.
 *
 * State and route selection stay in App; this component owns only the order
 * of the top-level visual regions.
 */
export function AppShell({
  sidebar,
  main,
  afterMain,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-on-background">
      {sidebar}
      {main}
      {afterMain}
    </div>
  );
}

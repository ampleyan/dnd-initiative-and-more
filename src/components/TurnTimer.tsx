// src/components/TurnTimer.tsx
import React, { useState, useEffect } from 'react';

interface TurnTimerProps {
  startedAt: number;
}

export const TurnTimer: React.FC<TurnTimerProps> = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);

  useEffect(() => {
    setElapsed(Date.now() - startedAt);
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const totalSec = Math.floor(elapsed / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;

  return (
    <span className="text-[10px] font-mono text-outline/50 tabular-nums ml-1.5 select-none">
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
};

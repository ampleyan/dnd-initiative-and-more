import React, { useState } from 'react';
import { cn } from '../lib/utils';

const COLORS = [
  'bg-red-900/60 text-red-200',
  'bg-orange-900/60 text-orange-200',
  'bg-amber-900/60 text-amber-200',
  'bg-emerald-900/60 text-emerald-200',
  'bg-teal-900/60 text-teal-200',
  'bg-sky-900/60 text-sky-200',
  'bg-indigo-900/60 text-indigo-200',
  'bg-violet-900/60 text-violet-200',
  'bg-rose-900/60 text-rose-200',
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

interface AvatarImgProps {
  src?: string;
  name: string;
  className?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
}

export const AvatarImg: React.FC<AvatarImgProps> = ({ src, name, className, referrerPolicy = 'no-referrer' }) => {
  const [failed, setFailed] = useState(!src);

  if (failed || !src) {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className={cn('flex items-center justify-center font-bold select-none', colorFor(name), className)}>
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={cn('object-cover', className)}
      referrerPolicy={referrerPolicy}
      onError={() => setFailed(true)}
    />
  );
};

'use client';

import React from 'react';

export type SourceType =
  | 'PYTH'
  | 'PRESTOCKS'
  | 'METEORA'
  | 'SOLANA'
  | 'PROVN'
  | 'SIMULATION';

export interface SourceBadgeProps {
  source: SourceType;
  detail?: string;
  size?: 'xs' | 'sm';
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  detail,
  size = 'sm',
  className = '',
}) => {
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.2 text-[9px]' : 'px-2 py-0.5 text-[10px]';

  switch (source) {
    case 'PYTH':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>PYTH · LIVE</span>
          {detail && <span className="text-emerald-400/70">({detail})</span>}
        </span>
      );

    case 'PRESTOCKS':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span>PRESTOCKS · LIVE</span>
          {detail && <span className="text-blue-400/70">({detail})</span>}
        </span>
      );

    case 'METEORA':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          <span>METEORA DBC · VERIFIED</span>
          {detail && <span className="text-amber-400/70">({detail})</span>}
        </span>
      );

    case 'SOLANA':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
          <span>SOLANA · DEVNET</span>
          {detail && <span className="text-purple-400/70">({detail})</span>}
        </span>
      );

    case 'PROVN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/30 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
          <span>PROVN · SEALED</span>
          {detail && <span className="text-teal-300/70">({detail})</span>}
        </span>
      );

    case 'SIMULATION':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700 tabular-nums ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          <span>SIMULATION</span>
          {detail && <span className="text-slate-500">({detail})</span>}
        </span>
      );
  }
};

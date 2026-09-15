import React from 'react';
import { APP_CONFIG } from '@/lib/config';

interface ClusterBadgeProps {
  className?: string;
  showSubtitle?: boolean;
}

export const ClusterBadge: React.FC<ClusterBadgeProps> = ({
  className = '',
  showSubtitle = true,
}) => {
  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-purple-950/40 border border-purple-500/30 text-purple-300 text-xs font-mono ${className}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
      </span>
      <span className="font-semibold tracking-wider">{APP_CONFIG.clusterLabel}</span>
      {showSubtitle && (
        <span className="text-[10px] text-purple-400/80 hidden sm:inline">
          (Test Assets)
        </span>
      )}
    </div>
  );
};

import React from 'react';

interface ProgressBarProps {
  currentBps: number;
  limitBps: number;
  type: 'max' | 'min'; // 'max' means current <= limit (e.g. exposure cap), 'min' means current >= limit (e.g. reserve floor)
  label?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentBps,
  limitBps,
  type,
  label,
  className = '',
}) => {
  const currentPct = Math.min(100, Math.max(0, currentBps / 100));
  const limitPct = Math.min(100, Math.max(0, limitBps / 100));

  const isSafe = type === 'max' ? currentBps <= limitBps : currentBps >= limitBps;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-sentinel-textMuted">{label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sentinel-text tabular-nums font-semibold">
              {currentPct.toFixed(2)}%
            </span>
            <span className="text-sentinel-textSubtle text-[11px]">
              ({type === 'max' ? 'Cap' : 'Floor'}: {limitPct.toFixed(1)}%)
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                isSafe
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {isSafe ? 'SAFE' : 'BREACH'}
            </span>
          </div>
        </div>
      )}

      {/* Progress Track */}
      <div className="relative h-2 w-full bg-sentinel-surfaceMuted border border-sentinel-border rounded-full overflow-hidden">
        {/* Fill */}
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isSafe ? 'bg-blue-500' : 'bg-rose-500'
          }`}
          style={{ width: `${currentPct}%` }}
        />

        {/* Limit Marker Pin */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
          style={{ left: `${limitPct}%` }}
          title={`${type === 'max' ? 'Max limit' : 'Min reserve floor'}: ${limitPct}%`}
        />
      </div>
    </div>
  );
};

import React from 'react';

interface StatProps {
  label: string;
  value: string;
  subtext?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  subtext,
  delta,
  deltaPositive,
  icon: Icon,
  iconColor = 'text-sentinel-accent',
  className = '',
}) => {
  return (
    <div
      className={`bg-sentinel-surface border border-sentinel-border rounded-xl p-5 relative overflow-hidden flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between text-sentinel-textSubtle text-xs font-semibold tracking-wider">
        <span>{label}</span>
        {Icon && <Icon className={`w-4 h-4 ${iconColor}`} />}
      </div>

      <div className="mt-3">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-sentinel-text tabular-nums">
          {value}
        </div>
      </div>

      {(subtext || delta) && (
        <div className="mt-2.5 flex items-center gap-2 text-xs">
          {delta && (
            <span
              className={`font-semibold font-mono px-1.5 py-0.2 rounded text-[11px] ${
                deltaPositive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}
            >
              {delta}
            </span>
          )}
          {subtext && <span className="text-sentinel-textMuted">{subtext}</span>}
        </div>
      )}
    </div>
  );
};

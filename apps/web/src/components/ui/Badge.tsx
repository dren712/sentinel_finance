import React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'danger'
  | 'warning'
  | 'devnet'
  | 'simulated'
  | 'outline'
  | 'info';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  dot?: boolean;
  dotPulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
  dotPulse = false,
}) => {
  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
  }[size];

  const variantClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
    accent: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    info: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    devnet: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    simulated: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    outline: 'bg-transparent text-sentinel-textMuted border-sentinel-border',
  };

  const dotClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-400',
    accent: 'bg-blue-400',
    info: 'bg-cyan-400',
    success: 'bg-emerald-400',
    danger: 'bg-rose-400',
    warning: 'bg-amber-400',
    devnet: 'bg-purple-400',
    simulated: 'bg-amber-400',
    outline: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium font-mono border rounded-md uppercase tracking-wider tabular-nums ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClasses[variant]} ${
            dotPulse ? 'animate-pulse' : ''
          }`}
        />
      )}
      {children}
    </span>
  );
};

import React from 'react';

export type BadgeVariant =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'danger'
  | 'warning'
  | 'devnet'
  | 'simulated';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  dot = false,
}) => {
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs';

  const variantClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-800/80 text-slate-300 border-slate-700',
    accent: 'bg-blue-950/60 text-blue-400 border-blue-500/30',
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40',
    danger: 'bg-rose-950/60 text-rose-400 border-rose-500/40',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-500/40',
    devnet: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
    simulated: 'bg-amber-950/40 text-amber-400 border-amber-500/30',
  };

  const dotClasses: Record<BadgeVariant, string> = {
    neutral: 'bg-slate-400',
    accent: 'bg-blue-400',
    success: 'bg-emerald-400',
    danger: 'bg-rose-400',
    warning: 'bg-amber-400',
    devnet: 'bg-purple-400',
    simulated: 'bg-amber-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium font-mono border rounded-md ${sizeClasses} ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]}`} />}
      {children}
    </span>
  );
};

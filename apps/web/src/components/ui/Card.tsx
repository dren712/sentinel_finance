'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'muted' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  ...props
}) => {
  const variantClasses = {
    default: 'bg-sentinel-surface border-sentinel-border',
    elevated: 'bg-sentinel-surfaceElevated border-sentinel-borderStrong shadow-lg shadow-black/20',
    muted: 'bg-sentinel-surfaceMuted border-sentinel-border',
    interactive:
      'bg-sentinel-surface border-sentinel-border hover:border-slate-600 transition cursor-pointer sentinel-interactive',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  };

  return (
    <div
      className={`border rounded-xl transition-colors ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const SurfaceCard = Card;

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  category?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  border?: boolean;
  compact?: boolean;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  category,
  badge,
  action,
  border = true,
  compact = false,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        compact ? 'pb-2.5 mb-2.5' : 'pb-4 mb-4'
      } ${border ? 'border-b border-sentinel-border' : ''} ${className}`}
    >
      <div>
        {category && (
          <span className="text-[10px] font-mono font-bold text-sentinel-textSubtle uppercase tracking-wider block mb-0.5">
            {category}
          </span>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {typeof title === 'string' ? (
            <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
          ) : (
            title
          )}
          {badge}
        </div>
        {subtitle && (
          <div className="text-xs text-sentinel-textMuted mt-0.5 max-w-2xl leading-relaxed">
            {subtitle}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export const SectionHeader = CardHeader;

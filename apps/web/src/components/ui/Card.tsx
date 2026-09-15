import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'muted';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
}) => {
  const variantClasses = {
    default: 'bg-sentinel-surface border-sentinel-border',
    elevated: 'bg-sentinel-surfaceElevated border-sentinel-borderStrong shadow-lg shadow-black/20',
    muted: 'bg-sentinel-surfaceMuted border-sentinel-border',
  };

  return (
    <div
      className={`border rounded-xl p-5 sm:p-6 transition-colors ${variantClasses[variant]} ${className}`}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, badge, action, className = '' }) => {
  return (
    <div className={`flex items-center justify-between pb-4 mb-4 border-b border-sentinel-border ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-sentinel-text">{title}</h3>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-sentinel-textMuted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};

'use client';

import React from 'react';
import {
  LayoutDashboard,
  PieChart,
  Bot,
  ShieldCheck,
  Scale,
  FileCheck,
  Sparkles,
} from 'lucide-react';

export type NavTab =
  | 'portfolio'
  | 'agent'
  | 'protection'
  | 'activity';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  evidenceCount: number;
}

interface TabItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  evidenceCount,
}) => {
  const tabs: TabItem[] = [
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'agent', label: 'Agent', icon: Bot },
    { id: 'protection', label: 'Protection', icon: ShieldCheck },
    { id: 'activity', label: 'Activity', icon: FileCheck, count: evidenceCount },
  ];

  return (
    <div className="border-b border-sentinel-border bg-sentinel-bg/80 backdrop-blur sticky top-16 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-3 overflow-x-auto py-2 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as NavTab)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-sentinel-surfaceElevated text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-sentinel-textMuted hover:text-white hover:bg-sentinel-surface'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-sentinel-textSubtle'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-sentinel-surfaceMuted text-sentinel-textMuted text-[10px] font-mono border border-sentinel-border">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

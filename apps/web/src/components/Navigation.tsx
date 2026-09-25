'use client';

import React from 'react';
import {
  Sparkles,
  PieChart,
  Bot,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'portfolio'
  | 'agent'
  | 'protection'
  | 'proof'
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
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  evidenceCount,
}) => {
  const tabs: TabItem[] = [
    { id: 'overview', label: '§ 01 OVERVIEW', icon: Sparkles },
    { id: 'portfolio', label: '§ 02 PORTFOLIO', icon: PieChart },
    { id: 'agent', label: '§ 03 AGENT', icon: Bot },
    { id: 'protection', label: '§ 04 POLICY', icon: ShieldCheck },
    { id: 'proof', label: '§ 05 PROOFS', icon: CheckCircle2, count: 11 },
    { id: 'activity', label: '§ 06 ACTIVITY', icon: FileCheck, count: evidenceCount },
  ];

  return (
    <>
      {/* Desktop Navigation (Top Tab Bar) */}
      <div className="border-b border-sentinel-border bg-sentinel-bg/95 backdrop-blur sticky top-16 z-30 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1.5 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[4px] text-xs font-mono font-semibold tracking-wider sentinel-interactive sentinel-focus cursor-pointer ${
                    isActive
                      ? 'bg-sentinel-surfaceElevated text-sentinel-text border border-sentinel-accent/50 shadow-xs'
                      : 'text-sentinel-textMuted hover:text-sentinel-text hover:bg-sentinel-surface border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sentinel-accent' : 'text-sentinel-textSubtle'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-[2px] bg-sentinel-surfaceMuted text-sentinel-textMuted text-[10px] font-mono tabular-nums border border-sentinel-border">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Non-negotiable) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sentinel-surface/95 backdrop-blur border-t border-sentinel-border px-3 py-1.5 shadow-2xl safe-area-bottom">
        <nav className="grid grid-cols-6 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg sentinel-interactive sentinel-focus min-h-[44px] cursor-pointer ${
                  isActive
                    ? 'text-sentinel-text bg-sentinel-accent/15 border border-sentinel-accent/30 font-bold'
                    : 'text-sentinel-textMuted hover:text-sentinel-text'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-sentinel-accent' : 'text-sentinel-textSubtle'}`} />
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-sentinel-accent text-white text-[9px] font-mono tabular-nums font-bold leading-none">
                      {tab.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

'use client';

import React from 'react';
import {
  LayoutDashboard,
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
  badgeText?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  evidenceCount,
}) => {
  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'agent', label: 'Agent', icon: Bot },
    { id: 'protection', label: 'Protection', icon: ShieldCheck },
    { id: 'proof', label: 'Verification', icon: CheckCircle2, count: 11, badgeText: '11 negative proofs' },
    { id: 'activity', label: 'Activity', icon: FileCheck, count: evidenceCount },
  ];

  return (
    <>
      {/* Desktop Navigation (Subtle Horizontal Tab Bar with Active Underline) */}
      <div className="border-b border-sentinel-border bg-sentinel-bg/95 backdrop-blur sticky top-16 z-30 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2" aria-label="Main Navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-3 text-xs transition-colors cursor-pointer select-none focus:outline-none ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-sentinel-textMuted hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      isActive ? 'text-sentinel-accent' : 'text-sentinel-textSubtle'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {(tab.badgeText || (tab.count !== undefined && tab.count > 0)) && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono tabular-nums leading-none ${
                        isActive
                          ? 'bg-sentinel-accent/20 text-blue-300 font-semibold'
                          : 'bg-sentinel-surfaceElevated text-sentinel-textSubtle border border-sentinel-border'
                      }`}
                    >
                      {tab.badgeText ?? tab.count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sentinel-accent rounded-t-full" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (44px touch floor, no clipping at 320px/375px) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sentinel-surface/95 backdrop-blur border-t border-sentinel-border px-1 py-1 shadow-2xl safe-area-bottom">
        <nav className="grid grid-cols-6 gap-0.5" aria-label="Mobile Navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-0.5 rounded-lg cursor-pointer transition-colors ${
                  isActive
                    ? 'text-white font-semibold bg-white/[0.04]'
                    : 'text-sentinel-textMuted hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-sentinel-accent' : 'text-sentinel-textSubtle'
                    }`}
                  />
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-2 px-1 min-w-[12px] h-3 flex items-center justify-center rounded-full bg-sentinel-accent text-white text-[8px] font-mono font-bold leading-none">
                      {tab.count}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 truncate max-w-full text-center leading-tight">
                  {tab.id === 'proof' ? 'Verify' : tab.label}
                </span>
                {isActive && (
                  <span className="w-3 h-0.5 bg-sentinel-accent rounded-full mt-0.5" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

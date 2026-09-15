'use client';

import React from 'react';
import {
  PieChart,
  Bot,
  ShieldCheck,
  Scale,
  FileCheck,
  Sparkles,
} from 'lucide-react';

export type NavTab = 'portfolio' | 'agent' | 'guarantees' | 'decisions' | 'evidence' | 'sponsors';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  evidenceCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  evidenceCount,
}) => {
  const tabs = [
    { id: 'portfolio', label: 'Portfolio', icon: PieChart },
    { id: 'agent', label: 'Autonomous Agent', icon: Bot },
    { id: 'guarantees', label: 'Policy Guarantees', icon: ShieldCheck },
    { id: 'decisions', label: 'Decision Inspector', icon: Scale, badge: 'Core PTA' },
    { id: 'evidence', label: 'Evidence (PROVN)', icon: FileCheck, count: evidenceCount },
    { id: 'sponsors', label: 'Sponsors (Meteora / Claw)', icon: Sparkles },
  ];

  return (
    <div className="border-b border-sentinel-cardBorder bg-sentinel-bg/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id as NavTab)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                    {tab.badge}
                  </span>
                )}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
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

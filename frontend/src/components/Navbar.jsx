import React from 'react';
import { useTrading } from '../context/TradingContext';
import {
  LayoutDashboard,
  Search,
  Briefcase,
  Layers,
  Sliders,
  History,
  BarChart3,
  Shield,
} from 'lucide-react';

export default function Navbar() {
  const { activeTab, setActiveTab, positions } = useTrading();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'scanner', label: 'Market Scanner', icon: Search },
    {
      id: 'positions',
      label: 'Positions',
      icon: Briefcase,
      badge: positions.length > 0 ? positions.length : null,
    },
    { id: 'orders', label: 'Orders & Trades', icon: Layers },
    { id: 'strategy', label: 'Strategy Config', icon: Sliders },
    { id: 'backtest', label: 'Backtesting', icon: History },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Security', icon: Shield },
  ];

  return (
    <nav className="bg-[#0e1320] border-b border-gray-800 px-6 overflow-x-auto">
      <div className="flex items-center space-x-1 min-w-max py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge !== null && item.badge !== undefined && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

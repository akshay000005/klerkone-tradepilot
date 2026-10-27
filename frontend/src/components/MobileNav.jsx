import React from 'react';
import { useTrading } from '../context/TradingContext';
import {
  LayoutDashboard,
  Search,
  Briefcase,
  Layers,
  Shield,
  Bot,
} from 'lucide-react';

export default function MobileNav() {
  const { activeTab, setActiveTab, positions, botStatus } = useTrading();

  const navItems = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'scanner', label: 'Scanner', icon: Search },
    {
      id: 'positions',
      label: 'Positions',
      icon: Briefcase,
      badge: positions?.length > 0 ? positions.length : null,
    },
    { id: 'orders', label: 'Trades', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Shield },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0e1320]/95 backdrop-blur-lg border-t border-gray-800 px-3 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-semibold transition-all relative ${
              isActive
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {item.badge !== null && item.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-black">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

import React from 'react';
import { ToastProvider } from './context/ToastContext';
import { TradingProvider, useTrading } from './context/TradingContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Header from './components/Header';
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';

import Overview from './pages/Overview';
import Scanner from './pages/Scanner';
import Positions from './pages/Positions';
import Orders from './pages/Orders';
import StrategyConfig from './pages/StrategyConfig';
import Backtesting from './pages/Backtesting';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function DashboardContent() {
  const { activeTab } = useTrading();

  const renderActivePage = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview />;
      case 'scanner':
        return <Scanner />;
      case 'positions':
        return <Positions />;
      case 'orders':
        return <Orders />;
      case 'strategy':
        return <StrategyConfig />;
      case 'backtest':
        return <Backtesting />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans">
      <Header />
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        <ErrorBoundary>
          {renderActivePage()}
        </ErrorBoundary>
      </main>
      <footer className="border-t border-gray-800/80 py-4 px-6 text-center text-xs text-gray-500 font-mono mb-16 md:mb-0">
        KlerkOne TradePilot • Indian Equity Algorithmic System • Regulatory Compliance &amp; Capital Preservation First
      </footer>
      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <TradingProvider>
          <DashboardContent />
        </TradingProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

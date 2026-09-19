import React from 'react';
import {
  Activity,
  AlertTriangle,
  Radio,
  Sparkles,
  RefreshCw,
  Wrench,
  BarChart3,
  Cpu,
  Globe2,
  HelpCircle,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import { MaintenanceWorkOrder } from '../types';
import { WorkNotificationMenu } from './WorkNotificationMenu';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'overview' | 'telemetry' | 'anomalies' | 'maintenance';
  setActiveTab: (tab: 'overview' | 'telemetry' | 'anomalies' | 'maintenance') => void;
  activeAnomaliesCount: number;
  onRunGlobalScan: () => void;
  isScanning: boolean;
  geminiOnline: boolean;
  workOrders?: MaintenanceWorkOrder[];
  onUpdateOrderStatus?: (orderId: string, status: MaintenanceWorkOrder['status']) => void;
  isSimpleMode?: boolean;
  onToggleSimpleMode?: () => void;
  isLiveLoading?: boolean;
  onRefreshLiveWeather?: () => void;
  lastLiveSyncTime?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeAnomaliesCount,
  onRunGlobalScan,
  isScanning,
  geminiOnline,
  workOrders = [],
  onUpdateOrderStatus = () => {},
  isSimpleMode = true,
  onToggleSimpleMode = () => {},
  isLiveLoading = false,
  onRefreshLiveWeather = () => {},
  lastLiveSyncTime = 'Just now',
}) => {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#14263F] bg-[#050D1A]/95 backdrop-blur-md">
      {/* Top Banner with Telemetry Status */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-1.5 border-b border-[#0F1D33] text-xs text-slate-400 bg-[#030812]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#132A4A] text-[#39D5FF] border border-[#1D3E6B]">
            <Cpu className="w-3 h-3 text-[#39D5FF]" />
            WeatherGuard AI
          </span>
          <span className="hidden sm:inline text-slate-400 font-medium">
            Live Weather & Sensor Health Monitor
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Real-time live weather connection status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Globe2 className="w-3 h-3" />
              ALL DISTRICTS LIVE
            </span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>Synced {lastLiveSyncTime}</span>
          </div>

          <div
            className={`hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
              geminiOnline
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
            }`}
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>AI Diagnostics Active</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand logo & identity */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#103055] to-[#08182B] border border-[#1D4A7A] flex items-center justify-center shadow-lg shadow-cyan-950/30">
            <Activity className="w-5 h-5 text-[#39D5FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                WeatherGuard<span className="text-[#39D5FF]">AI</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-emerald-950/60 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Live Satellite & Ground Feed
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Accurate Current Weather & Simple Plain-English Sensor Diagnostics
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-1">
          <button
            id="nav-tab-overview"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#0E1E33]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Stations</span>
          </button>

          <button
            id="nav-tab-telemetry"
            onClick={() => setActiveTab('telemetry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#0E1E33]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>24h Weather Charts</span>
          </button>

          <button
            id="nav-tab-anomalies"
            onClick={() => setActiveTab('anomalies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'anomalies'
                ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#0E1E33]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Sensor Issues</span>
            {activeAnomaliesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                {activeAnomaliesCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-maintenance"
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80] shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-[#0E1E33]'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Repair Orders</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Simple Explanation Mode Switch */}
          <button
            id="btn-toggle-simple-mode"
            onClick={onToggleSimpleMode}
            title="Toggle between Simple Plain-English explanations and Detailed Engineering Mode"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isSimpleMode
                ? 'bg-amber-950/40 border-amber-600/60 text-amber-300 hover:bg-amber-900/40'
                : 'bg-[#0E1E33] border-[#1A385C] text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">
              {isSimpleMode ? 'Simple Explanations: ON' : 'Technical Mode'}
            </span>
            <span className="sm:hidden">{isSimpleMode ? 'Simple' : 'Tech'}</span>
          </button>

          {/* Refresh Live Data Button */}
          <button
            id="btn-refresh-live-weather"
            onClick={onRefreshLiveWeather}
            disabled={isLiveLoading}
            title="Fetch latest real-time weather readings from satellite & station feeds"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0E243E] hover:bg-[#153457] text-[#39D5FF] text-xs font-medium border border-[#204F82] shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLiveLoading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">{isLiveLoading ? 'Syncing...' : 'Live Sync'}</span>
          </button>

          {/* Scan Fleet Button */}
          <button
            id="btn-run-fleet-scan"
            onClick={onRunGlobalScan}
            disabled={isScanning}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0C3866] to-[#0A2D53] hover:from-[#11477F] hover:to-[#0E3B6E] text-[#39D5FF] text-xs font-medium border border-[#20528A] shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 ${isScanning ? 'animate-pulse' : ''}`} />
            <span>{isScanning ? 'Checking...' : 'Check All'}</span>
          </button>

          {/* Light / Dark Theme Switcher */}
          <div
            id="theme-mode-switcher"
            className="flex items-center p-0.5 rounded-lg border border-[#1A385C] bg-[#0A182B] text-xs shadow-inner"
            role="group"
            aria-label="Theme mode switcher"
          >
            <button
              id="btn-theme-light"
              onClick={() => setTheme('light')}
              title="Switch to Light Theme"
              aria-label="Light Theme"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                theme === 'light'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Light</span>
            </button>
            <button
              id="btn-theme-dark"
              onClick={() => setTheme('dark')}
              title="Switch to Dark Theme"
              aria-label="Dark Theme"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                theme === 'dark'
                  ? 'bg-[#142C4C] text-[#39D5FF] shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Dark</span>
            </button>
          </div>

          {/* Top Right Symbol: Work Notifications & Live Countdown */}
          <WorkNotificationMenu
            workOrders={workOrders}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onNavigateToMaintenance={() => setActiveTab('maintenance')}
          />
        </div>
      </div>
    </header>
  );
};

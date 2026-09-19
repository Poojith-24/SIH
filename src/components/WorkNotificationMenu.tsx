import React, { useState, useEffect, useRef } from 'react';
import { MaintenanceWorkOrder } from '../types';
import {
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface WorkNotificationMenuProps {
  workOrders: MaintenanceWorkOrder[];
  onUpdateOrderStatus: (orderId: string, status: MaintenanceWorkOrder['status']) => void;
  onNavigateToMaintenance: (orderId?: string) => void;
}

export const WorkNotificationMenu: React.FC<WorkNotificationMenuProps> = ({
  workOrders,
  onUpdateOrderStatus,
  onNavigateToMaintenance,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'finished'>('pending');
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Keep a dynamic clock ticking every 10 seconds for real-time remaining countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Separate pending (unfinished) and finished (resolved) work orders
  const pendingOrders = workOrders.filter((w) => w.status !== 'resolved');
  const finishedOrders = workOrders.filter((w) => w.status === 'resolved');

  // Compute time remaining before finished
  const getTimeRemaining = (targetDateStr: string) => {
    const target = new Date(targetDateStr).getTime();
    const diffMs = target - currentTime;

    if (diffMs <= 0) {
      const overdueMins = Math.floor(Math.abs(diffMs) / (60 * 1000));
      const hours = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      return {
        isOverdue: true,
        text: hours > 0 ? `${hours}h ${mins}m overdue` : `${mins}m overdue`,
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        progressPct: 100,
      };
    }

    const totalMins = Math.floor(diffMs / (60 * 1000));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const days = Math.floor(hours / 24);

    let text = '';
    if (days > 0) {
      text = `${days}d ${hours % 24}h before finish`;
    } else if (hours > 0) {
      text = `${hours}h ${mins}m before finish`;
    } else {
      text = `${mins}m before finish`;
    }

    // Determine urgency
    let badgeColor = 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60';
    if (hours < 3) {
      badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-800/60';
    }

    return {
      isOverdue: false,
      text,
      badgeColor,
      progressPct: Math.max(10, Math.min(95, 100 - Math.round((diffMs / (48 * 3600 * 1000)) * 100))),
    };
  };

  const handleFinishWork = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateOrderStatus(orderId, 'resolved');
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.2, x: 0.85 },
        colors: ['#39D5FF', '#10B981', '#F59E0B'],
      });
    } catch {
      // safe fallback
    }
  };

  const handleFinishAllPending = () => {
    pendingOrders.forEach((o) => {
      onUpdateOrderStatus(o.id, 'resolved');
    });
    try {
      confetti({
        particleCount: 90,
        spread: 90,
        origin: { y: 0.25, x: 0.85 },
        colors: ['#39D5FF', '#10B981', '#FCD34D'],
      });
    } catch {
      // safe fallback
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Top Right Symbol / Bell Button */}
      <button
        id="btn-top-right-notifications"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Work notifications"
        className={`relative p-2 rounded-lg flex items-center justify-center transition-all ${
          isOpen
            ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80] shadow-md shadow-cyan-950/40'
            : 'bg-[#0A1B30] hover:bg-[#102742] text-slate-300 hover:text-white border border-[#173357]'
        }`}
      >
        <Bell className="w-4 h-4" />

        {/* Dynamic Badge for Pending Work */}
        {pendingOrders.length > 0 && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-white font-mono text-[10px] font-bold shadow-md shadow-rose-950/60 ring-2 ring-[#050D1A]">
              {pendingOrders.length}
            </span>
            {/* Pulsing indicator before work is finished */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          </>
        )}
      </button>

      {/* Notification Drawer / Dropdown */}
      {isOpen && (
        <div
          id="popover-work-notifications"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#071324] border border-[#1A365D] shadow-2xl shadow-black/80 z-50 overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 border-b border-[#122847] bg-gradient-to-r from-[#091A33] to-[#061222] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#11294D] border border-[#1E4378] flex items-center justify-center text-[#39D5FF]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>Work In Progress Notifications</span>
                  {pendingOrders.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {pendingOrders.length} Active
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Tracking time remaining before work is finished
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-[#10243E] transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtabs: Pending vs Finished */}
          <div className="px-4 pt-2.5 pb-1 flex items-center gap-2 border-b border-[#0F223D] bg-[#050E1C] text-xs">
            <button
              onClick={() => setActiveSubTab('pending')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'pending'
                  ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Before Finished ({pendingOrders.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('finished')}
              className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'finished'
                  ? 'bg-[#142C4C] text-[#39D5FF] border border-[#214D80]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Finished ({finishedOrders.length})</span>
            </button>
          </div>

          {/* Body List */}
          <div className="p-3 overflow-y-auto space-y-2.5 divide-y divide-[#0F223D]/50 flex-1">
            {activeSubTab === 'pending' ? (
              pendingOrders.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center text-emerald-400 mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-white">All Field Work Finished!</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    All maintenance work orders have been completed and verified. No active work pending.
                  </p>
                </div>
              ) : (
                pendingOrders.map((order) => {
                  const remaining = getTimeRemaining(order.targetResolutionDate);
                  return (
                    <div
                      key={order.id}
                      className="pt-2.5 first:pt-0 group hover:bg-[#0A1A2E]/60 p-2.5 rounded-xl border border-transparent hover:border-[#17365D] transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10243E] text-[#39D5FF] border border-[#1A3A63]">
                              {order.ticketNumber}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                order.severity === 'critical'
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                  : order.severity === 'high'
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                              }`}
                            >
                              {order.severity}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {order.sensorKey}
                            </span>
                          </div>

                          <h4 className="text-xs font-semibold text-slate-100 mt-1 line-clamp-1">
                            {order.issueTitle}
                          </h4>

                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate">
                            <Wrench className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">{order.stationName}</span>
                          </p>

                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Tech: {order.technicianName}
                          </p>
                        </div>
                      </div>

                      {/* Time Before Finished Countdown Card */}
                      <div className="mt-2.5 p-2 rounded-lg bg-[#050D1A] border border-[#132845] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] text-slate-400 font-medium">
                              Time before finished:
                            </div>
                            <div
                              className={`text-[11px] font-mono font-bold truncate ${
                                remaining.isOverdue ? 'text-rose-400' : 'text-cyan-300'
                              }`}
                            >
                              {remaining.text}
                            </div>
                          </div>
                        </div>

                        {/* Quick Finish Button */}
                        <button
                          id={`btn-finish-work-${order.id}`}
                          onClick={(e) => handleFinishWork(order.id, e)}
                          title="Mark this work order finished"
                          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 flex items-center gap-1 shadow-sm transition-all active:scale-95 shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          <span>Finish Work</span>
                        </button>
                      </div>

                      {/* Progress bar towards completion target */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-[#0E1F36] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              remaining.isOverdue
                                ? 'bg-rose-500'
                                : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                            }`}
                            style={{ width: `${remaining.progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {order.status === 'in_progress' ? 'In Progress' : 'Dispatched'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              finishedOrders.length === 0 ? (
                <div className="py-8 px-4 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#10243E] border border-[#1A3A63] flex items-center justify-center text-slate-400 mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-white">No Finished Works Yet</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                    When you click "Finish Work" on active tasks, they will appear here as completed and calibrated.
                  </p>
                </div>
              ) : (
                finishedOrders.map((order) => (
                  <div
                    key={order.id}
                    className="pt-2.5 first:pt-0 p-2.5 rounded-xl bg-[#09172B]/60 border border-emerald-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#10243E] text-slate-300">
                            {order.ticketNumber}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Work Finished
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-slate-200 mt-1">
                          {order.issueTitle}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {order.stationName} • {order.technicianName}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-[#122847] bg-[#050D1A] flex items-center justify-between gap-2">
            {pendingOrders.length > 0 && activeSubTab === 'pending' ? (
              <button
                id="btn-finish-all-work"
                onClick={handleFinishAllPending}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Mark all finished</span>
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">
                IMD AWS Automated Dispatch
              </span>
            )}

            <button
              id="btn-view-all-work-orders"
              onClick={() => {
                setIsOpen(false);
                onNavigateToMaintenance();
              }}
              className="px-3 py-1.5 rounded-lg bg-[#112A4A] hover:bg-[#183963] text-[#39D5FF] text-xs font-medium border border-[#1E4577] flex items-center gap-1 transition-all"
            >
              <span>Manage All Orders</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

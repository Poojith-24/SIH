import React, { useState } from 'react';
import { MaintenanceWorkOrder, Station, SensorKey, Severity } from '../types';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User,
  Plus,
  X,
  Filter,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MaintenanceOrdersProps {
  orders: MaintenanceWorkOrder[];
  stations: Station[];
  onUpdateOrderStatus: (orderId: string, status: MaintenanceWorkOrder['status']) => void;
  onCreateManualOrder: (order: Omit<MaintenanceWorkOrder, 'id' | 'ticketNumber' | 'createdAt'>) => void;
}

export const MaintenanceOrders: React.FC<MaintenanceOrdersProps> = ({
  orders,
  stations,
  onUpdateOrderStatus,
  onCreateManualOrder,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isCreatingModalOpen, setIsCreatingModalOpen] = useState(false);

  // Form state for creating new order
  const [targetStationId, setTargetStationId] = useState(stations[0]?.id || '');
  const [targetSensorKey, setTargetSensorKey] = useState<SensorKey>('temperature');
  const [issueTitle, setIssueTitle] = useState('');
  const [severity, setSeverity] = useState<Severity>('high');
  const [technicianName, setTechnicianName] = useState('');
  const [sparePartsText, setSparePartsText] = useState('');

  const filteredOrders = orders.filter((o) => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

  const handleResolveOrder = (orderId: string) => {
    onUpdateOrderStatus(orderId, 'resolved');
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#39D5FF', '#10B981', '#F59E0B'],
      });
    } catch {
      // Ignore if canvas-confetti is not rendered
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const station = stations.find((s) => s.id === targetStationId) || stations[0];
    const spareParts = sparePartsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onCreateManualOrder({
      stationId: station.id,
      stationName: station.name,
      sensorKey: targetSensorKey,
      issueTitle: issueTitle || `Routine inspection & servicing for ${targetSensorKey}`,
      severity,
      status: 'dispatched',
      technicianName: technicianName || 'Regional IMD Maintenance Engineer',
      targetResolutionDate: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      spareParts: spareParts.length > 0 ? spareParts : ['Sensor clean kit', 'Calibration reference probe'],
      wmoFlag: 'QC1_Suspect',
      fieldNotes: 'Field maintenance scheduled by AWS telemetry control center.',
    });

    setIsCreatingModalOpen(false);
    setIssueTitle('');
    setTechnicianName('');
    setSparePartsText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-5 rounded-2xl bg-[#081426] border border-[#142947] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#132A4A] text-[#39D5FF] border border-[#1D3E6B]">
              Field Logistics & Preventive Maintenance
            </span>
            <span className="text-xs text-slate-400">
              Mean Time to Repair (MTTR): <strong className="text-emerald-400 font-mono">18.4 hrs</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            AWS Field Maintenance Work Orders
          </h2>
          <p className="text-xs text-slate-400">
            Automated ticket dispatching, technician routing, spare parts inventory allocation, and telemetry QC validation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <select
              id="select-wo-status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#050D1A] border border-[#1C3A63] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#39D5FF]"
            >
              <option value="all">All Statuses ({orders.length})</option>
              <option value="open">Open</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <button
            id="btn-open-create-wo-modal"
            onClick={() => setIsCreatingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#174677] to-[#12365D] hover:from-[#1E5894] hover:to-[#174677] text-[#39D5FF] text-xs font-bold border border-[#2764A3] shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Work Order</span>
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.map((order) => {
          const isResolved = order.status === 'resolved';
          const isCritical = order.severity === 'critical';

          return (
            <div
              key={order.id}
              id={`wo-card-${order.id}`}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                isResolved
                  ? 'bg-[#06101D] border-[#10233B] opacity-75'
                  : isCritical
                  ? 'bg-[#12080F] border-rose-900/60 shadow-lg shadow-rose-950/20'
                  : 'bg-[#081426] border-[#142947]'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#10243E] text-[#39D5FF] border border-[#1F4574]">
                    {order.ticketNumber}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      order.status === 'resolved'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : order.status === 'in_progress'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : order.status === 'dispatched'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {order.status.replace('_', ' ')}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-white leading-snug">
                  {order.issueTitle}
                </h4>

                <div className="text-xs text-slate-300">
                  <span className="text-slate-400">Target Station:</span> {order.stationName}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{order.technicianName}</span>
                </div>

                {order.fieldNotes && (
                  <p className="text-[11px] text-slate-400 bg-[#050D1A] p-2 rounded-lg border border-[#10223B] leading-relaxed">
                    {order.fieldNotes}
                  </p>
                )}

                {/* Spare parts */}
                <div className="pt-2 border-t border-[#10223B]">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
                    Allocated Spare Parts:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {order.spareParts.map((part, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded text-[10px] bg-[#0E1E33] text-slate-300 border border-[#183252]"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-[#10223B] flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>Due: {new Date(order.targetResolutionDate).toLocaleDateString()}</span>
                </div>

                {!isResolved ? (
                  <div className="flex items-center gap-1.5">
                    {order.status === 'open' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'dispatched')}
                        className="px-2 py-1 rounded bg-[#132A4A] hover:bg-[#1A3861] text-[#39D5FF] text-[11px] font-semibold"
                      >
                        Dispatch
                      </button>
                    )}
                    {order.status === 'dispatched' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'in_progress')}
                        className="px-2 py-1 rounded bg-[#132A4A] hover:bg-[#1A3861] text-purple-300 text-[11px] font-semibold"
                      >
                        In Progress
                      </button>
                    )}
                    <button
                      onClick={() => handleResolveOrder(order.id)}
                      className="px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Resolve</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Calibrated & Verified
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Create Work Order Modal */}
      {isCreatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#071322] border border-[#1C3E6B] rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#142947]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                Dispatch Field Technician Work Order
              </h3>
              <button
                onClick={() => setIsCreatingModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Target AWS Station:</label>
                <select
                  value={targetStationId}
                  onChange={(e) => setTargetStationId(e.target.value)}
                  className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name} ({s.region})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Sensor Channel:</label>
                  <select
                    value={targetSensorKey}
                    onChange={(e) => setTargetSensorKey(e.target.value as SensorKey)}
                    className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="temperature">Air Temperature</option>
                    <option value="humidity">Relative Humidity</option>
                    <option value="pressure">Barometric Pressure</option>
                    <option value="windSpeed">Wind Speed & Anemometer</option>
                    <option value="rainfall">Precipitation & Rain Gauge</option>
                    <option value="solarRadiation">Pyranometer Solar Radiation</option>
                    <option value="soilMoisture">Soil Moisture Probe</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Severity Priority:</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as Severity)}
                    className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="critical">Critical (Immediate)</option>
                    <option value="high">High (&lt;24h)</option>
                    <option value="medium">Medium (&lt;48h)</option>
                    <option value="low">Low (Routine)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Work Description / Directive:</label>
                <input
                  type="text"
                  placeholder="e.g., Optical lens de-salination & PT100 reference calibration"
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  required
                  className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Assigned Field Engineer:</label>
                <input
                  type="text"
                  placeholder="e.g., Rajesh Sharma (Regional AWS Maintenance Cell)"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  required
                  className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Required Spare Parts (comma separated):</label>
                <input
                  type="text"
                  placeholder="e.g., Replacement filter cap, Reed switch, 12V 18Ah AGM battery"
                  value={sparePartsText}
                  onChange={(e) => setSparePartsText(e.target.value)}
                  className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-white placeholder-slate-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#142947]">
                <button
                  type="button"
                  onClick={() => setIsCreatingModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0E1E33] hover:bg-[#142845] text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#174677] to-[#12365D] hover:from-[#1E5894] hover:to-[#174677] text-[#39D5FF] font-bold border border-[#2764A3]"
                >
                  Dispatch Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

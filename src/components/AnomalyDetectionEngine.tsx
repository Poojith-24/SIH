import React, { useState } from 'react';
import { Station, AnomalyRecord, SensorKey } from '../types';
import {
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Wrench,
  Flame,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  Filter,
} from 'lucide-react';

interface AnomalyDetectionEngineProps {
  anomalies: AnomalyRecord[];
  stations: Station[];
  onOpenDiagnosticModal: (station: Station, sensorKey: SensorKey, anomalyType: string) => void;
  onCreateWorkOrder: (anomaly: AnomalyRecord) => void;
  onInjectSyntheticAnomaly: (
    stationId: string,
    sensorKey: SensorKey,
    anomalyType: AnomalyRecord['anomalyType'],
    anomalyLabel: string,
    observedVal: number
  ) => void;
}

export const AnomalyDetectionEngine: React.FC<AnomalyDetectionEngineProps> = ({
  anomalies,
  stations,
  onOpenDiagnosticModal,
  onCreateWorkOrder,
  onInjectSyntheticAnomaly,
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [injectionStationId, setInjectionStationId] = useState<string>(stations[0]?.id || 'AWS-HIM-01');
  const [injectionScenario, setInjectionScenario] = useState<string>('tipping_clog');
  const [injectionSuccessMessage, setInjectionSuccessMessage] = useState<string | null>(null);

  const filteredAnomalies = anomalies.filter((a) => {
    if (selectedSeverity === 'all') return true;
    return a.severity === selectedSeverity;
  });

  const handleExecuteInjection = () => {
    const targetStation = stations.find((s) => s.id === injectionStationId) || stations[0];
    if (!targetStation) return;

    if (injectionScenario === 'tipping_clog') {
      onInjectSyntheticAnomaly(
        targetStation.id,
        'rainfall',
        'biofouling',
        'Tipping Bucket Funnel Clogged by Debris (0 tips during rain event)',
        0.0
      );
      setInjectionSuccessMessage(`Injected "Tipping Funnel Clog" on ${targetStation.name}. ML Detection Engine flagged it as Biofouling (QC1 Suspect).`);
    } else if (injectionScenario === 'wind_seize') {
      onInjectSyntheticAnomaly(
        targetStation.id,
        'windSpeed',
        'flatline',
        'Frozen Anemometer Bearings / Cup Lock (0.0 km/h flatline for 6h)',
        0.0
      );
      setInjectionSuccessMessage(`Injected "Frozen Bearing Seizure" on ${targetStation.name}. ML Engine flagged Flatline (QC2 Erroneous).`);
    } else if (injectionScenario === 'temp_drift') {
      onInjectSyntheticAnomaly(
        targetStation.id,
        'temperature',
        'drift',
        'Radiation Shield Aerosol Trap (+4.5°C Positive Calibration Drift)',
        (targetStation.sensors.temperature?.currentValue ?? 25) + 4.8
      );
      setInjectionSuccessMessage(`Injected "Aerosol Thermal Drift" on ${targetStation.name}. Spatial Peer Consensus flagged it.`);
    } else if (injectionScenario === 'battery_sag') {
      onInjectSyntheticAnomaly(
        targetStation.id,
        'pressure',
        'power_sag',
        'Photovoltaic Salt Crust causing Battery Brownout (10.6V terminal sag)',
        10.6
      );
      setInjectionSuccessMessage(`Injected "Power Subsystem Sag (10.6V)" on ${targetStation.name}. Power Rule flagged it as Critical.`);
    } else if (injectionScenario === 'rh_violation') {
      onInjectSyntheticAnomaly(
        targetStation.id,
        'humidity',
        'spike',
        'Physical Thermodynamic Limit Breach (108.5% Relative Humidity)',
        108.5
      );
      setInjectionSuccessMessage(`Injected "Physical Range Violation (108.5%)" on ${targetStation.name}. Flagged as QC2 Erroneous.`);
    }

    setTimeout(() => {
      setInjectionSuccessMessage(null);
    }, 5000);
  };

  return (
    <div className="space-y-6">
      {/* Engine Header & Notification */}
      <div className="p-5 rounded-2xl bg-[#081426] border border-[#142947] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[#132A4A] text-[#39D5FF] border border-[#1D3E6B]">
              Multi-Tier ML Anomaly Detection Engine
            </span>
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3 h-3" /> IMD Standards Compliant
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            Real-Time AWS Quality Control & Anomaly Classification
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl">
            Integrates Physical Limits, Rate-of-Change (IQR / Z-Score), Persistence Flatline Deadbands,
            Spatial Peer Consensus, and Cross-Sensor Physical Law Consistency checks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Severity:</span>
          <select
            id="select-anomaly-severity"
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="bg-[#050D1A] border border-[#1C3A63] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#39D5FF]"
          >
            <option value="all">All Severities ({anomalies.length})</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Only</option>
            <option value="medium">Medium Only</option>
          </select>
        </div>
      </div>

      {/* Synthetic Anomaly Injection Sandbox (High Value for Demonstration & Evaluation) */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#071322] to-[#0A1A2E] border border-[#1C3E6B] shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#142947]">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#39D5FF]" />
            <h3 className="text-base font-bold text-white">
              Interactive Anomaly Injection Sandbox
            </h3>
          </div>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-700/60">
            Interactive Diagnostic Testing
          </span>
        </div>

        <p className="text-xs text-slate-300 mt-3 mb-4">
          Inject real-world hardware failure modes and physical law anomalies into any Automatic Weather Station to watch the ML detection algorithm flag it and generate Gemini root-cause diagnosis.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Target AWS Station:</label>
            <select
              id="select-injection-station"
              value={injectionStationId}
              onChange={(e) => setInjectionStationId(e.target.value)}
              className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#39D5FF]"
            >
              <optgroup label="Tamil Nadu (38 Districts)">
                {stations
                  .filter((s) => s.state === 'Tamil Nadu')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.district}: {s.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="National Weather Stations (India)">
                {stations
                  .filter((s) => s.state !== 'Tamil Nadu')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.district} ({s.state}): {s.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Simulated Failure Scenario:</label>
            <select
              id="select-injection-scenario"
              value={injectionScenario}
              onChange={(e) => setInjectionScenario(e.target.value)}
              className="w-full bg-[#050D1A] border border-[#1B365B] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#39D5FF]"
            >
              <option value="tipping_clog">Tipping Bucket Funnel Clog (Biofouling)</option>
              <option value="wind_seize">Wind Anemometer Bearing Freeze / Jam</option>
              <option value="temp_drift">Aspiration Shield Dust (+4.5°C Drift)</option>
              <option value="battery_sag">Photovoltaic Salt Crust (10.6V Battery Sag)</option>
              <option value="rh_violation">Thermodynamic Limit Breach (108.5% RH)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              id="btn-inject-anomaly"
              onClick={handleExecuteInjection}
              className="w-full py-2 px-4 rounded-lg bg-gradient-to-r from-[#174677] to-[#12365D] hover:from-[#1E5894] hover:to-[#174677] text-[#39D5FF] text-xs font-bold border border-[#2764A3] flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 active:scale-95 transition-all"
            >
              <Flame className="w-4 h-4 text-amber-400" />
              <span>Inject & Trigger ML Engine</span>
            </button>
          </div>
        </div>

        {injectionSuccessMessage && (
          <div className="mt-3 p-3 rounded-lg bg-emerald-950/60 border border-emerald-700/80 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{injectionSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Active Anomalies Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Active Anomalies & Quality Control Violations ({filteredAnomalies.length})
          </h3>
          <span className="text-xs text-slate-400">
            Real-time assimilation flags (QC0 to QC2)
          </span>
        </div>

        {filteredAnomalies.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#081426] border border-[#142947] text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-white">No active anomalies matching this filter</p>
            <p className="text-xs mt-1">All telemetry channels conform to physical and statistical thresholds.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {filteredAnomalies.map((anom) => {
              const station = stations.find((s) => s.id === anom.stationId);
              const isCritical = anom.severity === 'critical';
              const isHigh = anom.severity === 'high';

              return (
                <div
                  key={anom.id}
                  id={`anomaly-item-${anom.id}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isCritical
                      ? 'bg-[#120810] border-rose-900/70 shadow-lg shadow-rose-950/20'
                      : isHigh
                      ? 'bg-[#120D08] border-amber-900/70 shadow-lg shadow-amber-950/20'
                      : 'bg-[#081426] border-[#142947]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#10243E] text-[#39D5FF] border border-[#1F4574]">
                          {anom.stationName}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          Channel: <span className="text-cyan-300">{anom.sensorLabel}</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            isCritical
                              ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60'
                              : isHigh
                              ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                              : 'bg-blue-900/60 text-blue-300 border border-blue-700/60'
                          }`}
                        >
                          {anom.severity}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-950/60 text-purple-300 border border-purple-800/60">
                          {anom.qcFlag.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {anom.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono mt-2">
                        <span>Observed: <strong className="text-rose-400">{anom.observedValue} {anom.unit}</strong></span>
                        <span>Expected: <strong className="text-emerald-400">{anom.expectedValue} {anom.unit}</strong></span>
                        <span>Algorithm: <strong className="text-slate-300">{anom.algorithm}</strong></span>
                        <span>Detected: {new Date(anom.detectedAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Actions: AI Diagnosis & Work Order */}
                    <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                      {station && (
                        <button
                          id={`btn-diagnose-anomaly-${anom.id}`}
                          onClick={() => onOpenDiagnosticModal(station, anom.sensorKey, anom.anomalyType)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#173F69] to-[#122E4D] hover:from-[#1E5083] hover:to-[#173A61] text-[#39D5FF] text-xs font-semibold border border-[#265E99] shadow transition-all active:scale-95"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>AI Root Cause Analysis</span>
                        </button>
                      )}

                      <button
                        id={`btn-create-wo-${anom.id}`}
                        onClick={() => onCreateWorkOrder(anom)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F2238] hover:bg-[#152E4C] text-slate-200 text-xs font-medium border border-[#1A385E] transition-all"
                      >
                        <Wrench className="w-3.5 h-3.5 text-slate-300" />
                        <span>Dispatch Work Order</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* QC Architecture Breakdown */}
      <div className="p-5 rounded-2xl bg-[#081426] border border-[#142947] space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          5-Layer Quality Control & Anomaly Detection Pipeline Architecture
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-[#050D1A] border border-[#10233B]">
            <div className="font-bold text-[#39D5FF]">Layer 1: Range Test</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Checks climatological & instrument physical bounds (e.g. RH &gt; 100%, Temp &gt; 65°C).
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#050D1A] border border-[#10233B]">
            <div className="font-bold text-emerald-400">Layer 2: Step Rate (IQR)</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Detects high-frequency spikes and impossible rate-of-change jumps between consecutive samples.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#050D1A] border border-[#10233B]">
            <div className="font-bold text-purple-400">Layer 3: Deadband Flatline</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Flags constant readings (variance ≈ 0) caused by frozen bearings or stuck ADC buffers.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#050D1A] border border-[#10233B]">
            <div className="font-bold text-amber-400">Layer 4: Spatial Peers</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Cross-references neighbor AWS stations within 50km radius to isolate localized drift.
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#050D1A] border border-[#10233B]">
            <div className="font-bold text-rose-400">Layer 5: Cross-Sensor Laws</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Validates physics relationships (e.g. zero rain during 98% RH + pressure drop indicates funnel clog).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

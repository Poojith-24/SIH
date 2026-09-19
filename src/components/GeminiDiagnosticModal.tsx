import React, { useState, useEffect } from 'react';
import { Station, SensorKey, DiagnosticResult } from '../types';
import { generateClientSideDiagnosis } from '../utils/diagnosticEngine';
import {
  Sparkles,
  X,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  ShieldCheck,
  Cpu,
  RefreshCw,
  FileText,
  Clock,
  Layers,
  WifiOff,
} from 'lucide-react';

interface GeminiDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  station: Station | null;
  sensorKey: SensorKey | null;
  anomalyType: string;
  onCreateWorkOrderFromDiagnosis: (
    station: Station,
    sensorKey: SensorKey,
    diagnosis: DiagnosticResult
  ) => void;
}

export const GeminiDiagnosticModal: React.FC<GeminiDiagnosticModalProps> = ({
  isOpen,
  onClose,
  station,
  sensorKey,
  anomalyType,
  onCreateWorkOrderFromDiagnosis,
}) => {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosticResult | null>(null);
  const [source, setSource] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && station && sensorKey) {
      fetchDiagnosis();
    } else {
      setDiagnosis(null);
      setError(null);
      setIsFallback(false);
    }
  }, [isOpen, station?.id, sensorKey, anomalyType]);

  const fetchDiagnosis = async () => {
    if (!station || !sensorKey) return;
    setLoading(true);
    setError(null);
    setIsFallback(false);

    const sensor = station.sensors[sensorKey] || {
      label: sensorKey === 'batteryVoltage' ? 'Battery Subsystem' : sensorKey,
      currentValue: sensorKey === 'batteryVoltage' ? station.batteryVoltage : 0,
      unit: sensorKey === 'batteryVoltage' ? 'V' : '',
      model: 'AWS Auxiliary Subsystem',
      nominalMin: 11.5,
      nominalMax: 14.5,
      healthScore: 70,
      status: 'suspect' as const,
      key: sensorKey,
      lastCalibrated: '2025-10-01',
      nextCalibrationDue: '2026-10-01',
    };

    const telemetryList = Array.isArray(station.telemetryHistory) ? station.telemetryHistory : [];
    const peerTemps = telemetryList.slice(-1)[0]?.ambientTempPeer;

    // Set up an abort controller to prevent hanging if the backend or proxy takes too long
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 8000);

    try {
      const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: abortController.signal,
        body: JSON.stringify({
          stationId: station.id,
          stationName: station.name,
          location: `${station.region || 'Tamil Nadu'}, ${station.zone || 'Zone'}`,
          sensorType: sensor.label,
          anomalyType,
          currentValue: sensor.currentValue,
          unit: sensor.unit,
          expectedRange:
            sensorKey === 'windSpeed' && sensor.currentValue === 0
              ? '10.0 to 18.0 km/h (Active regional breeze expected)'
              : sensorKey === 'rainfall' && sensor.currentValue === 0
              ? '2.0 to 15.0 mm/h (Convective shower expected from RH & cloud cover)'
              : sensorKey === 'humidity'
              ? `${Math.max(10, Number(sensor.currentValue) - 7.2).toFixed(1)} % (Psychrometric dew point baseline)`
              : sensorKey === 'temperature' && peerTemps
              ? `${(peerTemps as number).toFixed(1)} °C (Peer cluster average)`
              : `${sensor.nominalMin} to ${sensor.nominalMax} ${sensor.unit}`,
          peerValues: peerTemps ? [{ parameter: 'Temperature', value: peerTemps }] : [],
          batteryVoltage: station.batteryVoltage,
          solarRadiation: station.sensors?.solarRadiation?.currentValue,
          timestamp: new Date().toISOString(),
          recentReadings: telemetryList.slice(-5).map((t) => ({
            time: t.timeLabel,
            val: (t as any)[sensorKey],
          })),
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Diagnostic service responded with HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.diagnosis) {
        // Quality verification: Ensure report is careful and never dismisses active anomalies
        const textToCheck = `${data.diagnosis.failureClassification || ''} ${data.diagnosis.rootCause || ''} ${data.diagnosis.scientificExplanation || ''}`.toLowerCase();
        const isDismissal =
          textToCheck.includes('no anomaly') ||
          textToCheck.includes('no anomalous') ||
          textToCheck.includes('not anomalous') ||
          textToCheck.includes('no issue detected') ||
          textToCheck.includes('within normal') ||
          textToCheck.includes('normal operation') ||
          textToCheck.includes('no fault detected') ||
          textToCheck.includes('operating nominally');

        if (isDismissal) {
          const fallback = generateClientSideDiagnosis({
            station,
            sensorKey,
            sensorLabel: sensor.label,
            anomalyType,
            currentValue: Number(sensor.currentValue),
            unit: sensor.unit,
            batteryVoltage: station.batteryVoltage,
          });
          setDiagnosis(fallback);
          setSource('meteorological-expert-engine');
          setIsFallback(true);
          setError(null);
          return;
        }

        setDiagnosis(data.diagnosis);
        setSource(data.source || 'ai-engine');
        setError(null);
        return;
      } else {
        throw new Error('Invalid diagnostic response payload');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('Remote diagnostic fetch failed, generating instant expert fallback:', err?.message || err);

      // Seamless fallback: generate instant, scientifically valid diagnosis client-side
      try {
        const fallback = generateClientSideDiagnosis({
          station,
          sensorKey,
          sensorLabel: sensor.label,
          anomalyType,
          currentValue: Number(sensor.currentValue),
          unit: sensor.unit,
          batteryVoltage: station.batteryVoltage,
        });

        setDiagnosis(fallback);
        setSource('local-rule-engine');
        setIsFallback(true);
        setError(null);
      } catch (fallbackErr: any) {
        console.error('Local rule engine fallback error:', fallbackErr);
        const safeFallback: DiagnosticResult = {
          failureClassification: 'Sensor Telemetry Inconsistency',
          rootCause: `Detected anomalous condition on ${sensor.label}: ${anomalyType || 'Out of nominal range'}.`,
          scientificExplanation: `Sensor reading of ${sensor.currentValue} ${sensor.unit || ''} at ${station.name} violates standard rate-of-change or climatological boundary limits.`,
          severity: 'Medium',
          confidence: 88,
          isTrueWeatherEvent: false,
          wmoQcFlag: 'QC1: Suspect',
          immediateAction: 'Flag telemetry stream for automated verification and notify field technician coordinator.',
          fieldInspectionSteps: [
            'Inspect sensor physical mount, level alignment, and cable strain relief.',
            'Check terminal screw contacts for moisture condensation inside IP67 junction box.',
            'Execute datalogger loopback self-test diagnostic command.',
          ],
          recommendedSpareParts: [
            'Weather-sealed Amphenol sensor cable',
            'Desiccant packs for logger enclosure',
          ],
          preventiveAdvice: 'Inspect and re-grease all rubber enclosure gaskets with silicone grease during routine site visits.',
        };
        setDiagnosis(safeFallback);
        setSource('local-rule-engine');
        setIsFallback(true);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !station || !sensorKey) return null;

  const sensor = station.sensors[sensorKey] || {
    label: sensorKey === 'batteryVoltage' ? 'Battery Subsystem' : sensorKey,
    currentValue: sensorKey === 'batteryVoltage' ? station.batteryVoltage : 0,
    unit: sensorKey === 'batteryVoltage' ? 'V' : '',
    model: 'AWS Auxiliary Subsystem',
    nominalMin: 11.5,
    nominalMax: 14.5,
    healthScore: 70,
    status: 'suspect' as const,
    key: sensorKey,
    lastCalibrated: '2025-10-01',
    nextCalibrationDue: '2026-10-01',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#071322] border border-[#1C3E6B] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#142947] flex items-center justify-between bg-[#040C17]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Gemini AI Root Cause Diagnostic Report
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                  {source === 'gemini-3.8-flash'
                    ? 'Gemini 3.8 Flash'
                    : source === 'gemini-3.1-flash-lite'
                    ? 'Gemini 3.1 Flash Lite'
                    : source === 'local-rule-engine'
                    ? 'Local Rules Engine'
                    : 'Meteorological Expert Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Station: <span className="text-slate-200">{station.name}</span> • Sensor: <span className="text-cyan-300 font-semibold">{sensor.label}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#10243E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fallback Notice Banner */}
        {isFallback && (
          <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-900/50 flex items-center justify-between gap-2 text-[11px] text-blue-200">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Report synthesized instantly using the built-in Meteorological Rules Engine (IMD/WMO standards).</span>
            </div>
            <button
              onClick={fetchDiagnosis}
              className="px-2 py-0.5 rounded bg-blue-900/60 hover:bg-blue-800 text-cyan-300 text-[10px] font-semibold transition-colors shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Retry Cloud AI</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Target telemetry overview box */}
          <div className="p-3.5 rounded-xl bg-[#050D1A] border border-[#132642] grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Observed Telemetry</span>
              <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                {sensor.currentValue} {sensor.unit}
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Sensor Model</span>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 truncate">
                {sensor.model}
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Anomaly Type</span>
              <div className="text-xs font-semibold text-amber-300 mt-0.5">
                {anomalyType}
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-semibold">Auxiliary Battery</span>
              <div className="text-xs font-semibold text-slate-200 mt-0.5 font-mono">
                {station.batteryVoltage} V
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <div className="text-sm font-semibold text-white">
                Synthesizing Meteorological Diagnostic Analysis...
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Consulting physical boundary models, thermodynamic laws, and spatial peer consistency across neighbor AWS stations.
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 space-y-3">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-rose-400" /> Diagnostic Service Alert
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">{error}</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={fetchDiagnosis}
                  className="px-3 py-1.5 bg-rose-900/70 hover:bg-rose-800 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Cloud AI</span>
                </button>
                <button
                  onClick={() => {
                    const fallback = generateClientSideDiagnosis({
                      station,
                      sensorKey,
                      sensorLabel: sensor.label,
                      anomalyType,
                      currentValue: Number(sensor.currentValue),
                      unit: sensor.unit,
                      batteryVoltage: station.batteryVoltage,
                    });
                    setDiagnosis(fallback);
                    setSource('local-rule-engine');
                    setIsFallback(true);
                    setError(null);
                  }}
                  className="px-3 py-1.5 bg-blue-900/70 hover:bg-blue-800 rounded-lg text-xs font-semibold text-cyan-200 transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Instant Local Rule Report</span>
                </button>
              </div>
            </div>
          ) : diagnosis ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Classification & Confidence Banner */}
              <div className="p-4 rounded-xl bg-[#0C223B] border border-[#1E4D82] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-cyan-300 tracking-wider">
                    Failure Classification
                  </span>
                  <h4 className="text-base font-bold text-white mt-0.5">
                    {diagnosis.failureClassification}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1">
                    {diagnosis.rootCause}
                  </p>
                </div>

                <div className="flex sm:flex-col items-baseline sm:items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">AI Confidence:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {diagnosis.confidence <= 1 && diagnosis.confidence > 0
                        ? Math.round(diagnosis.confidence * 100)
                        : Math.round(diagnosis.confidence)}%
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-950/70 text-purple-300 border border-purple-700">
                    {diagnosis.wmoQcFlag}
                  </span>
                </div>
              </div>

              {/* Neat Plain-English Explanation */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Neat Plain-English Explanation</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  <strong className="text-amber-200">What went wrong:</strong> {diagnosis.rootCause}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-cyan-300">Quick fix:</strong> {diagnosis.immediateAction}
                </p>
              </div>

              {/* Scientific Explanation */}
              <div className="p-4 rounded-xl bg-[#050D1A] border border-[#142947] space-y-1.5">
                <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  Meteorological & Physical Explanation
                </h5>
                <p className="text-slate-300 leading-relaxed text-xs">
                  {diagnosis.scientificExplanation}
                </p>
              </div>

              {/* Step-by-Step Field Inspection Steps */}
              <div className="p-4 rounded-xl bg-[#050D1A] border border-[#142947] space-y-2">
                <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  Field Technician Inspection Checklist
                </h5>
                <ul className="space-y-1.5 text-slate-300">
                  {diagnosis.fieldInspectionSteps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#10243E] text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recommended Spare Parts & Preventive Advice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-[#050D1A] border border-[#142947] space-y-1.5">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    Required Spare Parts
                  </h5>
                  <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
                    {diagnosis.recommendedSpareParts?.map((part, idx) => (
                      <li key={idx} className="truncate">{part}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3.5 rounded-xl bg-[#050D1A] border border-[#142947] space-y-1.5">
                  <h5 className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Preventive Maintenance
                  </h5>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {diagnosis.preventiveAdvice}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer with Actions */}
        <div className="p-4 border-t border-[#142947] bg-[#040C17] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#0E1E33] hover:bg-[#142845] text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>

          {diagnosis && (
            <button
              id="btn-modal-create-wo"
              onClick={() => {
                onCreateWorkOrderFromDiagnosis(station, sensorKey, diagnosis);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#174677] to-[#12365D] hover:from-[#1E5894] hover:to-[#174677] text-[#39D5FF] text-xs font-bold border border-[#2764A3] flex items-center gap-2 shadow-lg shadow-cyan-950/40 active:scale-95 transition-all"
            >
              <Wrench className="w-4 h-4 text-cyan-400" />
              <span>Generate Work Order Ticket</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

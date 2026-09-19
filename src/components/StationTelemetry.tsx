import React, { useState } from 'react';
import { Station, SensorKey } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceArea,
} from 'recharts';
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  Sun,
  Layers,
  Sparkles,
  MapPin,
  Clock,
  Play,
  Pause,
  HelpCircle,
  Globe2,
  CheckCircle2,
} from 'lucide-react';
import { getNeatWeatherSummary, getSensorQuickTag } from '../utils/neatExplanations';
import { useTheme } from '../context/ThemeContext';

interface StationTelemetryProps {
  station: Station;
  allStations: Station[];
  onSelectStation: (id: string) => void;
  onOpenDiagnosticModal: (station: Station, sensorKey: SensorKey, anomalyType: string) => void;
  onTickSimulation: () => void;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;
}

export const StationTelemetry: React.FC<StationTelemetryProps> = ({
  station,
  allStations,
  onSelectStation,
  onOpenDiagnosticModal,
  onTickSimulation,
  isSimulating,
  setIsSimulating,
}) => {
  const { theme } = useTheme();
  const [primaryParam, setPrimaryParam] = useState<keyof typeof paramConfigs>('temperature');
  const [secondaryParam, setSecondaryParam] = useState<keyof typeof paramConfigs | 'none'>('humidity');
  const [showPeerComparison, setShowPeerComparison] = useState<boolean>(true);

  const paramConfigs = {
    temperature: {
      label: 'Air Temperature',
      key: 'temperature',
      unit: '°C',
      color: '#FF6B6B',
      strokeWidth: 2.5,
      icon: Thermometer,
    },
    humidity: {
      label: 'Relative Humidity',
      key: 'humidity',
      unit: '%',
      color: '#39D5FF',
      strokeWidth: 2.5,
      icon: Droplets,
    },
    pressure: {
      label: 'Barometric Pressure',
      key: 'pressure',
      unit: 'hPa',
      color: '#A78BFA',
      strokeWidth: 2,
      icon: Gauge,
    },
    windSpeed: {
      label: 'Wind Speed',
      key: 'windSpeed',
      unit: 'km/h',
      color: '#34D399',
      strokeWidth: 2.5,
      icon: Wind,
    },
    windGust: {
      label: 'Wind Gusts',
      key: 'windGust',
      unit: 'km/h',
      color: '#F59E0B',
      strokeWidth: 1.5,
      icon: Wind,
    },
    rainfall: {
      label: 'Precipitation',
      key: 'rainfall',
      unit: 'mm/h',
      color: '#60A5FA',
      strokeWidth: 2.5,
      icon: CloudRain,
    },
    solarRadiation: {
      label: 'Solar Radiation',
      key: 'solarRadiation',
      unit: 'W/m²',
      color: '#FBBF24',
      strokeWidth: 2,
      icon: Sun,
    },
    soilMoisture: {
      label: 'Soil Moisture',
      key: 'soilMoisture',
      unit: '% vol',
      color: '#10B981',
      strokeWidth: 2,
      icon: Layers,
    },
    batteryVoltage: {
      label: 'Battery Bus Voltage',
      key: 'batteryVoltage',
      unit: 'V',
      color: '#EC4899',
      strokeWidth: 2,
      icon: Gauge,
    },
  };

  const currentPrimary = paramConfigs[primaryParam];
  const currentSecondary = secondaryParam !== 'none' ? paramConfigs[secondaryParam] : null;

  return (
    <div className="space-y-6">
      {/* Station Selector Header */}
      <div className="p-5 rounded-2xl bg-[#081426] border border-[#142947] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#10243E] text-[#39D5FF] border border-[#1F4574]">
              {station.code}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-cyan-400" />
              {station.district}, {station.state} ({station.region}) • Elev: {station.elevationMeters}m MSL
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {station.name}
            </h2>
            {station.isLiveData && (
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-emerald-400" />
                Live Feed
              </span>
            )}
          </div>
          <p className="text-xs text-cyan-300 mt-1 font-medium">
            {getNeatWeatherSummary(
              station.sensors.temperature?.currentValue,
              station.sensors.humidity?.currentValue,
              station.sensors.windSpeed?.currentValue,
              station.sensors.rainfall?.currentValue
            )}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            District: <span className="text-white font-semibold">{station.district}</span> • Microclimate: <span className="text-cyan-300 font-medium">{station.zone}</span> • Last Sync: {station.lastPing}
          </p>
        </div>

        {/* Station switch dropdown & Live Simulator Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Station / District:</span>
            <select
              id="select-station-telemetry"
              value={station.id}
              onChange={(e) => onSelectStation(e.target.value)}
              className="bg-[#050D1A] border border-[#1C3A63] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#39D5FF] max-w-xs"
            >
              <optgroup label="Tamil Nadu (All 38 Districts)">
                {allStations
                  .filter((s) => s.state === 'Tamil Nadu')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.district}: {s.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="National Weather Stations (India)">
                {allStations
                  .filter((s) => s.state !== 'Tamil Nadu')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.district} ({s.state}): {s.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          <button
            id="btn-toggle-telemetry-sim"
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
              isSimulating
                ? 'bg-emerald-950/70 border-emerald-700/80 text-emerald-300'
                : 'bg-[#10243D] border-[#1D3E68] text-slate-300 hover:text-white'
            }`}
          >
            {isSimulating ? (
              <>
                <Pause className="w-3.5 h-3.5 text-emerald-400" />
                <span>Sim Streaming (Active)</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>Simulate Telemetry Feed</span>
              </>
            )}
          </button>

          <button
            id="btn-manual-tick"
            onClick={onTickSimulation}
            title="Inject single telemetry update tick"
            className="px-2.5 py-2 rounded-lg bg-[#050D1A] border border-[#1C3A63] text-xs text-slate-300 hover:text-white hover:border-[#39D5FF]"
          >
            Tick 1h
          </button>
        </div>
      </div>

      {/* 8 Sensor Live Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(station.sensors).map(([key, sensor]) => {
          const isErroneous = sensor.status === 'erroneous';
          const isSuspect = sensor.status === 'suspect';
          const sensorKey = key as SensorKey;

          return (
            <div
              key={sensorKey}
              id={`telemetry-card-${sensorKey}`}
              className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between ${
                isErroneous
                  ? 'bg-rose-950/30 border-rose-800/80 shadow-lg shadow-rose-950/20'
                  : isSuspect
                  ? 'bg-amber-950/30 border-amber-800/80 shadow-lg shadow-amber-950/20'
                  : 'bg-[#081426] border-[#132642]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300 truncate">
                    {sensor.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                      {getSensorQuickTag(sensorKey, sensor.currentValue)}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isErroneous
                          ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60'
                          : isSuspect
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                          : 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40'
                      }`}
                    >
                      {isErroneous ? 'QC2 Error' : isSuspect ? 'QC1 Suspect' : 'QC0 Valid'}
                    </span>
                  </div>
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
                    {sensor.currentValue}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{sensor.unit}</span>
                </div>

                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  Model: {sensor.model}
                </div>
              </div>

              {/* Sensor Health meter */}
              <div className="mt-3 pt-2 border-t border-[#132642]/60">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>Sensor Health</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {sensor.healthScore}%
                  </span>
                </div>
                <div className="w-full bg-[#050D1A] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      sensor.healthScore < 50
                        ? 'bg-rose-500'
                        : sensor.healthScore < 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${sensor.healthScore}%` }}
                  />
                </div>

                {(isErroneous || isSuspect) && (
                  <button
                    id={`btn-diagnose-${sensorKey}`}
                    onClick={() => onOpenDiagnosticModal(station, sensorKey, isErroneous ? 'Hard Fault / Flatline' : 'Calibration Drift')}
                    className="w-full mt-2 py-1 px-2 rounded text-[11px] font-semibold bg-gradient-to-r from-[#173F69] to-[#122E4D] hover:from-[#1E5083] hover:to-[#173A61] text-[#39D5FF] border border-[#265E99] flex items-center justify-center gap-1 transition-all active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>AI Diagnostic</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Time Series Telemetry Explorer */}
      <div className="p-5 rounded-2xl bg-[#081426] border border-[#142947] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#132642]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#39D5FF]" />
              24-Hour Continuous Telemetry Stream & Anomaly Visualizer
            </h3>
            <p className="text-xs text-slate-400">
              Correlate multiple physical channels and spatial peer sensor consistency
            </p>
          </div>

          {/* Selectors for Chart Parameters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Primary:</span>
              <select
                id="select-primary-param"
                value={primaryParam}
                onChange={(e) => setPrimaryParam(e.target.value as any)}
                className="bg-[#050D1A] border border-[#1B3A64] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#39D5FF]"
              >
                {Object.entries(paramConfigs).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label} ({config.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Secondary:</span>
              <select
                id="select-secondary-param"
                value={secondaryParam}
                onChange={(e) => setSecondaryParam(e.target.value as any)}
                className="bg-[#050D1A] border border-[#1B3A64] rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-[#39D5FF]"
              >
                <option value="none">None</option>
                {Object.entries(paramConfigs).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label} ({config.unit})
                  </option>
                ))}
              </select>
            </div>

            {primaryParam === 'temperature' && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 ml-2">
                <input
                  type="checkbox"
                  checked={showPeerComparison}
                  onChange={(e) => setShowPeerComparison(e.target.checked)}
                  className="rounded bg-[#050D1A] border-[#1B3A64] text-cyan-500 focus:ring-0"
                />
                <span className="text-[11px] text-cyan-300">Spatial Peer AWS</span>
              </label>
            )}
          </div>
        </div>

        {/* The Recharts Graphic */}
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={station.telemetryHistory}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#E2E8F0' : '#12253E'} />
              <XAxis
                dataKey="timeLabel"
                stroke={theme === 'light' ? '#475569' : '#64748B'}
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke={currentPrimary.color}
                fontSize={11}
                tickLine={false}
                unit={currentPrimary.unit}
              />
              {currentSecondary && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={currentSecondary.color}
                  fontSize={11}
                  tickLine={false}
                  unit={currentSecondary.unit}
                />
              )}
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'light' ? '#FFFFFF' : '#050D1A',
                  borderColor: theme === 'light' ? '#CBD5E1' : '#1F3C64',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  color: theme === 'light' ? '#0F172A' : '#F3F8FC',
                  boxShadow: theme === 'light'
                    ? '0 10px 25px -5px rgba(0,0,0,0.08)'
                    : '0 10px 25px -5px rgba(0,0,0,0.5)',
                }}
                itemStyle={{
                  color: theme === 'light' ? '#0F172A' : '#F3F8FC',
                }}
                labelStyle={{
                  color: theme === 'light' ? '#334155' : '#94A3B8',
                  fontWeight: 600,
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '10px' }} />

              {/* Primary Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey={currentPrimary.key}
                name={`${currentPrimary.label} (${currentPrimary.unit})`}
                stroke={currentPrimary.color}
                strokeWidth={currentPrimary.strokeWidth}
                dot={(props: any) => {
                  const hasAnomaly = props.payload.hasAnomaly;
                  if (hasAnomaly) {
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={6}
                        fill="#FF4D6D"
                        stroke="#FFF"
                        strokeWidth={2}
                      />
                    );
                  }
                  return <circle cx={props.cx} cy={props.cy} r={2} fill={currentPrimary.color} />;
                }}
                activeDot={{ r: 6, fill: currentPrimary.color }}
              />

              {/* Secondary Line */}
              {currentSecondary && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={currentSecondary.key}
                  name={`${currentSecondary.label} (${currentSecondary.unit})`}
                  stroke={currentSecondary.color}
                  strokeWidth={currentSecondary.strokeWidth}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}

              {/* Spatial Peer Comparison for Temperature */}
              {primaryParam === 'temperature' && showPeerComparison && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="ambientTempPeer"
                  name="Spatial Peer Cluster (Avg °C)"
                  stroke="#94A3B8"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Anomaly Notes */}
        <div className="p-3 rounded-xl bg-[#050D1A] border border-[#132642] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              <span>Red Marker: Anomaly Flagged by Algorithm</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-slate-400 inline-block border-t border-dashed"></span>
              <span>Dashed Gray: 35km Peer AWS Cluster Reference</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Automated Meteorological Quality Control Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

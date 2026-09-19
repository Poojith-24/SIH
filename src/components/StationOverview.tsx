import React, { useState, useMemo } from 'react';
import { Station, StationStatus, SensorKey, AnomalyRecord } from '../types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Droplets,
  Gauge,
  Globe2,
  HelpCircle,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
  Wrench,
  X,
  ArrowRight,
  Compass,
} from 'lucide-react';
import {
  getNeatWeatherSummary,
  getSensorQuickTag,
  getSensorNeatExplanation,
  getStationSimpleVerdict,
} from '../utils/neatExplanations';
import { useTheme } from '../context/ThemeContext';

interface StationOverviewProps {
  stations: Station[];
  anomalies?: AnomalyRecord[];
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
  onNavigateToTelemetry: (stationId: string) => void;
  onOpenDiagnosticModal: (station: Station, sensorKey: any, anomalyType: string) => void;
  isSimpleMode?: boolean;
  onToggleSimpleMode?: () => void;
  lastLiveSyncTime?: string;
  isLiveLoading?: boolean;
  onRefreshLiveWeather?: () => void;
}

export const StationOverview: React.FC<StationOverviewProps> = ({
  stations,
  anomalies = [],
  selectedStationId,
  onSelectStation,
  onNavigateToTelemetry,
  onOpenDiagnosticModal,
  isSimpleMode = true,
  onToggleSimpleMode,
  lastLiveSyncTime = 'Just now',
  isLiveLoading = false,
  onRefreshLiveWeather,
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'tamilnadu' | 'national' | 'anomalies'>('all');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  // Alias lookup for quick user queries
  const checkStationMatch = (station: Station, rawQuery: string): boolean => {
    if (!rawQuery.trim()) return true;
    const q = rawQuery.toLowerCase().trim();

    if (
      station.name.toLowerCase().includes(q) ||
      station.district.toLowerCase().includes(q) ||
      station.state.toLowerCase().includes(q) ||
      station.code.toLowerCase().includes(q) ||
      station.zone.toLowerCase().includes(q)
    ) {
      return true;
    }

    const aliases: Record<string, string[]> = {
      ooty: ['nilgiris', 'ooty', 'udhagamandalam'],
      trichy: ['tiruchirappalli', 'trichy', 'tiruchi'],
      kovai: ['coimbatore', 'kovai'],
      tanjore: ['thanjavur', 'tanjore'],
      tuticorin: ['thoothukudi', 'tuticorin'],
      nellai: ['tirunelveli', 'nellai', 'palayamkottai'],
      madras: ['chennai', 'madras'],
      kodai: ['kodaikanal', 'dindigul', 'kodai'],
      kodaikanal: ['dindigul', 'kodaikanal'],
      bangalore: ['bengaluru', 'bangalore'],
      bombay: ['mumbai', 'bombay'],
      calcutta: ['kolkata', 'calcutta'],
      trivandrum: ['thiruvananthapuram', 'kochi', 'kerala'],
      sohra: ['cherrapunji', 'sohra', 'meghalaya'],
      ladakh: ['leh', 'ladakh'],
      delhi: ['new delhi', 'safdarjung', 'delhi'],
    };

    const distLower = station.district.toLowerCase();
    const nameLower = station.name.toLowerCase();

    for (const [aliasKey, targetWords] of Object.entries(aliases)) {
      if (q.includes(aliasKey) || aliasKey.includes(q)) {
        if (targetWords.some((w) => distLower.includes(w) || nameLower.includes(w))) {
          return true;
        }
      }
    }
    return false;
  };

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      if (regionFilter === 'tamilnadu' && station.state !== 'Tamil Nadu') return false;
      if (regionFilter === 'national' && station.state === 'Tamil Nadu') return false;
      if (regionFilter === 'anomalies' && station.activeAnomaliesCount === 0) return false;
      return checkStationMatch(station, searchQuery);
    });
  }, [stations, regionFilter, searchQuery]);

  const activeStation = useMemo(() => {
    if (searchQuery.trim() && filteredStations.length > 0) {
      return filteredStations[0];
    }
    return stations.find((s) => s.id === selectedStationId) || stations[0];
  }, [stations, selectedStationId, searchQuery, filteredStations]);

  const totalStations = stations.length;
  const tnCount = stations.filter((s) => s.state === 'Tamil Nadu').length;
  const totalAnomalies = stations.reduce((acc, s) => acc + s.activeAnomaliesCount, 0);
  const healthyCount = stations.filter((s) => s.activeAnomaliesCount === 0).length;

  const quickPlaces = [
    { label: 'Chennai', id: 'AWS-TN-01' },
    { label: 'Coimbatore', id: 'AWS-TN-34' },
    { label: 'Ooty (Nilgiris)', id: 'AWS-TN-35' },
    { label: 'Madurai', id: 'AWS-TN-26' },
    { label: 'Thanjavur', id: 'AWS-TN-17' },
    { label: 'Rameswaram', id: 'AWS-TN-27' },
    { label: 'Kanyakumari', id: 'AWS-TN-33' },
    { label: 'New Delhi', id: 'AWS-IN-DEL' },
    { label: 'Mumbai', id: 'AWS-IN-BOM' },
    { label: 'Bengaluru', id: 'AWS-IN-BLR' },
  ];

  const getStatusBadge = (status: StationStatus) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Normal / Healthy
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Needs Review
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-800">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Sensor Issue Detected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 border border-slate-700">
            Checking Status
          </span>
        );
    }
  };

  const activeStationAnomalies = useMemo(() => {
    if (!activeStation) return [];
    return (anomalies || []).filter((a) => a.stationId === activeStation.id && a.status === 'active');
  }, [activeStation, anomalies]);

  const primaryAnomaly = activeStationAnomalies[0];

  const activeVerdict = activeStation ? getStationSimpleVerdict(activeStation) : null;
  const activeWeatherSummary = activeStation
    ? getNeatWeatherSummary(
        activeStation.sensors.temperature?.currentValue,
        activeStation.sensors.humidity?.currentValue,
        activeStation.sensors.windSpeed?.currentValue,
        activeStation.sensors.rainfall?.currentValue
      )
    : '';

  return (
    <div className="space-y-6">
      {/* Platform Banner with Simple Stats & Controls */}
      <div
        id="station-overview-hero-banner"
        className={`p-5 rounded-2xl shadow-xl relative overflow-hidden transition-colors duration-200 ${
          theme === 'light'
            ? 'bg-gradient-to-br from-white via-slate-50 to-sky-50/40 border border-slate-200/90 shadow-slate-200/60'
            : 'bg-gradient-to-r from-[#061426] via-[#091C35] to-[#0A2242] border border-[#16365C]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                  theme === 'light'
                    ? 'bg-sky-100 text-sky-800 border border-sky-300'
                    : 'bg-[#132E52] text-[#39D5FF] border border-[#23538A]'
                }`}
              >
                <Globe2 className={`w-3 h-3 ${theme === 'light' ? 'text-sky-700' : 'text-[#39D5FF]'}`} />
                Live Automatic Weather Stations
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                  theme === 'light'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>All 38 Districts Live Synced</span>
                <span className="opacity-80 text-[10px]">({lastLiveSyncTime})</span>
              </span>
              {onRefreshLiveWeather && (
                <button
                  id="btn-hero-refresh-live"
                  onClick={onRefreshLiveWeather}
                  disabled={isLiveLoading}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50 ${
                    theme === 'light'
                      ? 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-300'
                      : 'bg-[#132E52] text-cyan-300 hover:bg-[#1A3D6B] border border-[#23538A]'
                  }`}
                  title="Re-sync live meteorological feeds for all stations"
                >
                  <RefreshCw className={`w-3 h-3 ${isLiveLoading ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>{isLiveLoading ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              )}
            </div>
            <h1
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              Weather Station Fleet & Live Sensor Health
            </h1>
            <p
              className={`text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-300'
              }`}
            >
              Track live weather data across all 38 Tamil Nadu districts and national stations. The automated AI system verifies each sensor to catch, explain, and repair faults in plain English.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div
            className={`flex items-center gap-2 p-2.5 rounded-xl shrink-0 transition-colors duration-200 ${
              theme === 'light'
                ? 'bg-white border border-slate-200/90 shadow-sm'
                : 'bg-[#040C17]/90 border border-[#153257]'
            }`}
          >
            <div
              className={`text-center px-3 ${
                theme === 'light' ? 'border-r border-slate-200' : 'border-r border-[#153257]'
              }`}
            >
              <div
                className={`text-lg font-mono font-bold ${
                  theme === 'light' ? 'text-sky-700' : 'text-cyan-400'
                }`}
              >
                {totalStations}
              </div>
              <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Total Stations
              </div>
            </div>
            <div
              className={`text-center px-3 ${
                theme === 'light' ? 'border-r border-slate-200' : 'border-r border-[#153257]'
              }`}
            >
              <div
                className={`text-lg font-mono font-bold ${
                  theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                }`}
              >
                {healthyCount}
              </div>
              <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Healthy
              </div>
            </div>
            <div className="text-center px-3">
              <div
                className={`text-lg font-mono font-bold ${
                  theme === 'light' ? 'text-rose-600' : 'text-rose-400'
                }`}
              >
                {totalAnomalies}
              </div>
              <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Issues Flagged
              </div>
            </div>
          </div>
        </div>

        {/* PROMINENT FRONT SEARCH BAR */}
        <div
          className={`mt-5 pt-4 relative transition-colors duration-200 ${
            theme === 'light' ? 'border-t border-slate-200/90' : 'border-t border-[#132C4A]'
          }`}
        >
          <div className="relative">
            <div
              className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                theme === 'light' ? 'text-sky-600' : 'text-cyan-400'
              }`}
            >
              <Search className="w-5 h-5" />
            </div>
            <input
              id="input-place-district-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Search any place or district in Tamil Nadu (Chennai, Ooty, Madurai, Coimbatore...) or India (Delhi, Mumbai...)"
              className={`w-full pl-11 pr-10 py-3 rounded-xl text-sm transition-all shadow-xs ${
                theme === 'light'
                  ? 'bg-white border-2 border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10'
                  : 'bg-[#040C17] border-2 border-[#1E4878] text-white placeholder-slate-400 focus:outline-none focus:border-[#39D5FF] focus:ring-2 focus:ring-[#39D5FF]/20 shadow-inner'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors ${
                  theme === 'light'
                    ? 'text-slate-400 hover:text-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Select Place Chips */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider shrink-0 mr-1 ${
                theme === 'light' ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Quick Select:
            </span>
            {quickPlaces.map((place) => {
              const isSelected = activeStation?.id === place.id;
              return (
                <button
                  key={place.id}
                  onClick={() => {
                    onSelectStation(place.id);
                    const st = stations.find((s) => s.id === place.id);
                    if (st) setSearchQuery(st.district);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                    isSelected
                      ? theme === 'light'
                        ? 'bg-sky-600 border-sky-600 text-white font-semibold shadow-xs'
                        : 'bg-cyan-950/80 border-cyan-500 text-cyan-300 font-semibold shadow-sm'
                      : theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 shadow-xs'
                      : 'bg-[#061224] border-[#142B47] text-slate-300 hover:text-white hover:border-[#1F4574]'
                  }`}
                >
                  {place.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* HOW IT WORKS IN SIMPLE WORDS (Collapsible Quick Guide) */}
      <div
        className={`rounded-2xl border transition-colors duration-200 overflow-hidden ${
          theme === 'light'
            ? 'border-slate-200/90 bg-white shadow-xs'
            : 'border-[#142845] bg-[#071324]'
        }`}
      >
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
            theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-[#0A1B30]'
          }`}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className={`w-4 h-4 ${theme === 'light' ? 'text-sky-600' : 'text-cyan-400'}`} />
            <span
              className={`text-xs sm:text-sm font-bold ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              How WeatherGuard Works in 3 Simple Steps
            </span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                theme === 'light'
                  ? 'text-sky-700 bg-sky-50 border-sky-200'
                  : 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60'
              }`}
            >
              Neat Explanation
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{showHowItWorks ? 'Hide Guide' : 'Show Guide'}</span>
            {showHowItWorks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showHowItWorks && (
          <div
            className={`px-4 pb-4 pt-1 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs border-t ${
              theme === 'light' ? 'border-slate-100' : 'border-[#12233B]'
            }`}
          >
            <div
              className={`p-3 rounded-xl space-y-1.5 border transition-colors ${
                theme === 'light'
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-[#050E1B] border-[#142A4A]'
              }`}
            >
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  theme === 'light' ? 'text-sky-700' : 'text-cyan-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'light'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-cyan-500/20 text-cyan-300'
                  }`}
                >
                  1
                </span>
                <span>Real-Time Weather Feeds</span>
              </div>
              <p className={theme === 'light' ? 'text-slate-600 leading-relaxed' : 'text-slate-300 leading-relaxed'}>
                Weather stations collect live temperature, relative humidity, air pressure, wind velocity, and rainfall directly from regional ground stations and satellites.
              </p>
            </div>

            <div
              className={`p-3 rounded-xl space-y-1.5 border transition-colors ${
                theme === 'light'
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-[#050E1B] border-[#142A4A]'
              }`}
            >
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  theme === 'light' ? 'text-amber-700' : 'text-amber-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'light'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  2
                </span>
                <span>Automated Quality Checks</span>
              </div>
              <p className={theme === 'light' ? 'text-slate-600 leading-relaxed' : 'text-slate-300 leading-relaxed'}>
                The AI constantly checks if a sensor is stuck at 0.0 (frozen bearing), drifting too high, or reporting impossible values that disagree with neighbor stations.
              </p>
            </div>

            <div
              className={`p-3 rounded-xl space-y-1.5 border transition-colors ${
                theme === 'light'
                  ? 'bg-slate-50/80 border-slate-200'
                  : 'bg-[#050E1B] border-[#142A4A]'
              }`}
            >
              <div
                className={`flex items-center gap-2 font-bold text-sm ${
                  theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    theme === 'light'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  3
                </span>
                <span>Plain-English Diagnosis</span>
              </div>
              <p className={theme === 'light' ? 'text-slate-600 leading-relaxed' : 'text-slate-300 leading-relaxed'}>
                When a fault happens, it explains what's broken in plain language (e.g., "Anemometer cups are jammed with debris") and dispatches a maintenance ticket to field staff.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* INSPECTED AWS STATION SHOWCASE */}
      {activeStation && (
        <div
          id="inspected-station-showcase"
          className={`p-5 rounded-2xl shadow-xl space-y-5 animate-fadeIn transition-colors duration-200 ${
            theme === 'light'
              ? 'bg-white border-2 border-slate-200/90 shadow-slate-200/50'
              : 'bg-[#071322] border-2 border-[#1E4D82] shadow-2xl'
          }`}
        >
          {/* Station Identity & Real-Time Status Bar */}
          <div
            className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b transition-colors ${
              theme === 'light' ? 'border-slate-100' : 'border-[#132A4A]'
            }`}
          >
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${
                    theme === 'light'
                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                      : 'bg-[#10243E] text-[#39D5FF] border-[#1F4574]'
                  }`}
                >
                  {activeStation.code}
                </span>
                <span
                  className={`text-xs flex items-center gap-1 ${
                    theme === 'light' ? 'text-slate-600' : 'text-slate-300'
                  }`}
                >
                  <MapPin className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-sky-600' : 'text-cyan-400'}`} />
                  District: <strong className={theme === 'light' ? 'text-slate-900' : 'text-white'}>{activeStation.district}</strong>, {activeStation.state}
                </span>
                <span className={`text-xs font-mono ${theme === 'light' ? 'text-slate-400' : 'text-slate-400'}`}>
                  Elev: {activeStation.elevationMeters}m MSL • Lat: {activeStation.coordinates.lat.toFixed(3)}°N, Lng: {activeStation.coordinates.lng.toFixed(3)}°E
                </span>
                {activeStation.isLiveData && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 border ${
                      theme === 'light'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80'
                    }`}
                  >
                    <Globe2 className="w-3 h-3" />
                    Live Satellite/Ground Weather
                  </span>
                )}
              </div>

              <h2
                className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  theme === 'light' ? 'text-slate-900' : 'text-white'
                }`}
              >
                {activeStation.name}
              </h2>

              <p className={`text-xs ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                {activeWeatherSummary}
              </p>
            </div>

            {/* Status & Diagnostic Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {getStatusBadge(activeStation.status)}

              <button
                id="btn-inspect-telemetry-front"
                onClick={() => onNavigateToTelemetry(activeStation.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
                  theme === 'light'
                    ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200 shadow-xs'
                    : 'bg-[#0F2644] hover:bg-[#16355C] text-[#39D5FF] border-[#214D80]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>View 24h Charts</span>
                <ArrowRight className="w-3 h-3" />
              </button>

              <button
                id="btn-run-ai-diagnosis-front"
                onClick={() => {
                  if (primaryAnomaly) {
                    onOpenDiagnosticModal(
                      activeStation,
                      primaryAnomaly.sensorKey,
                      primaryAnomaly.anomalyType
                    );
                  } else {
                    const abnormalSensor = Object.entries(activeStation.sensors).find(
                      ([_, s]) => s.status !== 'operational'
                    );
                    const key = abnormalSensor ? (abnormalSensor[0] as SensorKey) : 'temperature';
                    onOpenDiagnosticModal(
                      activeStation,
                      key,
                      activeStation.status === 'critical' ? 'Sensor Fault / Flatline' : 'Sensor Value Discrepancy'
                    );
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white text-xs font-bold border border-sky-500/40 shadow-sm transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-200" />
                <span>
                  {primaryAnomaly
                    ? `Explain Anomaly (${primaryAnomaly.sensorLabel}) with AI`
                    : 'Explain Issue with AI'}
                </span>
              </button>
            </div>
          </div>

          {/* Simple Explanation Verdict Card */}
          {primaryAnomaly ? (
            <div
              className={`p-4 rounded-xl border ${
                primaryAnomaly.severity === 'critical'
                  ? 'bg-rose-950/40 border-rose-800/80'
                  : 'bg-amber-950/40 border-amber-800/80'
              }`}
            >
              <div className="flex items-start gap-3">
                {primaryAnomaly.severity === 'critical' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      {primaryAnomaly.sensorLabel} Anomaly Detected: {primaryAnomaly.anomalyType.toUpperCase()} ({primaryAnomaly.qcFlag})
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-black/40 text-slate-300">
                      Health Score: {activeStation.telemetryHealthPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {primaryAnomaly.description} (Recorded: {primaryAnomaly.observedValue}{primaryAnomaly.unit} | Expected Baseline: ~{primaryAnomaly.expectedValue}{primaryAnomaly.unit})
                  </p>
                </div>
              </div>
            </div>
          ) : activeVerdict && (
            <div
              className={`p-4 rounded-xl border ${
                activeVerdict.tone === 'critical'
                  ? 'bg-rose-950/40 border-rose-800/80'
                  : activeVerdict.tone === 'warning'
                  ? 'bg-amber-950/40 border-amber-800/80'
                  : 'bg-emerald-950/30 border-emerald-800/60'
              }`}
            >
              <div className="flex items-start gap-3">
                {activeVerdict.tone === 'critical' ? (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                ) : activeVerdict.tone === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{activeVerdict.headline}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-black/40 text-slate-300">
                      Health Score: {activeStation.telemetryHealthPct}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {activeVerdict.detail}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* SENSORS WITH NEAT EXPLANATIONS (8 Weather Channels) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Live Sensor Readings & Plain-English Explanations
              </h4>
              <span className="text-[11px] text-slate-400">
                {activeStation.isLiveData ? 'Verified by Live Weather Feed' : 'Updated every 10 minutes'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. Air Temperature */}
              {(() => {
                const s = activeStation.sensors.temperature;
                const exp = getSensorNeatExplanation('temperature', s.currentValue, s.status, activeStation.name);
                const tag = getSensorQuickTag('temperature', s.currentValue);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Thermometer className="w-4 h-4 text-amber-400" />
                          Air Temperature
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">°C</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}

              {/* 2. Relative Humidity */}
              {(() => {
                const s = activeStation.sensors.humidity;
                const exp = getSensorNeatExplanation('humidity', s.currentValue, s.status, activeStation.name);
                const tag = getSensorQuickTag('humidity', s.currentValue);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Droplets className="w-4 h-4 text-cyan-400" />
                          Relative Humidity
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/50 text-cyan-300 border border-cyan-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">%</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}

              {/* 3. Wind Speed */}
              {(() => {
                const s = activeStation.sensors.windSpeed;
                const exp = getSensorNeatExplanation('windSpeed', s.currentValue, s.status, activeStation.name);
                const tag = getSensorQuickTag('windSpeed', s.currentValue);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Wind className="w-4 h-4 text-sky-400" />
                          Wind Speed
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950/50 text-sky-300 border border-sky-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">km/h</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}

              {/* 4. Barometric Pressure */}
              {(() => {
                const s = activeStation.sensors.pressure;
                const exp = getSensorNeatExplanation('pressure', s.currentValue, s.status, activeStation.name);
                const tag = getSensorQuickTag('pressure', s.currentValue);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Gauge className="w-4 h-4 text-indigo-400" />
                          Air Pressure
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/50 text-indigo-300 border border-indigo-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">hPa</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}

              {/* 5. Rainfall */}
              {(() => {
                const s = activeStation.sensors.rainfall;
                const exp = getSensorNeatExplanation('rainfall', s.currentValue, s.status, activeStation.name);
                const tag = getSensorQuickTag('rainfall', s.currentValue);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <CloudRain className="w-4 h-4 text-blue-400" />
                          Rainfall (Precipitation)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950/50 text-blue-300 border border-blue-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue.toFixed(1)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">mm</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}

              {/* 6. Wind Direction */}
              {(() => {
                const s = activeStation.sensors.windDirection;
                return (
                  <div className="p-3.5 rounded-xl border bg-[#050D1A] border-[#132642] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Compass className="w-4 h-4 text-teal-400" />
                          Wind Direction
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-950/50 text-teal-300 border border-teal-800/60">
                          {s.currentValue}° Azimuth
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s.currentValue}°
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400 block mb-0.5">Compass Vane Active</strong>
                      Wind vane oriented freely towards {s.currentValue}° compass heading.
                    </div>
                  </div>
                );
              })()}

              {/* 7. Sunlight / Solar Radiation */}
              {(() => {
                const s = activeStation.sensors.solarRadiation;
                return (
                  <div className="p-3.5 rounded-xl border bg-[#050D1A] border-[#132642] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <Sun className="w-4 h-4 text-amber-300" />
                          Solar Sunshine
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-800/60">
                          Pyranometer
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {s?.currentValue ?? 650}
                        </span>
                        <span className="text-sm font-mono text-slate-400">W/m²</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className="text-emerald-400 block mb-0.5">Clear Daylight</strong>
                      Solar irradiance matches regional daytime insolation.
                    </div>
                  </div>
                );
              })()}

              {/* 8. Auxiliary Battery & Solar Panel Power */}
              {(() => {
                const exp = getSensorNeatExplanation(
                  'batteryVoltage',
                  activeStation.batteryVoltage,
                  activeStation.batteryVoltage < 11.5 ? 'critical' : 'operational',
                  activeStation.name
                );
                const tag = getSensorQuickTag('batteryVoltage', activeStation.batteryVoltage);
                return (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                      exp.isFault ? 'bg-rose-950/30 border-rose-800' : 'bg-[#050D1A] border-[#132642]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-medium text-slate-300">
                          <BatteryCharging className="w-4 h-4 text-emerald-400" />
                          Battery & Power
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/50 text-emerald-300 border border-emerald-800/60">
                          {tag}
                        </span>
                      </div>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold font-mono text-white">
                          {activeStation.batteryVoltage.toFixed(2)}
                        </span>
                        <span className="text-sm font-mono text-slate-400">V</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-[#132642] text-[11px] text-slate-300 leading-relaxed">
                      <strong className={exp.isFault ? 'text-rose-400 block mb-0.5' : 'text-emerald-400 block mb-0.5'}>
                        {exp.title}
                      </strong>
                      {exp.explanation}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ALL WEATHER STATIONS DIRECTORY */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3
              className={`text-base font-bold flex items-center gap-2 ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              <span>Weather Station Directory</span>
              <span className={`text-xs font-normal ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                ({filteredStations.length} stations shown)
              </span>
            </h3>
            <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Click any station to view its live weather and individual sensor explanations.
            </p>
          </div>

          {/* Region Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setRegionFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                regionFilter === 'all'
                  ? theme === 'light'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-cyan-500 text-slate-950'
                  : theme === 'light'
                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
                  : 'bg-[#091526] text-slate-300 hover:text-white border border-[#142845]'
              }`}
            >
              All India ({totalStations})
            </button>
            <button
              onClick={() => setRegionFilter('tamilnadu')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                regionFilter === 'tamilnadu'
                  ? theme === 'light'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-cyan-500 text-slate-950'
                  : theme === 'light'
                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
                  : 'bg-[#091526] text-slate-300 hover:text-white border border-[#142845]'
              }`}
            >
              Tamil Nadu ({tnCount})
            </button>
            <button
              onClick={() => setRegionFilter('national')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                regionFilter === 'national'
                  ? theme === 'light'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-cyan-500 text-slate-950'
                  : theme === 'light'
                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
                  : 'bg-[#091526] text-slate-300 hover:text-white border border-[#142845]'
              }`}
            >
              National Met Hubs
            </button>
            <button
              onClick={() => setRegionFilter('anomalies')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                regionFilter === 'anomalies'
                  ? 'bg-rose-500 text-white'
                  : theme === 'light'
                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
                  : 'bg-[#091526] text-slate-300 hover:text-white border border-[#142845]'
              }`}
            >
              Issues ({totalAnomalies})
            </button>
          </div>
        </div>

        {/* Station Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredStations.map((station) => {
            const isSelected = station.id === activeStation?.id;
            const hasAnomaly = station.activeAnomaliesCount > 0;

            return (
              <div
                key={station.id}
                id={`station-card-${station.id}`}
                onClick={() => onSelectStation(station.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? theme === 'light'
                      ? 'bg-sky-50/70 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                      : 'bg-[#0C223D] border-[#39D5FF] shadow-lg shadow-cyan-950/40 ring-1 ring-[#39D5FF]/40'
                    : hasAnomaly
                    ? theme === 'light'
                      ? 'bg-amber-50/60 border-amber-300 hover:border-amber-400'
                      : 'bg-[#101424] border-amber-900/60 hover:border-amber-600'
                    : theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    : 'bg-[#081426] border-[#142845] hover:border-[#1E4370]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                        theme === 'light'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-[#050D1A] text-cyan-300 border-[#142845]'
                      }`}
                    >
                      {station.code}
                    </span>
                    {getStatusBadge(station.status)}
                  </div>

                  <h4
                    className={`text-sm font-bold mt-2 leading-snug line-clamp-1 ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}
                  >
                    {station.name}
                  </h4>

                  <div
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <MapPin className={`w-3 h-3 shrink-0 ${theme === 'light' ? 'text-sky-600' : 'text-cyan-400'}`} />
                    <span>{station.district}, {station.state}</span>
                  </div>

                  <div className={`text-[11px] mt-0.5 truncate ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {station.zone} • {station.elevationMeters}m MSL
                  </div>
                </div>

                {/* Primary readings preview */}
                <div
                  className={`mt-3 pt-2.5 border-t grid grid-cols-3 gap-1 text-center font-mono ${
                    theme === 'light' ? 'border-slate-100' : 'border-[#132642]'
                  }`}
                >
                  <div
                    className={`p-1.5 rounded ${
                      theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-[#050D1A]'
                    }`}
                  >
                    <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Temp</div>
                    <div className={`text-xs font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      {station.sensors.temperature.currentValue.toFixed(1)}°C
                    </div>
                  </div>
                  <div
                    className={`p-1.5 rounded ${
                      theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-[#050D1A]'
                    }`}
                  >
                    <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>RH</div>
                    <div className={`text-xs font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      {station.sensors.humidity.currentValue.toFixed(0)}%
                    </div>
                  </div>
                  <div
                    className={`p-1.5 rounded ${
                      theme === 'light' ? 'bg-slate-50 border border-slate-100' : 'bg-[#050D1A]'
                    }`}
                  >
                    <div className={`text-[10px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Wind</div>
                    <div className={`text-xs font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                      {station.sensors.windSpeed.currentValue.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs pt-1">
                  <span className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    Health:{' '}
                    <strong className={theme === 'light' ? 'text-slate-800' : 'text-slate-200'}>
                      {station.telemetryHealthPct}%
                    </strong>
                  </span>
                  <span
                    className={`text-[11px] flex items-center gap-0.5 font-semibold ${
                      theme === 'light' ? 'text-sky-700' : 'text-[#39D5FF]'
                    }`}
                  >
                    Inspect <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

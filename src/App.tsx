import React, { useState, useEffect } from 'react';
import {
  Station,
  AnomalyRecord,
  MaintenanceWorkOrder,
  SensorKey,
  DiagnosticResult,
} from './types';
import {
  initialStations,
  initialAnomalies,
  initialMaintenanceOrders,
} from './data/mockStations';
import { runAnomalyScanOnStation } from './utils/anomalyEngine';
import { Navbar } from './components/Navbar';
import { StationOverview } from './components/StationOverview';
import { StationTelemetry } from './components/StationTelemetry';
import { AnomalyDetectionEngine } from './components/AnomalyDetectionEngine';
import { MaintenanceOrders } from './components/MaintenanceOrders';
import { GeminiDiagnosticModal } from './components/GeminiDiagnosticModal';
import {
  fetchBatchLiveWeather,
  fetchLiveWeatherForStation,
  applyLiveWeatherToStation,
  loadLiveStationsCache,
  saveLiveStationsCache,
} from './utils/liveWeatherClient';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<
    'overview' | 'telemetry' | 'anomalies' | 'maintenance'
  >('overview');

  // Immediately hydrate with cached live stations if available so the user never sees stale mock data on opening
  const [stations, setStations] = useState<Station[]>(() => {
    const cached = loadLiveStationsCache();
    return cached && cached.length >= initialStations.length ? cached : initialStations;
  });
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>(initialAnomalies);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>(initialMaintenanceOrders);
  const [selectedStationId, setSelectedStationId] = useState<string>(initialStations[0].id);

  // Gemini diagnostic modal state
  const [diagnosticModalOpen, setDiagnosticModalOpen] = useState(false);
  const [diagnosticStation, setDiagnosticStation] = useState<Station | null>(null);
  const [diagnosticSensorKey, setDiagnosticSensorKey] = useState<SensorKey | null>(null);
  const [diagnosticAnomalyType, setDiagnosticAnomalyType] = useState<string>('');

  // Scanning, live weather & simulator state
  const [isScanning, setIsScanning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [geminiOnline, setGeminiOnline] = useState(true);
  const [isLiveLoading, setIsLiveLoading] = useState(false);
  const [lastLiveSyncTime, setLastLiveSyncTime] = useState<string>('Just now');
  const [isSimpleMode, setIsSimpleMode] = useState(true);

  // Sync live meteorological data for ALL districts and national stations
  const handleSyncLiveWeather = async () => {
    setIsLiveLoading(true);
    try {
      // Query ALL stations (all 38 Tamil Nadu districts + all national met hubs)
      const stationsToQuery = stations.map((s) => ({
        id: s.id,
        lat: s.coordinates.lat,
        lng: s.coordinates.lng,
      }));

      const batchResults = await fetchBatchLiveWeather(stationsToQuery);

      if (Object.keys(batchResults).length > 0) {
        setStations((prev) => {
          const updated = prev.map((station) => {
            const live = batchResults[station.id];
            if (!live) return station;
            return applyLiveWeatherToStation(station, live, true);
          });
          saveLiveStationsCache(updated);
          return updated;
        });
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastLiveSyncTime(timeStr);
      }
    } catch (err) {
      console.warn('Live weather batch sync error:', err);
    } finally {
      setIsLiveLoading(false);
    }
  };

  // Verify server health, immediately fetch live weather on app open, and establish periodic refresh
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setGeminiOnline(Boolean(data.geminiConfigured));
        }
      })
      .catch(() => {
        // Fallback remains operational
      });

    // Auto-fetch real-time live meteorological feed for all districts on opening
    handleSyncLiveWeather();

    // Auto-refresh every 3 minutes to keep live data perpetually accurate
    const autoSyncTimer = setInterval(() => {
      handleSyncLiveWeather();
    }, 3 * 60 * 1000);

    return () => clearInterval(autoSyncTimer);
  }, []);

  // Handle station selection with on-demand live weather fetch
  const handleSelectStation = async (stationId: string) => {
    setSelectedStationId(stationId);
    const target = stations.find((s) => s.id === stationId);
    if (target) {
      try {
        const live = await fetchLiveWeatherForStation(
          target.coordinates.lat,
          target.coordinates.lng
        );
        if (live) {
          setStations((prev) => {
            const updated = prev.map((s) => (s.id === stationId ? applyLiveWeatherToStation(s, live, true) : s));
            saveLiveStationsCache(updated);
            return updated;
          });
        }
      } catch (err) {
        console.warn('Single station live weather fetch error:', err);
      }
    }
  };

  // Periodic Telemetry Simulator
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      handleTelemetryTick();
    }, 4000);

    return () => clearInterval(interval);
  }, [isSimulating]);

  // Telemetry tick updates
  const handleTelemetryTick = () => {
    setStations((prev) =>
      prev.map((station) => {
        const now = new Date();
        const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        // Gentle realistic variation
        const tempVariation = Number((Math.random() * 0.4 - 0.2).toFixed(1));
        const currentTemp = station.sensors.temperature?.currentValue ?? 25.0;
        const currentHum = station.sensors.humidity?.currentValue ?? 60.0;
        const newTemp = Number((currentTemp + tempVariation).toFixed(1));
        const newHum = Math.min(
          100,
          Math.max(15, Number((currentHum - tempVariation * 1.5).toFixed(1)))
        );

        const newPoint = {
          timestamp: now.toISOString(),
          timeLabel,
          temperature: newTemp,
          humidity: newHum,
          pressure: station.sensors.pressure?.currentValue ?? 1013.25,
          windSpeed: station.sensors.windSpeed?.currentValue ?? 12.0,
          windGust: (station.sensors.windSpeed?.currentValue ?? 12.0) + 3.5,
          windDirection: station.sensors.windDirection?.currentValue ?? 180,
          rainfall: station.sensors.rainfall?.currentValue ?? 0.0,
          solarRadiation: station.sensors.solarRadiation?.currentValue ?? 650,
          soilMoisture: station.sensors.soilMoisture?.currentValue ?? 35,
          batteryVoltage: station.batteryVoltage,
          solarPanelPower: station.solarPanelWatts,
          ambientTempPeer: newTemp + (Math.random() * 0.5 - 0.25),
        };

        const updatedHistory = [...station.telemetryHistory.slice(1), newPoint];

        const updatedSensors = {
          ...station.sensors,
        };
        if (updatedSensors.temperature) {
          updatedSensors.temperature = {
            ...updatedSensors.temperature,
            currentValue: newTemp,
          };
        }
        if (updatedSensors.humidity) {
          updatedSensors.humidity = {
            ...updatedSensors.humidity,
            currentValue: newHum,
          };
        }

        return {
          ...station,
          lastPing: 'Just now',
          telemetryHistory: updatedHistory,
          sensors: updatedSensors,
        };
      })
    );
  };

  // Run Global Anomaly Scan
  const handleRunGlobalScan = () => {
    setIsScanning(true);

    setTimeout(() => {
      const newAnomaliesList: AnomalyRecord[] = [...anomalies];
      let newAlertsFound = 0;

      stations.forEach((st) => {
        const peers = stations.filter((p) => p.id !== st.id && st.peerStations.includes(p.id));
        const detected = runAnomalyScanOnStation(st, peers);

        detected.forEach((d) => {
          const exists = newAnomaliesList.some(
            (existing) =>
              existing.stationId === st.id &&
              existing.sensorKey === d.sensorKey &&
              existing.status === 'active'
          );

          if (!exists) {
            newAlertsFound++;
            newAnomaliesList.unshift({
              id: `ANOM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              stationId: st.id,
              stationName: st.name,
              sensorKey: d.sensorKey,
              sensorLabel: st.sensors[d.sensorKey]?.label || d.sensorKey,
              anomalyType: d.anomalyType,
              severity: d.severity,
              detectedAt: new Date().toISOString(),
              observedValue: d.observedValue,
              expectedValue: d.expectedValue,
              unit: d.unit,
              description: d.description,
              qcFlag: d.qcFlag,
              status: 'active',
              algorithm: d.algorithm,
            });
          }
        });
      });

      setAnomalies(newAnomaliesList);

      // Update station active anomaly counts and sensor status flags based on scanned findings
      setStations((prev) =>
        prev.map((st) => {
          const stAnomalies = newAnomaliesList.filter(
            (a) => a.stationId === st.id && a.status === 'active'
          );
          if (stAnomalies.length === 0) return st;

          const updatedSensors = { ...st.sensors };
          stAnomalies.forEach((anom) => {
            const currentSensor = updatedSensors[anom.sensorKey];
            if (currentSensor) {
              updatedSensors[anom.sensorKey] = {
                ...currentSensor,
                status: anom.severity === 'critical' ? 'erroneous' : 'suspect',
                currentValue: anom.observedValue,
              };
            }
          });

          const hasErr = stAnomalies.some((a) => a.severity === 'critical');
          return {
            ...st,
            sensors: updatedSensors,
            activeAnomaliesCount: stAnomalies.length,
            status: hasErr ? 'critical' : 'warning',
            telemetryHealthPct: Math.max(35, 100 - stAnomalies.length * 28),
          };
        })
      );

      setIsScanning(false);
    }, 1200);
  };

  // Synthetic Anomaly Injection from Sandbox
  const handleInjectSyntheticAnomaly = (
    stationId: string,
    sensorKey: SensorKey,
    anomalyType: AnomalyRecord['anomalyType'],
    anomalyLabel: string,
    observedVal: number
  ) => {
    setStations((prev) =>
      prev.map((st) => {
        if (st.id === stationId) {
          const currentSensor = st.sensors[sensorKey];
          const updatedSensors = {
            ...st.sensors,
            ...(currentSensor
              ? {
                  [sensorKey]: {
                    ...currentSensor,
                    currentValue: observedVal,
                    status:
                      anomalyType === 'flatline' || anomalyType === 'power_sag'
                        ? ('erroneous' as const)
                        : ('suspect' as const),
                    healthScore: Math.max(25, (currentSensor.healthScore || 80) - 35),
                  },
                }
              : {}),
          };

          return {
            ...st,
            status: 'warning',
            activeAnomaliesCount: st.activeAnomaliesCount + 1,
            sensors: updatedSensors,
            batteryVoltage: anomalyType === 'power_sag' ? 10.6 : st.batteryVoltage,
          };
        }
        return st;
      })
    );

    const targetStation = stations.find((s) => s.id === stationId);
    if (!targetStation) return;

    const newRecord: AnomalyRecord = {
      id: `ANOM-INJECT-${Date.now()}`,
      stationId,
      stationName: targetStation.name,
      sensorKey,
      sensorLabel: targetStation.sensors[sensorKey]?.label || sensorKey,
      anomalyType,
      severity: anomalyType === 'flatline' || anomalyType === 'power_sag' ? 'critical' : 'high',
      detectedAt: new Date().toISOString(),
      observedValue: observedVal,
      expectedValue: targetStation.sensors[sensorKey]?.currentValue || 0,
      unit: targetStation.sensors[sensorKey]?.unit || '',
      description: anomalyLabel,
      qcFlag: anomalyType === 'flatline' || anomalyType === 'power_sag' ? 'QC2_Erroneous' : 'QC1_Suspect',
      status: 'active',
      algorithm: anomalyType === 'drift' ? 'Spatial Peer Correlation' : 'Z-Score / IQR',
    };

    setAnomalies((prev) => [newRecord, ...prev]);
  };

  // Open Diagnostic Modal
  const handleOpenDiagnostic = (
    station: Station,
    sensorKey: SensorKey,
    anomalyType: string
  ) => {
    setDiagnosticStation(station);
    setDiagnosticSensorKey(sensorKey);
    setDiagnosticAnomalyType(anomalyType);
    setDiagnosticModalOpen(true);
  };

  // Create Work Order from Diagnosis
  const handleCreateWorkOrderFromDiagnosis = (
    station: Station,
    sensorKey: SensorKey,
    diagnosis: DiagnosticResult
  ) => {
    const newOrder: MaintenanceWorkOrder = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      ticketNumber: `AWS-TK-${Math.floor(1000 + Math.random() * 9000)}`,
      stationId: station.id,
      stationName: station.name,
      sensorKey,
      issueTitle: `${diagnosis.failureClassification}: ${diagnosis.rootCause}`,
      severity: (diagnosis.severity?.toLowerCase() as any) || 'high',
      status: 'dispatched',
      technicianName: 'Regional AWS Maintenance Cell Lead',
      createdAt: new Date().toISOString(),
      targetResolutionDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      spareParts: diagnosis.recommendedSpareParts || ['Sensor replacement kit'],
      fieldNotes: diagnosis.immediateAction,
      wmoFlag: (diagnosis.wmoQcFlag as any) || 'QC1_Suspect',
    };

    setWorkOrders((prev) => [newOrder, ...prev]);
    setActiveTab('maintenance');
  };

  // Create Work Order from Anomaly Item
  const handleCreateWorkOrderFromAnomaly = (anomaly: AnomalyRecord) => {
    const newOrder: MaintenanceWorkOrder = {
      id: `WO-${Date.now().toString().slice(-4)}`,
      ticketNumber: `AWS-TK-${Math.floor(1000 + Math.random() * 9000)}`,
      stationId: anomaly.stationId,
      stationName: anomaly.stationName,
      sensorKey: anomaly.sensorKey,
      issueTitle: `${anomaly.sensorLabel}: ${anomaly.anomalyType.toUpperCase()} Anomaly Investigation`,
      severity: anomaly.severity,
      status: 'dispatched',
      technicianName: 'Designated Field Technician',
      createdAt: new Date().toISOString(),
      targetResolutionDate: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
      spareParts: ['Sensor Clean Pack', 'Multimeter', 'Reference Probe'],
      fieldNotes: anomaly.description,
      wmoFlag: anomaly.qcFlag,
    };

    setWorkOrders((prev) => [newOrder, ...prev]);
    setActiveTab('maintenance');
  };

  // Update Work Order Status
  const handleUpdateOrderStatus = (orderId: string, status: MaintenanceWorkOrder['status']) => {
    setWorkOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status } : order))
    );
  };

  const currentStation =
    stations.find((s) => s.id === selectedStationId) || stations[0];

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-[#F4F6F9] text-[#0F172A] selection:bg-cyan-500/20 selection:text-cyan-800'
          : 'bg-[#050D1A] text-[#F3F8FC] selection:bg-[#39D5FF]/20 selection:text-[#39D5FF]'
      }`}
    >
      {/* Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeAnomaliesCount={anomalies.filter((a) => a.status === 'active').length}
        onRunGlobalScan={handleRunGlobalScan}
        isScanning={isScanning}
        geminiOnline={geminiOnline}
        workOrders={workOrders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        isSimpleMode={isSimpleMode}
        onToggleSimpleMode={() => setIsSimpleMode((prev) => !prev)}
        isLiveLoading={isLiveLoading}
        onRefreshLiveWeather={handleSyncLiveWeather}
        lastLiveSyncTime={lastLiveSyncTime}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 space-y-6">
        {activeTab === 'overview' && (
          <StationOverview
            stations={stations}
            anomalies={anomalies}
            selectedStationId={selectedStationId}
            onSelectStation={handleSelectStation}
            onNavigateToTelemetry={(id) => {
              handleSelectStation(id);
              setActiveTab('telemetry');
            }}
            onOpenDiagnosticModal={handleOpenDiagnostic}
            isSimpleMode={isSimpleMode}
            onToggleSimpleMode={() => setIsSimpleMode((prev) => !prev)}
            lastLiveSyncTime={lastLiveSyncTime}
            isLiveLoading={isLiveLoading}
            onRefreshLiveWeather={handleSyncLiveWeather}
          />
        )}

        {activeTab === 'telemetry' && (
          <StationTelemetry
            station={currentStation}
            allStations={stations}
            onSelectStation={setSelectedStationId}
            onOpenDiagnosticModal={handleOpenDiagnostic}
            onTickSimulation={handleTelemetryTick}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
          />
        )}

        {activeTab === 'anomalies' && (
          <AnomalyDetectionEngine
            anomalies={anomalies}
            stations={stations}
            onOpenDiagnosticModal={handleOpenDiagnostic}
            onCreateWorkOrder={handleCreateWorkOrderFromAnomaly}
            onInjectSyntheticAnomaly={handleInjectSyntheticAnomaly}
          />
        )}

        {activeTab === 'maintenance' && (
          <MaintenanceOrders
            orders={workOrders}
            stations={stations}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onCreateManualOrder={(order) => {
              const newOrder: MaintenanceWorkOrder = {
                ...order,
                id: `WO-${Date.now().toString().slice(-4)}`,
                ticketNumber: `AWS-TK-${Math.floor(1000 + Math.random() * 9000)}`,
                createdAt: new Date().toISOString(),
              };
              setWorkOrders((prev) => [newOrder, ...prev]);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-4 px-6 text-center text-xs transition-colors duration-200 ${
          theme === 'light'
            ? 'border-slate-200 bg-white text-slate-500 shadow-sm'
            : 'border-[#0F1E33] bg-[#030812] text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>WeatherGuard AI • AWS Intelligent Anomaly Detection & Predictive Maintenance Platform</span>
          <span
            className={`font-mono text-[11px] ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            IMD Observational Quality Standards • Operational AWS Telemetry
          </span>
        </div>
      </footer>

      {/* Gemini AI Diagnostic Modal */}
      <GeminiDiagnosticModal
        isOpen={diagnosticModalOpen}
        onClose={() => setDiagnosticModalOpen(false)}
        station={diagnosticStation}
        sensorKey={diagnosticSensorKey}
        anomalyType={diagnosticAnomalyType}
        onCreateWorkOrderFromDiagnosis={handleCreateWorkOrderFromDiagnosis}
      />
    </div>
  );
}

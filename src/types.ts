export type StationStatus = 'operational' | 'warning' | 'critical' | 'offline' | 'calibrating';

export type CoreSensorKey =
  | 'temperature'
  | 'humidity'
  | 'pressure'
  | 'windSpeed'
  | 'windDirection'
  | 'rainfall'
  | 'solarRadiation'
  | 'soilMoisture';

export type SensorKey = CoreSensorKey | 'batteryVoltage';

export type AnomalyType =
  | 'spike'
  | 'drift'
  | 'flatline'
  | 'cross_conflict'
  | 'biofouling'
  | 'power_sag'
  | 'sensor_disconnect';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type WmoQcFlag = 'QC0_Valid' | 'QC1_Suspect' | 'QC2_Erroneous' | 'QC3_Missing';

export interface SensorMetadata {
  key: SensorKey;
  label: string;
  unit: string;
  model: string;
  nominalMin: number;
  nominalMax: number;
  currentValue: number;
  status: 'normal' | 'operational' | 'suspect' | 'erroneous';
  healthScore: number; // 0 - 100
  lastCalibrated: string;
  nextCalibrationDue: string;
  iconName?: string;
}

export interface AnomalyRecord {
  id: string;
  stationId: string;
  stationName: string;
  sensorKey: SensorKey;
  sensorLabel: string;
  anomalyType: AnomalyType;
  severity: Severity;
  detectedAt: string;
  observedValue: number;
  expectedValue: number;
  unit: string;
  description: string;
  qcFlag: WmoQcFlag;
  status: 'active' | 'investigating' | 'resolved';
  algorithm:
    | 'Z-Score / IQR'
    | 'Physical Limit'
    | 'Spatial Peer Correlation'
    | 'Isolation Forest'
    | 'Multi-Sensor Inconsistency'
    | 'Deadband Flatline Test'
    | 'Cross-Sensor Physical Law Inconsistency';
  resolvedAt?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  timeLabel: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  rainfall: number;
  solarRadiation: number;
  soilMoisture: number;
  batteryVoltage: number;
  solarPanelPower: number;
  ambientTempPeer?: number;
  hasAnomaly?: boolean;
  anomalyNote?: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  district: string;
  state: string;
  region: string;
  zone: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  elevationMeters: number;
  status: StationStatus;
  lastPing: string;
  batteryVoltage: number;
  solarPanelWatts: number;
  signalStrengthDbm: number;
  telemetryHealthPct: number;
  activeAnomaliesCount: number;
  sensors: Record<CoreSensorKey, SensorMetadata> & {
    batteryVoltage?: SensorMetadata;
  };
  telemetryHistory: TelemetryPoint[];
  peerStations: string[];
  isLiveData?: boolean;
  lastLiveFetch?: string;
}

export interface MaintenanceWorkOrder {
  id: string;
  ticketNumber: string;
  stationId: string;
  stationName: string;
  sensorKey: SensorKey;
  issueTitle: string;
  severity: Severity;
  status: 'open' | 'dispatched' | 'in_progress' | 'resolved';
  technicianName: string;
  createdAt: string;
  targetResolutionDate: string;
  spareParts: string[];
  fieldNotes?: string;
  wmoFlag: WmoQcFlag;
}

export interface DiagnosticResult {
  failureClassification: string;
  rootCause: string;
  scientificExplanation: string;
  severity: Severity | string;
  confidence: number;
  isTrueWeatherEvent?: boolean;
  wmoQcFlag: string;
  immediateAction: string;
  fieldInspectionSteps: string[];
  recommendedSpareParts: string[];
  preventiveAdvice: string;
}

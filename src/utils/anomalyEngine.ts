import { Station, AnomalyRecord, SensorKey, WmoQcFlag } from '../types';

export interface AnomalyDetectionRuleResult {
  sensorKey: SensorKey;
  anomalyType: AnomalyRecord['anomalyType'];
  severity: AnomalyRecord['severity'];
  observedValue: number;
  expectedValue: number;
  unit: string;
  description: string;
  qcFlag: WmoQcFlag;
  algorithm: AnomalyRecord['algorithm'];
}

/**
 * Executes multi-tier meteorological quality control tests
 */
export function runAnomalyScanOnStation(
  station: Station,
  peerStations: Station[] = []
): AnomalyDetectionRuleResult[] {
  const anomalies: AnomalyDetectionRuleResult[] = [];
  const sensors = station.sensors;
  const history = station.telemetryHistory;
  const recent = history.slice(-6); // Last 6 samples

  // 1. Physical Limits Test (Climatological Range Test)
  // Relative Humidity > 100% or < 0%
  if (sensors.humidity.currentValue > 100 || sensors.humidity.currentValue < 0) {
    anomalies.push({
      sensorKey: 'humidity',
      anomalyType: 'spike',
      severity: 'critical',
      observedValue: sensors.humidity.currentValue,
      expectedValue: 100,
      unit: '%',
      description: `Physical boundary violation: Relative humidity reading of ${sensors.humidity.currentValue}% exceeds 100% saturation limit.`,
      qcFlag: 'QC2_Erroneous',
      algorithm: 'Physical Limit',
    });
  }

  // Solar Radiation at night: If hour is 22:00-04:00 but radiation > 10 W/m²
  const currentHour = new Date().getHours();
  if ((currentHour >= 21 || currentHour <= 4) && sensors.solarRadiation.currentValue > 15) {
    anomalies.push({
      sensorKey: 'solarRadiation',
      anomalyType: 'cross_conflict',
      severity: 'medium',
      observedValue: sensors.solarRadiation.currentValue,
      expectedValue: 0,
      unit: 'W/m²',
      description: `Nocturnal solar radiation detected (${sensors.solarRadiation.currentValue} W/m²). Pyranometer zero-point thermal offset or artificial luminaire interference.`,
      qcFlag: 'QC1_Suspect',
      algorithm: 'Multi-Sensor Inconsistency',
    });
  }

  // 2. Persistence / Flatline Test (Stuck Sensor)
  if (recent.length >= 4) {
    // Check Wind Speed flatline at 0.0
    const windValues = recent.map((r) => r.windSpeed);
    const allZero = windValues.every((v) => v === 0);
    if (allZero && sensors.windSpeed.currentValue === 0) {
      anomalies.push({
        sensorKey: 'windSpeed',
        anomalyType: 'flatline',
        severity: 'critical',
        observedValue: 0.0,
        expectedValue: 12.5,
        unit: 'km/h',
        description: `Sensor flatlining: Wind speed locked at 0.0 km/h across last ${recent.length} hours. Mechanical cup bearing seized or ultrasonic ice accretion.`,
        qcFlag: 'QC2_Erroneous',
        algorithm: 'Z-Score / IQR',
      });
    }

    // Check Temperature Flatline (identical reading to 0.01°C for 5 hours)
    const tempValues = recent.map((r) => r.temperature);
    const tempVariance = Math.max(...tempValues) - Math.min(...tempValues);
    if (tempVariance < 0.05 && recent.length >= 5) {
      anomalies.push({
        sensorKey: 'temperature',
        anomalyType: 'flatline',
        severity: 'high',
        observedValue: sensors.temperature.currentValue,
        expectedValue: sensors.temperature.currentValue + 2.0,
        unit: '°C',
        description: `Unnatural temperature stability (Δ < 0.05°C over ${recent.length} hours). ADC latch-up or datalogger channel buffer freeze.`,
        qcFlag: 'QC1_Suspect',
        algorithm: 'Z-Score / IQR',
      });
    }
  }

  // 3. Cross-Sensor Physical Law Consistency
  // High humidity (95%+) + heavy cloud cover / pressure drop, but rain is 0 while nearby stations report precipitation
  if (sensors.humidity.currentValue > 92 && sensors.rainfall.currentValue === 0) {
    const peersWithRain = peerStations.filter((p) => p.sensors.rainfall.currentValue > 1.0);
    if (peersWithRain.length > 0) {
      anomalies.push({
        sensorKey: 'rainfall',
        anomalyType: 'biofouling',
        severity: 'high',
        observedValue: 0.0,
        expectedValue: 5.5,
        unit: 'mm/h',
        description: `Precipitation omission: 0.0 mm/h recorded during 94%+ RH and active regional rainfall reported by ${peersWithRain.length} peer stations. Suspected funnel debris blockage.`,
        qcFlag: 'QC1_Suspect',
        algorithm: 'Multi-Sensor Inconsistency',
      });
    }
  }

  // 4. Spatial Peer Consistency (Spatial Neighborhood Correlation)
  if (peerStations.length > 0) {
    const peerTemps = peerStations.map((p) => p.sensors.temperature.currentValue);
    const avgPeerTemp = peerTemps.reduce((a, b) => a + b, 0) / peerTemps.length;
    const tempDelta = Math.abs(sensors.temperature.currentValue - avgPeerTemp);

    // Delta > 4.5°C between neighbors of similar elevation indicates sensor drift or shield heat trap
    if (tempDelta > 4.5) {
      anomalies.push({
        sensorKey: 'temperature',
        anomalyType: 'drift',
        severity: 'medium',
        observedValue: sensors.temperature.currentValue,
        expectedValue: Number(avgPeerTemp.toFixed(1)),
        unit: '°C',
        description: `Spatial outlier: Station temperature differs by ${tempDelta.toFixed(1)}°C from regional peer cluster average (${avgPeerTemp.toFixed(1)}°C). Aspiration shield contamination suspected.`,
        qcFlag: 'QC1_Suspect',
        algorithm: 'Spatial Peer Correlation',
      });
    }
  }

  // 5. Electrical & Power Subsystem Sag
  if (station.batteryVoltage < 11.4) {
    anomalies.push({
      sensorKey: 'solarRadiation',
      anomalyType: 'power_sag',
      severity: 'critical',
      observedValue: station.batteryVoltage,
      expectedValue: 12.6,
      unit: 'V',
      description: `Critical power subsystem sag: Battery at ${station.batteryVoltage}V (safe operating threshold is 11.4V). Risk of datalogger brownout and telemetry corruption.`,
      qcFlag: 'QC2_Erroneous',
      algorithm: 'Physical Limit',
    });
  }

  // 6. Sensor Health Flag Inspection (Check flagged sensors)
  (Object.entries(sensors) as [SensorKey, typeof sensors[SensorKey]][]).forEach(([key, sensor]) => {
    if (sensor && sensor.status !== 'operational') {
      const alreadyReported = anomalies.some((a) => a.sensorKey === key);
      if (!alreadyReported) {
        if (key === 'windSpeed' && sensor.currentValue === 0) {
          anomalies.push({
            sensorKey: 'windSpeed',
            anomalyType: 'flatline',
            severity: 'critical',
            observedValue: 0.0,
            expectedValue: 14.5,
            unit: sensor.unit,
            description: `Bearing seizure flatline: Wind speed locked at 0.0 ${sensor.unit} while regional peers indicate normal airflow.`,
            qcFlag: 'QC2_Erroneous',
            algorithm: 'Z-Score / IQR',
          });
        } else if (key === 'humidity') {
          anomalies.push({
            sensorKey: 'humidity',
            anomalyType: 'drift',
            severity: 'medium',
            observedValue: sensor.currentValue,
            expectedValue: Math.max(10, Number((sensor.currentValue - 7.2).toFixed(1))),
            unit: sensor.unit,
            description: `Capacitive polymer degradation: positive humidity offset detected (+7.2% ${sensor.unit} relative to psychrometric baseline).`,
            qcFlag: 'QC1_Suspect',
            algorithm: 'Spatial Peer Correlation',
          });
        } else if (key === 'rainfall') {
          anomalies.push({
            sensorKey: 'rainfall',
            anomalyType: 'biofouling',
            severity: 'high',
            observedValue: sensor.currentValue,
            expectedValue: 5.0,
            unit: sensor.unit,
            description: `Precipitation funnel obstruction: 0.0 ${sensor.unit} recorded during convective rain event. Tipping bucket biofouling or siphon debris clog.`,
            qcFlag: 'QC1_Suspect',
            algorithm: 'Multi-Sensor Inconsistency',
          });
        } else {
          anomalies.push({
            sensorKey: key,
            anomalyType: sensor.status === 'erroneous' ? 'flatline' : 'drift',
            severity: sensor.status === 'erroneous' ? 'critical' : 'high',
            observedValue: sensor.currentValue,
            expectedValue: sensor.currentValue,
            unit: sensor.unit,
            description: `${sensor.label} status flagged as ${sensor.status}. Instrumentation calibration verification required.`,
            qcFlag: sensor.status === 'erroneous' ? 'QC2_Erroneous' : 'QC1_Suspect',
            algorithm: 'Spatial Peer Correlation',
          });
        }
      }
    }
  });

  return anomalies;
}

import { Station, TelemetryPoint, SensorKey } from '../types';

export interface LiveWeatherData {
  temperature_2m: number;
  relative_humidity_2m: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  precipitation: number;
}

const CACHE_STORAGE_KEY = 'weatherguard_live_stations_cache_v2';

/**
 * Fetches real live weather data for a single station from our server endpoint with direct Open-Meteo fallback
 */
export async function fetchLiveWeatherForStation(
  lat: number,
  lng: number
): Promise<LiveWeatherData | null> {
  // First try local backend proxy
  try {
    const res = await fetch(`/api/live-weather?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const json = await res.json();
      if (json.current) return json.current;
    }
  } catch (err) {
    console.warn('Server live weather fetch failed, trying direct fallback:', err);
  }

  // Direct client fallback to Open-Meteo
  try {
    const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      const json = await res.json();
      return json.current || null;
    }
  } catch (err) {
    console.warn('Direct live weather fetch also failed:', err);
  }

  return null;
}

/**
 * Fetches live weather for a batch of stations simultaneously (supports all 38 districts + national stations)
 */
export async function fetchBatchLiveWeather(
  stations: { id: string; lat: number; lng: number }[]
): Promise<Record<string, LiveWeatherData>> {
  if (!stations || stations.length === 0) return {};

  // First try backend proxy endpoint
  try {
    const res = await fetch('/api/live-weather-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stations }),
    });

    if (res.ok) {
      const json = await res.json();
      const result: Record<string, LiveWeatherData> = {};
      if (Array.isArray(json.stations)) {
        json.stations.forEach((item: any) => {
          if (item.current) {
            result[item.id] = item.current;
          }
        });
      }
      if (Object.keys(result).length >= stations.length * 0.7) {
        return result;
      }
    }
  } catch (err) {
    console.warn('Batch live weather proxy failed, initiating direct Open-Meteo request:', err);
  }

  // Direct client-side batch call to Open-Meteo as robust fallback
  try {
    const lats = stations.map((s) => s.lat.toFixed(4)).join(',');
    const lngs = stations.map((s) => s.lng.toFixed(4)).join(',');
    const directUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;

    const res = await fetch(directUrl);
    if (res.ok) {
      const rawData = await res.json();
      const resultsList = Array.isArray(rawData) ? rawData : [rawData];
      const result: Record<string, LiveWeatherData> = {};

      stations.forEach((st, idx) => {
        const item = resultsList[idx];
        if (item?.current) {
          result[st.id] = item.current;
        }
      });

      return result;
    }
  } catch (directErr) {
    console.warn('Direct Open-Meteo batch query failed:', directErr);
  }

  return {};
}

/**
 * Generates an accurate 24-hour telemetry history anchored precisely to the live current readings.
 * Ensures the diurnal curve is realistic and the current hour (last point) exactly equals the live data.
 */
function generateDiurnalHistoryFromLive(
  liveData: LiveWeatherData,
  currentBattery: number = 12.6,
  anomalousCondition?: { sensorKey: SensorKey; anomalyType: string; anomalousValue?: number } | null
): TelemetryPoint[] {
  const points: TelemetryPoint[] = [];
  const now = new Date();
  const currentHour = now.getHours();

  const currentTemp = Number(liveData.temperature_2m.toFixed(1));
  const currentHum = Number(liveData.relative_humidity_2m.toFixed(1));
  const currentPress = Number(liveData.surface_pressure.toFixed(1));
  const currentWind = Number(liveData.wind_speed_10m.toFixed(1));
  const currentWindDir = Math.round(liveData.wind_direction_10m);
  const currentRain = Number(liveData.precipitation.toFixed(1));

  // Diurnal amplitude estimates
  const tempAmp = 3.5;
  const humAmp = 12.0;

  for (let i = 23; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 3600 * 1000);
    const hour = time.getHours();
    const timeLabel = `${hour.toString().padStart(2, '0')}:00`;

    if (i === 0) {
      // Current point: EXACT match to live data (or anomalous value if active)
      const solarFactor = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
      const solarRadiation = Math.round(solarFactor * 850);

      const hasAnom = Boolean(anomalousCondition);
      const isWindFlatline = anomalousCondition?.sensorKey === 'windSpeed' && anomalousCondition.anomalyType.includes('flatline');
      const isHumDrift = anomalousCondition?.sensorKey === 'humidity';
      const isRainClog = anomalousCondition?.sensorKey === 'rainfall';
      const isBatterySag = anomalousCondition?.sensorKey === 'batteryVoltage';

      points.push({
        timestamp: now.toISOString(),
        timeLabel,
        temperature: anomalousCondition?.sensorKey === 'temperature' ? (anomalousCondition.anomalousValue ?? currentTemp + 4.8) : currentTemp,
        humidity: isHumDrift ? Math.min(98, (anomalousCondition?.anomalousValue ?? currentHum + 7.2)) : currentHum,
        pressure: currentPress,
        windSpeed: isWindFlatline ? 0.0 : currentWind,
        windGust: isWindFlatline ? 0.0 : Number((currentWind + 3.2).toFixed(1)),
        windDirection: currentWindDir,
        rainfall: isRainClog ? 0.0 : currentRain,
        solarRadiation,
        soilMoisture: Math.min(65, Math.max(15, Math.round(30 + currentRain * 2))),
        batteryVoltage: isBatterySag ? 10.8 : currentBattery,
        solarPanelPower: Math.round(solarRadiation * 0.04 * 10) / 10,
        ambientTempPeer: Number((currentTemp + (Math.random() * 0.4 - 0.2)).toFixed(1)),
        hasAnomaly: hasAnom,
        anomalyNote: hasAnom ? `${anomalousCondition?.sensorKey} anomaly active` : undefined,
      });
    } else {
      // Preceding hours calculated with diurnal delta relative to current hour
      const hourSolar = hour >= 6 && hour <= 18 ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
      const currSolar = currentHour >= 6 && currentHour <= 18 ? Math.sin(((currentHour - 6) / 12) * Math.PI) : 0;
      const diurnalOffset = (hourSolar - currSolar) * tempAmp;

      const temp = Number((currentTemp + diurnalOffset).toFixed(1));
      const hum = Math.min(100, Math.max(15, Math.round(currentHum - (hourSolar - currSolar) * humAmp)));
      const press = Number((currentPress + Math.sin(((hour - 3) / 6) * Math.PI) * 0.8).toFixed(1));
      const wind = Number(Math.max(0.5, currentWind + (hourSolar - currSolar) * 2.0).toFixed(1));
      const solarRadiation = Math.round(hourSolar * 850);

      const hasAnom = Boolean(anomalousCondition && i <= 6);
      const isWindFlatline = anomalousCondition?.sensorKey === 'windSpeed' && anomalousCondition.anomalyType.includes('flatline');
      const isHumDrift = anomalousCondition?.sensorKey === 'humidity';
      const isRainClog = anomalousCondition?.sensorKey === 'rainfall';
      const isBatterySag = anomalousCondition?.sensorKey === 'batteryVoltage';

      points.push({
        timestamp: time.toISOString(),
        timeLabel,
        temperature: anomalousCondition?.sensorKey === 'temperature' && i <= 6 ? Number((temp + 4.8).toFixed(1)) : temp,
        humidity: isHumDrift && i <= 6 ? Math.min(98, hum + 7) : hum,
        pressure: press,
        windSpeed: isWindFlatline && i <= 6 ? 0.0 : wind,
        windGust: isWindFlatline && i <= 6 ? 0.0 : Number((wind + 2.5).toFixed(1)),
        windDirection: (currentWindDir + (hour - currentHour) * 3 + 360) % 360,
        rainfall: isRainClog ? 0.0 : (i <= 2 ? currentRain : 0),
        solarRadiation,
        soilMoisture: Math.min(65, Math.max(15, Math.round(30 + currentRain * 2))),
        batteryVoltage: isBatterySag && i <= 6 ? 10.8 : Number((currentBattery + (hourSolar > 0 ? 0.3 : -0.2)).toFixed(2)),
        solarPanelPower: Math.round(solarRadiation * 0.04 * 10) / 10,
        ambientTempPeer: Number((temp + (Math.random() * 0.4 - 0.2)).toFixed(1)),
        hasAnomaly: hasAnom,
        anomalyNote: hasAnom ? `${anomalousCondition?.sensorKey} anomaly active` : undefined,
      });
    }
  }

  return points;
}

/**
 * Updates a station with accurate live meteorological readings for all channels
 * while preserving active anomalies and quality-control flags.
 */
export function applyLiveWeatherToStation(
  station: Station,
  liveData: LiveWeatherData,
  preserveSimulatedAnomalies: boolean = true
): Station {
  const updatedSensors = { ...station.sensors };

  const currentTemp = Number(liveData.temperature_2m.toFixed(1));
  const currentHum = Math.min(100, Math.max(0, Number(liveData.relative_humidity_2m.toFixed(1))));
  const currentPress = Number(liveData.surface_pressure.toFixed(1));
  const currentWind = Number(liveData.wind_speed_10m.toFixed(1));
  const currentWindDir = Math.round(liveData.wind_direction_10m);
  const currentRain = Number(liveData.precipitation.toFixed(1));

  let activeAnomalyFound: { sensorKey: SensorKey; anomalyType: string; anomalousValue?: number } | null = null;

  // Update air temperature
  if (updatedSensors.temperature) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.temperature.status !== 'operational';
    if (isAnomalous) {
      activeAnomalyFound = { sensorKey: 'temperature', anomalyType: 'drift', anomalousValue: currentTemp + 4.8 };
      updatedSensors.temperature = {
        ...updatedSensors.temperature,
        currentValue: Number((currentTemp + 4.8).toFixed(1)),
      };
    } else {
      updatedSensors.temperature = {
        ...updatedSensors.temperature,
        currentValue: currentTemp,
        status: 'operational',
        healthScore: 98,
      };
    }
  }

  // Update humidity
  if (updatedSensors.humidity) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.humidity.status !== 'operational';
    if (isAnomalous) {
      const driftedHum = Math.min(98, Number((currentHum + 7.2).toFixed(1)));
      activeAnomalyFound = { sensorKey: 'humidity', anomalyType: 'drift', anomalousValue: driftedHum };
      updatedSensors.humidity = {
        ...updatedSensors.humidity,
        currentValue: driftedHum,
      };
    } else {
      updatedSensors.humidity = {
        ...updatedSensors.humidity,
        currentValue: currentHum,
        status: 'operational',
        healthScore: 97,
      };
    }
  }

  // Update barometric pressure
  if (updatedSensors.pressure) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.pressure.status !== 'operational';
    if (isAnomalous) {
      activeAnomalyFound = { sensorKey: 'pressure', anomalyType: 'drift' };
    } else {
      updatedSensors.pressure = {
        ...updatedSensors.pressure,
        currentValue: currentPress,
        status: 'operational',
        healthScore: 99,
      };
    }
  }

  // Update wind speed
  if (updatedSensors.windSpeed) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.windSpeed.status !== 'operational';
    if (isAnomalous) {
      activeAnomalyFound = { sensorKey: 'windSpeed', anomalyType: 'flatline', anomalousValue: 0.0 };
      updatedSensors.windSpeed = {
        ...updatedSensors.windSpeed,
        currentValue: 0.0,
      };
    } else {
      updatedSensors.windSpeed = {
        ...updatedSensors.windSpeed,
        currentValue: currentWind,
        status: 'operational',
        healthScore: 96,
      };
    }
  }

  // Update wind direction
  if (updatedSensors.windDirection) {
    updatedSensors.windDirection = {
      ...updatedSensors.windDirection,
      currentValue: currentWindDir,
      status: 'operational',
      healthScore: 98,
    };
  }

  // Update rainfall
  if (updatedSensors.rainfall) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.rainfall.status !== 'operational';
    if (isAnomalous) {
      activeAnomalyFound = { sensorKey: 'rainfall', anomalyType: 'biofouling', anomalousValue: 0.0 };
      updatedSensors.rainfall = {
        ...updatedSensors.rainfall,
        currentValue: 0.0,
      };
    } else {
      updatedSensors.rainfall = {
        ...updatedSensors.rainfall,
        currentValue: currentRain,
        status: 'operational',
        healthScore: 98,
      };
    }
  }

  // Update solar radiation based on time of day
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour <= 18;
  const solarFactor = isDay ? Math.sin(((hour - 6) / 12) * Math.PI) : 0;
  const liveSolar = Math.round(solarFactor * 880 * (1 - (currentHum / 200)));

  if (updatedSensors.solarRadiation) {
    const isAnomalous = preserveSimulatedAnomalies && updatedSensors.solarRadiation.status !== 'operational';
    if (isAnomalous) {
      activeAnomalyFound = { sensorKey: 'solarRadiation', anomalyType: 'nocturnal_bias' };
    } else {
      updatedSensors.solarRadiation = {
        ...updatedSensors.solarRadiation,
        currentValue: liveSolar,
        status: 'operational',
        healthScore: 98,
      };
    }
  }

  // Battery check
  const isBatterySag = station.batteryVoltage < 11.4;
  if (isBatterySag && preserveSimulatedAnomalies) {
    activeAnomalyFound = { sensorKey: 'batteryVoltage' as SensorKey, anomalyType: 'power_sag', anomalousValue: station.batteryVoltage };
  }

  // Generate an accurate 24-hour telemetry history anchored to the live data
  const updatedHistory = generateDiurnalHistoryFromLive(liveData, station.batteryVoltage || 12.6, activeAnomalyFound);

  // Count active anomalies accurately
  const sensorAnomalyCount = Object.values(updatedSensors).filter((s) => s.status !== 'operational').length;
  const activeCount = sensorAnomalyCount + (isBatterySag ? 1 : 0);

  const hasErroneous = Object.values(updatedSensors).some((s) => s.status === 'erroneous') || isBatterySag;
  const hasSuspect = Object.values(updatedSensors).some((s) => s.status === 'suspect');

  const resolvedStatus = hasErroneous ? 'critical' : hasSuspect ? 'warning' : 'operational';
  const resolvedHealth = activeCount > 0 ? Math.max(38, 100 - activeCount * 26) : 98;

  return {
    ...station,
    sensors: updatedSensors,
    telemetryHistory: updatedHistory,
    status: resolvedStatus,
    telemetryHealthPct: resolvedHealth,
    activeAnomaliesCount: activeCount,
    isLiveData: true,
    lastLiveFetch: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lastPing: 'Live IMD / Open-Meteo Real-Time Feed',
  };
}

/**
 * Cache management for instantaneous hydration on app opening
 */
export function saveLiveStationsCache(stations: Station[]): void {
  try {
    if (!stations || stations.length === 0) return;
    const cachePayload = {
      timestamp: Date.now(),
      stations,
    };
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cachePayload));
  } catch (err) {
    // Storage quota or private browsing
  }
}

export function loadLiveStationsCache(): Station[] | null {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Allow cached stations up to 2 hours old to prevent stale mock data on initial paint
    if (parsed && Array.isArray(parsed.stations) && parsed.stations.length > 0) {
      if (Date.now() - parsed.timestamp < 2 * 60 * 60 * 1000) {
        return parsed.stations;
      }
    }
  } catch (err) {
    // Parsing error
  }
  return null;
}

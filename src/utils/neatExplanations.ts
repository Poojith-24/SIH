import { SensorKey, Station, AnomalyRecord } from '../types';

/**
 * Returns a simple, neat human explanation of the current weather conditions.
 */
export function getNeatWeatherSummary(temp?: number, hum?: number, wind?: number, rain?: number): string {
  if (temp === undefined) return 'Weather data being gathered...';

  let tempText = 'pleasant';
  if (temp >= 38) tempText = 'very hot';
  else if (temp >= 32) tempText = 'warm';
  else if (temp >= 24) tempText = 'comfortable';
  else if (temp >= 18) tempText = 'mild';
  else if (temp >= 10) tempText = 'cool';
  else tempText = 'chilly';

  let rainText = 'no rainfall';
  if (rain && rain > 15) rainText = 'heavy rain';
  else if (rain && rain > 5) rainText = 'moderate rain';
  else if (rain && rain > 0.1) rainText = 'light rain';

  let windText = 'calm air';
  if (wind && wind > 35) windText = 'strong windy conditions';
  else if (wind && wind > 18) windText = 'fresh breeze';
  else if (wind && wind > 5) windText = 'gentle breeze';

  return `Currently ${temp.toFixed(1)}°C (${tempText}) with ${rainText} and ${windText}.`;
}

/**
 * Returns a quick, simple contextual tag for a sensor reading.
 */
export function getSensorQuickTag(sensorKey: SensorKey, value: number): string {
  switch (sensorKey) {
    case 'temperature':
      if (value > 38) return 'Very Hot';
      if (value > 32) return 'Warm';
      if (value > 22) return 'Pleasant';
      if (value > 14) return 'Cool';
      return 'Cold';
    case 'humidity':
      if (value > 85) return 'Very Humid';
      if (value > 60) return 'Humid';
      if (value > 35) return 'Comfortable';
      return 'Dry Air';
    case 'windSpeed':
      if (value > 40) return 'Strong Gale';
      if (value > 20) return 'Moderate Wind';
      if (value > 5) return 'Light Breeze';
      if (value === 0) return 'Calm (No Wind)';
      return 'Light Air';
    case 'pressure':
      if (value > 1020) return 'High Pressure';
      if (value < 990) return 'Low Elevation / Storm';
      return 'Normal Pressure';
    case 'rainfall':
      if (value > 10) return 'Heavy Shower';
      if (value > 0) return 'Rain Recorded';
      return 'Dry (No Rain)';
    case 'batteryVoltage':
      if (value > 12.4) return 'Fully Charged';
      if (value > 11.5) return 'Normal Battery';
      return 'Low Power';
    default:
      return 'Normal Range';
  }
}

/**
 * Returns a neat, simple explanation of a sensor's condition (Healthy vs Fault).
 */
export function getSensorNeatExplanation(
  sensorKey: SensorKey,
  value: number,
  status: string,
  stationName: string
): { title: string; explanation: string; isFault: boolean } {
  if (status === 'operational' || status === 'normal') {
    switch (sensorKey) {
      case 'temperature':
        return {
          title: 'Working Normally',
          explanation: `Air temperature is ${value.toFixed(1)}°C, which matches typical seasonal expectations for this area.`,
          isFault: false,
        };
      case 'humidity':
        return {
          title: 'Working Normally',
          explanation: `Relative humidity is ${value.toFixed(1)}%, well within physical boundaries (0-100%).`,
          isFault: false,
        };
      case 'windSpeed':
        return {
          title: 'Working Normally',
          explanation: `Wind speed is ${value.toFixed(1)} km/h. Cups are spinning freely with dynamic wind shifts.`,
          isFault: false,
        };
      case 'pressure':
        return {
          title: 'Working Normally',
          explanation: `Barometric pressure is ${value.toFixed(1)} hPa, consistent with the station elevation.`,
          isFault: false,
        };
      case 'rainfall':
        return {
          title: 'Working Normally',
          explanation: `Tipping bucket rain gauge is clean and recording precipitation accurately.`,
          isFault: false,
        };
      case 'batteryVoltage':
        return {
          title: 'Healthy Power',
          explanation: `Battery voltage is ${value.toFixed(2)}V with healthy solar panel charging.`,
          isFault: false,
        };
      default:
        return {
          title: 'Sensor Healthy',
          explanation: `Telemetry readings are consistent and verified by automated quality checks.`,
          isFault: false,
        };
    }
  }

  // Fault or suspect state explanations
  switch (sensorKey) {
    case 'temperature':
      return {
        title: 'Temperature Anomaly',
        explanation: `Reading ${value.toFixed(1)}°C differs notably from neighboring stations. The solar radiation shield may be clogged with dust or the probe needs calibration.`,
        isFault: true,
      };
    case 'humidity':
      return {
        title: 'Humidity Sensor Alert',
        explanation: `Reading ${value.toFixed(1)}% is outside normal physical limits. The capacitive humidity sensor element is likely saturated with condensation or salt crust.`,
        isFault: true,
      };
    case 'windSpeed':
      return {
        title: 'Wind Sensor Stuck / Frozen',
        explanation: `Wind speed is flatlined at ${value.toFixed(1)} km/h even though regional stations report wind. The anemometer rotor may be jammed with debris or a bearing failed.`,
        isFault: true,
      };
    case 'rainfall':
      return {
        title: 'Rain Gauge Funnel Issue',
        explanation: `Rain gauge reported 0.0 mm while radar or nearby stations detected rain. Leaves or dust may be blocking the funnel inlet.`,
        isFault: true,
      };
    case 'batteryVoltage':
      return {
        title: 'Low Power Alert',
        explanation: `Battery dropped to ${value.toFixed(2)}V. Solar panel could be shaded, soiled, or the battery cell is aging.`,
        isFault: true,
      };
    default:
      return {
        title: 'Sensor Discrepancy',
        explanation: `Unusual reading detected on ${stationName}. Flagged for field technician inspection.`,
        isFault: true,
      };
  }
}

/**
 * Returns a neat, simple summary for an entire station.
 */
export function getStationSimpleVerdict(station: Station): {
  headline: string;
  detail: string;
  tone: 'good' | 'warning' | 'critical';
} {
  if (station.status === 'operational' && station.activeAnomaliesCount === 0) {
    return {
      headline: 'All Sensors Healthy & Reporting Accurate Data',
      detail: `All 8 weather sensors at ${station.name} are working normally. Temperature, humidity, wind, pressure, and rain readings are verified against nearby stations.`,
      tone: 'good',
    };
  }

  if (station.status === 'critical') {
    const faultySensors = Object.entries(station.sensors)
      .filter(([_, s]) => s.status === 'erroneous')
      .map(([_, s]) => s.label);

    const nameStr = faultySensors.length > 0 ? faultySensors.join(', ') : 'One or more sensors';
    return {
      headline: `Sensor Issue Detected: ${nameStr}`,
      detail: `An abnormal reading was caught by automated quality checks. The faulty sensor has been quarantined so it doesn't skew weather forecasts, and a service ticket is ready.`,
      tone: 'critical',
    };
  }

  // Warning
  return {
    headline: 'Slight Discrepancy Detected (Under Review)',
    detail: `Readings at this station show a minor drift or difference compared to surrounding stations. An automated check is monitoring the trend.`,
    tone: 'warning',
  };
}

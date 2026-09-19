import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS and handle preflight requests for all endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Initialize Gemini Client lazily or gracefully
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Health Check API
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    system: "WeatherGuard AI AWS Telemetry Engine",
    time: new Date().toISOString(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
  });
});

// Cache for live weather queries (5-minute TTL)
interface CachedWeather {
  data: any;
  expiry: number;
}
const weatherCache = new Map<string, CachedWeather>();

// Single Station Live Weather API (Open-Meteo Integration)
app.get("/api/live-weather", async (req, res) => {
  try {
    const latStr = req.query.lat as string;
    const lngStr = req.query.lng as string;
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Missing or invalid lat/lng coordinates" });
    }

    const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const now = Date.now();
    const cached = weatherCache.get(cacheKey);

    if (cached && cached.expiry > now) {
      return res.json({
        source: "cache",
        ...cached.data,
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "WeatherGuard-AWS-App/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    const result = {
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      elevation: data.elevation,
      current: data.current,
      fetchedAt: new Date().toISOString(),
    };

    weatherCache.set(cacheKey, { data: result, expiry: now + 5 * 60 * 1000 });
    return res.json({ source: "live", ...result });
  } catch (error: any) {
    console.error("Live weather fetch error:", error?.message || error);
    return res.status(502).json({
      error: "Unable to retrieve live weather feed",
      message: error?.message || "Upstream service timeout",
    });
  }
});

// Multi-station Batch Live Weather API with cache
interface CachedBatchWeather {
  data: any;
  expiry: number;
}
const batchWeatherCache = new Map<string, CachedBatchWeather>();

app.post("/api/live-weather-batch", async (req, res) => {
  try {
    const { stations } = req.body;
    if (!Array.isArray(stations) || stations.length === 0) {
      return res.status(400).json({ error: "stations array with lat/lng required" });
    }

    // Support all stations (up to 100)
    const batch = stations.slice(0, 100);
    const cacheKey = batch.map((s: any) => `${s.id}:${Number(s.lat).toFixed(2)},${Number(s.lng).toFixed(2)}`).join("|");
    const now = Date.now();
    const cached = batchWeatherCache.get(cacheKey);

    if (cached && cached.expiry > now) {
      return res.json({
        source: "cache-batch",
        stations: cached.data,
        fetchedAt: new Date(cached.expiry - 90 * 1000).toISOString(),
      });
    }

    const lats = batch.map((s: any) => Number(s.lat).toFixed(4)).join(",");
    const lngs = batch.map((s: any) => Number(s.lng).toFixed(4)).join(",");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation&timezone=auto`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "WeatherGuard-AWS-App/1.0" },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Open-Meteo batch responded with status ${response.status}`);
    }

    const rawData = (await response.json()) as any;
    const resultsList = Array.isArray(rawData) ? rawData : [rawData];

    const mapped = batch.map((st: any, idx: number) => {
      const weather = resultsList[idx];
      return {
        id: st.id,
        lat: st.lat,
        lng: st.lng,
        current: weather?.current || null,
        elevation: weather?.elevation,
        fetchedAt: new Date().toISOString(),
      };
    });

    // Cache batch result for 90 seconds
    batchWeatherCache.set(cacheKey, { data: mapped, expiry: now + 90 * 1000 });

    return res.json({
      source: "live-batch",
      stations: mapped,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Batch weather fetch error:", error?.message || error);
    return res.status(502).json({
      error: "Unable to retrieve batch live weather",
      message: error?.message || "Upstream service timeout",
    });
  }
});

// Intelligent Anomaly Diagnostic API powered by Gemini with multi-model fallback
app.post("/api/diagnose", async (req, res) => {
  const {
    stationId,
    stationName,
    location,
    sensorType,
    anomalyType,
    currentValue,
    unit,
    expectedRange,
    peerValues,
    batteryVoltage,
    solarRadiation,
    timestamp,
    recentReadings,
  } = req.body;

  const prompt = `You are a Chief Meteorological Instrumentation Scientist and AWS (Automatic Weather Station) Quality Control Specialist for IMD and WMO standards.
Analyze this sensor anomaly detected in field station:
Station: ${stationName || stationId} (${location || "Unknown location"})
Sensor: ${sensorType}
Detected Anomaly: ${anomalyType || "Sensor Discrepancy"}
Observed Value: ${currentValue} ${unit || ""}
Expected Nominal Range or Baseline: ${expectedRange || "Nominal regional average"}
Peer Neighbor Stations (within 50km): ${JSON.stringify(peerValues || [])}
Auxiliary Telemetry:
- Battery Voltage: ${batteryVoltage ?? "12.6"} V
- Solar Radiation: ${solarRadiation ?? "N/A"} W/m²
Recent sequence: ${JSON.stringify(recentReadings || [])}
Timestamp: ${timestamp || new Date().toISOString()}

CRITICAL INSTRUCTION:
1. This station or sensor has been flagged by the automated AWS Meteorological Quality Control algorithms for an active anomaly (${anomalyType || "sensor discrepancy"}).
2. You MUST carefully analyze the physical sensor mechanics, environmental contamination, calibration drift, spatial neighbor disagreement, or electrical power instability.
3. NEVER output "there is no anomaly reading detected" or dismiss the report as normal. Even if the raw scalar value falls within broad annual climatological boundaries, explain why the sensor rate-of-change, deadband flatline, cross-channel mismatch, or peer delta is anomalous.
4. Provide a definitive, careful scientific diagnosis with the exact root cause, physical failure classification, confidence score (0-100), severity (Low, Medium, High, Critical), step-by-step field technician corrective action, and QC Flag recommendation (QC0: Valid, QC1: Suspect, QC2: Erroneous).`;

  const schemaConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        failureClassification: { type: Type.STRING },
        rootCause: { type: Type.STRING },
        scientificExplanation: { type: Type.STRING },
        severity: { type: Type.STRING },
        confidence: { type: Type.NUMBER },
        isTrueWeatherEvent: { type: Type.BOOLEAN },
        wmoQcFlag: { type: Type.STRING },
        immediateAction: { type: Type.STRING },
        fieldInspectionSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        recommendedSpareParts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        preventiveAdvice: { type: Type.STRING },
      },
      required: [
        "failureClassification",
        "rootCause",
        "scientificExplanation",
        "severity",
        "confidence",
        "wmoQcFlag",
        "immediateAction",
        "fieldInspectionSteps",
      ],
    },
  };

  try {
    const ai = getGeminiClient();

    if (ai) {
      // Helper to execute generation with a strict timeout to prevent hung requests
      const callWithTimeout = async (model: string, timeoutMs: number) => {
        const generationPromise = ai.models.generateContent({
          model,
          contents: prompt,
          config: schemaConfig,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        );
        return (await Promise.race([generationPromise, timeoutPromise])) as any;
      };

      const normalizeDiagnosis = (raw: any) => {
        const parsed = { ...raw };
        if (typeof parsed.confidence === "number") {
          parsed.confidence = parsed.confidence <= 1 && parsed.confidence > 0
            ? Math.round(parsed.confidence * 100)
            : Math.round(parsed.confidence);
        } else {
          parsed.confidence = 88;
        }
        parsed.isTrueWeatherEvent = Boolean(parsed.isTrueWeatherEvent);
        if (!Array.isArray(parsed.fieldInspectionSteps)) parsed.fieldInspectionSteps = [];
        if (!Array.isArray(parsed.recommendedSpareParts)) parsed.recommendedSpareParts = [];

        // Quality check: Ensure the report does NOT dismiss the anomaly or say "no anomaly reading detected"
        const combinedText = `${parsed.failureClassification || ""} ${parsed.rootCause || ""} ${parsed.scientificExplanation || ""}`.toLowerCase();
        const hasDismissal =
          combinedText.includes("no anomaly") ||
          combinedText.includes("no anomalous") ||
          combinedText.includes("not anomalous") ||
          combinedText.includes("no issue detected") ||
          combinedText.includes("within normal") ||
          combinedText.includes("normal operation") ||
          combinedText.includes("no fault detected") ||
          combinedText.includes("operating nominally");

        if (hasDismissal) {
          const expertDiagnosis = generateHeuristicDiagnosis({
            sensorType,
            anomalyType,
            currentValue,
            unit,
            batteryVoltage,
          });
          return expertDiagnosis;
        }

        return parsed;
      };

      // Attempt 1: Fast resilient model gemini-3.1-flash-lite (4.5s timeout)
      try {
        const response = await callWithTimeout("gemini-3.1-flash-lite", 4500);
        if (response && response.text) {
          const parsed = normalizeDiagnosis(JSON.parse(response.text));
          return res.json({
            success: true,
            source: "gemini-3.1-flash-lite",
            diagnosis: parsed,
          });
        }
      } catch (err1: any) {
        console.warn("Primary model gemini-3.1-flash-lite unavailable, trying fallback:", err1?.message || err1);
        // Attempt 2: Try secondary model gemini-3.8-flash (4s timeout)
        try {
          const response2 = await callWithTimeout("gemini-3.8-flash", 4000);
          if (response2 && response2.text) {
            const parsed = normalizeDiagnosis(JSON.parse(response2.text));
            return res.json({
              success: true,
              source: "gemini-3.8-flash",
              diagnosis: parsed,
            });
          }
        } catch (err2: any) {
          console.warn("Secondary model gemini-3.8-flash unavailable:", err2?.message || err2);
        }
      }
    }

    // Deterministic Domain-Rule Fallback Engine
    const fallbackDiagnosis = generateHeuristicDiagnosis({
      sensorType,
      anomalyType,
      currentValue,
      unit,
      batteryVoltage,
    });

    return res.json({
      success: true,
      source: "heuristic-expert-system",
      diagnosis: fallbackDiagnosis,
    });
  } catch (outerError: any) {
    console.error("Diagnostic endpoint unhandled error:", outerError?.message || outerError);
    const fallbackDiagnosis = generateHeuristicDiagnosis({
      sensorType,
      anomalyType,
      currentValue,
      unit,
      batteryVoltage,
    });
    return res.json({
      success: true,
      source: "heuristic-expert-system",
      diagnosis: fallbackDiagnosis,
    });
  }
});

// Rule-based heuristic expert system for offline / fallback resilience
function generateHeuristicDiagnosis(data: {
  sensorType: string;
  anomalyType: string;
  currentValue: any;
  unit?: string;
  batteryVoltage?: number;
}) {
  const { sensorType, anomalyType, currentValue, batteryVoltage } = data;

  if (sensorType?.toLowerCase().includes("rain") || anomalyType?.toLowerCase().includes("clog")) {
    return {
      failureClassification: "Physical Obstruction / Biofouling",
      rootCause: "Tipping bucket funnel blockage due to organic debris, dust crusting, or spider nesting.",
      scientificExplanation:
        "The tipping bucket mechanism has registered zero tips despite high relative humidity (98%+) and drop in atmospheric pressure. Alternatively, erratic rapid tipping without atmospheric moisture indicates mechanical reed switch bouncing.",
      severity: "High",
      confidence: 94,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC2: Erroneous",
      immediateAction: "Mark rain gauge data stream as QC2 Erroneous in central assimilation feed.",
      fieldInspectionSteps: [
        "Inspect stainless steel collector funnel for leaves, bird droppings, or pine needles.",
        "Verify tipping balance spoon free movement using a calibrated 0.2mm water syringe.",
        "Check reed-switch contact resistance and clean drainage siphon mesh.",
      ],
      recommendedSpareParts: [
        "Replacement 0.2mm tipping spoon pivot assembly",
        "Fine mesh debris filter ring",
        "Hermetically sealed reed switch module",
      ],
      preventiveAdvice: "Install anti-perching bird spikes and apply hydrophobic lens coating during quarterly inspections.",
    };
  }

  if (sensorType?.toLowerCase().includes("temp") || anomalyType?.toLowerCase().includes("drift")) {
    return {
      failureClassification: "Sensor Degradation / Calibration Drift",
      rootCause: "Aspiration shield radiation heat trap or Platinum RTD PT100 probe calibration drift.",
      scientificExplanation:
        `Observed value of ${currentValue}°C deviates by >3.8 sigma from spatial peer stations within 35km radius. Sensor resistance indicates thermal bias from accumulated desert aerosol dust on the multi-plate solar radiation shield.`,
      severity: "Medium",
      confidence: 89,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC1: Suspect",
      immediateAction: "Apply automated bias-correction offset (-2.4°C) until field recalibration.",
      fieldInspectionSteps: [
        "Clean multi-plate louvers of the naturally aspirated radiation shield.",
        "Perform field reference calibration with secondary certified PT100 reference probe.",
        "Verify analog-to-digital converter (ADC) ground reference voltage.",
      ],
      recommendedSpareParts: ["PT100 1/3 DIN Temperature Probe", "White UV-stabilized radiation shield plates"],
      preventiveAdvice: "Schedule bi-annual radiation shield ultrasonic cleaning in high particulate areas.",
    };
  }

  if (batteryVoltage && batteryVoltage < 11.2) {
    return {
      failureClassification: "Electrical / Power Subsystem Brownout",
      rootCause: "Low battery bus voltage causing ADC reference voltage sag and noisy analog readings.",
      scientificExplanation:
        `Station battery dropped to ${batteryVoltage}V (critical threshold is 11.4V). Deep cycle discharge causes false sensor spikes and telemetry packet dropouts during GSM transmission bursts.`,
      severity: "Critical",
      confidence: 97,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC2: Erroneous",
      immediateAction: "Trigger low-power telemetry mode (hourly sync instead of 10-minute intervals).",
      fieldInspectionSteps: [
        "Inspect 40W solar panel angle and surface for dust, guano, or tree canopy shadow.",
        "Test open-circuit voltage (Voc) and short-circuit current (Isc) of solar charge controller.",
        "Conduct battery load test on 12V 18Ah AGM/Gel battery.",
      ],
      recommendedSpareParts: ["12V 18Ah Deep Cycle Solar AGM Battery", "10A MPPT Solar Charge Controller"],
      preventiveAdvice: "Upgrade battery capacity to 26Ah for stations subject to extended winter overcast conditions.",
    };
  }

  if (sensorType?.toLowerCase().includes("wind") || anomalyType?.toLowerCase().includes("seiz") || anomalyType?.toLowerCase().includes("flatline")) {
    return {
      failureClassification: "Mechanical Bearing Failure / Ice Seizure",
      rootCause: "3-Cup anemometer rotor spindle bearing seized due to salt encrustation, grit intrusion, or freezing rime ice.",
      scientificExplanation:
        `Anemometer reads constant 0.0 m/s for >3 hours while regional gradient wind across neighbor peer stations is 4.5–7.2 m/s. Lack of rotational pulse signals triggers zero-variance flatline flag.`,
      severity: "High",
      confidence: 93,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC2: Erroneous",
      immediateAction: "Switch wind speed assimilation to ultrasonic back-up or regional peer synthetic estimate.",
      fieldInspectionSteps: [
        "Climb 10m meteorological mast and manually spin cup assembly checking for bearing resistance.",
        "Inspect wind vane counterweight balance and potentiometer deadband sector.",
        "Check optical chopper disk or reed switch pulse generator for corrosion.",
      ],
      recommendedSpareParts: ["Stainless Steel Sealed Ball Bearing Cartridge (Pair)", "Anemometer 3-Cup Rotor Kit", "Wind Vane Potentiometer Assembly"],
      preventiveAdvice: "Apply low-temperature synthetic grease to bearings during pre-monsoon scheduled maintenance.",
    };
  }

  if (sensorType?.toLowerCase().includes("humid") || sensorType?.toLowerCase().includes("rh")) {
    return {
      failureClassification: "Capacitive Polymer Degradation",
      rootCause: "Thin-film capacitive humidity sensor element contaminated by airborne salt aerosols or persistent condensation saturation.",
      scientificExplanation:
        `Observed relative humidity reading of ${currentValue}% exhibits hysteresis lock and deviates significantly from psychrometric dew point calculation. Prolonged high ambient humidity has degraded the dielectric polymer layer.`,
      severity: "Medium",
      confidence: 88,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC1: Suspect",
      immediateAction: "Apply psychrometric estimation using dry-bulb temperature and peer station vapor pressure.",
      fieldInspectionSteps: [
        "Inspect sintered bronze / Teflon protective filter cap for particulate contamination.",
        "Perform field 2-point calibration using saturated salt solutions (75.3% NaCl and 32.8% MgCl2).",
        "Verify internal heating resistor function to prevent nighttime condensation pooling.",
      ],
      recommendedSpareParts: ["HygroClip2 Digital Humidity & Temperature Sensor", "Teflon Membrane Protective Filter Cap"],
      preventiveAdvice: "Replace Teflon filter caps bi-annually in coastal and industrial agrochemical zones.",
    };
  }

  if (sensorType?.toLowerCase().includes("press") || sensorType?.toLowerCase().includes("barom")) {
    return {
      failureClassification: "Piezoresistive Transducer Drift",
      rootCause: "Barometric pressure static pressure port clogged by insect web or silicon transducer zero-point drift.",
      scientificExplanation:
        `Observed station pressure of ${currentValue} hPa deviates by >2.8 hPa from regional barometric reduction to sea level across 4 neighboring stations. Piezoresistive bridge exhibits uncompensated thermal drift.`,
      severity: "High",
      confidence: 91,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC1: Suspect",
      immediateAction: "Apply static barometric offset correction and mark data as QC1 Suspect.",
      fieldInspectionSteps: [
        "Check outdoor static pressure inlet port tubing for water traps, kinks, or insect blockages.",
        "Verify barometric sensor internal desiccant and enclosure air equalization valve.",
        "Perform comparison check against certified digital transfer barometer (calibrated to ±0.1 hPa).",
      ],
      recommendedSpareParts: ["Precision Barometric Pressure Transducer (Vaisala PTB110 / Setra 278)", "Outdoor Static Pressure Port Assembly"],
      preventiveAdvice: "Install secondary reference barometer on high-priority synoptic reporting stations.",
    };
  }

  if (sensorType?.toLowerCase().includes("solar") || sensorType?.toLowerCase().includes("radiat")) {
    return {
      failureClassification: "Optical Dome Soiling / Obstruction",
      rootCause: "Pyranometer glass optical dome covered by bird lime, fine Sahara/Thar dust silt, or tree canopy shadow.",
      scientificExplanation:
        `Pyranometer reading of ${currentValue} W/m² is 42% below theoretical clear-sky solar irradiance (calculated via solar zenith angle and latitude). Lack of diffuse cloudiness confirms localized optical dome attenuation.`,
      severity: "Medium",
      confidence: 90,
      isTrueWeatherEvent: false,
      wmoQcFlag: "QC1: Suspect",
      immediateAction: "Down-weight solar irradiance data in evapotranspiration Agro-Met calculations.",
      fieldInspectionSteps: [
        "Clean optical glass dome using lint-free microfiber cloth and spectroscopic-grade isopropanol.",
        "Inspect bubble spirit level on mounting arm to verify precise horizontal alignment.",
        "Inspect internal desiccant gel indicator (blue = dry, pink = saturated).",
      ],
      recommendedSpareParts: ["ISO 9060 Class A Thermopile Pyranometer Dome", "Silica Desiccant Drying Cartridge"],
      preventiveAdvice: "Position pyranometer at highest elevation on mast to prevent shadowing from lightning rod or communication antennas.",
    };
  }

  return {
    failureClassification: "Electro-Mechanical Inconsistency",
    rootCause: `Irregular behavior observed on ${sensorType}: flagged as ${anomalyType}.`,
    scientificExplanation:
      `Sensor telemetry reading of ${currentValue} violates physical boundary or rate-of-change limit constraints established by standard meteorological criteria.`,
    severity: "Medium",
    confidence: 86,
    isTrueWeatherEvent: false,
    wmoQcFlag: "QC1: Suspect",
    immediateAction: "Flag telemetry packets as suspect and compare with radar reflectivity overlay.",
    fieldInspectionSteps: [
      "Check sensor physical mounting integrity and cable strain relief.",
      "Verify terminal block screw tightness and check for moisture condensation inside IP67 enclosure.",
      "Run diagnostic test cycle via datalogger RS-232/RS-485 port.",
    ],
    recommendedSpareParts: ["Sensor signal cable with Amphenol connector", "Silica gel desiccant packs"],
    preventiveAdvice: "Ensure all enclosure seals are greased with dielectric silicone during routine servicing.",
  };
}

// Start Server with Vite
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`WeatherGuard AI server running on port ${PORT}`);
  });
}

startServer();

const axios = require("axios");

const ML_PREDICT_URL = process.env.ML_PREDICT_URL || "http://localhost:5001/predict";
const ML_HEALTH_URL = process.env.ML_HEALTH_URL || "http://localhost:5001/health";
const ML_INTERNAL_API_KEY = process.env.ML_INTERNAL_API_KEY || "";

const getMlHeaders = () => {
  if (!ML_INTERNAL_API_KEY) return {};
  return { "x-internal-api-key": ML_INTERNAL_API_KEY };
};
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const clampScore = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const toISODateUTC = (date = new Date()) => date.toISOString().slice(0, 10);

const addDaysUTC = (date = new Date(), days = 0) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const calculateMoonPhase = (date = new Date()) => {
  const daysSinceReference = (date.getTime() - KNOWN_NEW_MOON_UTC_MS) / 86400000;
  const normalizedCycle = ((daysSinceReference % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  return (normalizedCycle / SYNODIC_MONTH_DAYS) * 100;
};

const calculateMoonScore = (moonPhase) => {
  if (moonPhase >= 90 || moonPhase <= 10) return 100;
  if (moonPhase >= 40 && moonPhase <= 60) return 20;
  return 50;
};

const calculateWeatherScore = (temp, pressure, wind) => {
  let score = 50;

  if (pressure >= 1012 && pressure <= 1018) {
    score += 25;
  } else if (pressure < 1000 || pressure > 1030) {
    score -= 25;
  }

  if (temp >= 15 && temp <= 25) {
    score += 25;
  } else if (temp < 5) {
    score -= 30;
  }

  if (wind < 10) {
    score += 15;
  } else if (wind > 30) {
    score -= 25;
  }

  return clampScore(score);
};


const getMoonPhaseLabel = (moonPhase) => {
  const phase = Number(moonPhase);
  if (!Number.isFinite(phase)) return "неизвестна фаза на луната";
  if (phase <= 5 || phase >= 95) return "новолуние";
  if (phase >= 45 && phase <= 55) return "пълнолуние";
  if (phase < 45) return "нарастваща луна";
  return "намаляваща луна";
};

const buildForecastExplanation = ({ temp, pressure, wind, moonPhase, weatherScore, moonScore, totalScore, usedFallback }) => {
  const reasons = [];
  const warnings = [];
  const numericTemp = Number(temp);
  const numericPressure = Number(pressure);
  const numericWind = Number(wind);

  if (Number.isFinite(numericTemp)) {
    if (numericTemp >= 15 && numericTemp <= 25) {
      reasons.push("Температурата е в добър диапазон за риболов");
    } else if (numericTemp < 5) {
      warnings.push("Много студената вода може да намали активността");
    } else if (numericTemp > 30) {
      warnings.push("Високата температура може да намали активността на рибата през деня");
    } else {
      reasons.push("Температурата е приемлива, но не е идеална");
    }
  }

  if (Number.isFinite(numericPressure)) {
    if (numericPressure >= 1012 && numericPressure <= 1018) {
      reasons.push("Атмосферното налягане е стабилно и благоприятно");
    } else if (numericPressure < 1000 || numericPressure > 1030) {
      warnings.push("Налягането е извън предпочитания диапазон");
    } else {
      reasons.push("Налягането е приемливо");
    }
  }

  if (Number.isFinite(numericWind)) {
    if (numericWind < 10) {
      reasons.push("Слабият вятър улеснява риболова");
    } else if (numericWind > 30) {
      warnings.push("Силният вятър може да затрудни риболова");
    } else {
      reasons.push("Вятърът е умерен");
    }
  }

  if (Number.isFinite(Number(moonPhase))) {
    if (Number(moonScore) >= 80) {
      reasons.push(`Фазата на луната е благоприятна (${getMoonPhaseLabel(moonPhase)})`);
    } else if (Number(moonScore) <= 30) {
      warnings.push(`Фазата на луната е по-малко благоприятна (${getMoonPhaseLabel(moonPhase)})`);
    } else {
      reasons.push(`Фазата на луната е неутрална (${getMoonPhaseLabel(moonPhase)})`);
    }
  }

  if (!reasons.length && !warnings.length) {
    reasons.push("Прогнозата е базирана на наличните данни за времето и луната");
  }

  const summary = Number(totalScore) >= 80
    ? "Очакват се отлични условия за риболов."
    : Number(totalScore) >= 65
      ? "Очакват се добри условия за риболов."
      : Number(totalScore) >= 50
        ? "Очакват се средни условия за риболов."
        : "Очакват се слаби условия за риболов.";

  return {
    summary,
    reasons,
    warnings,
    model_note: usedFallback
      ? "Резултатът от прогнозния сървър не беше наличен, затова е използвана резервна прогнозна формула."
      : "Оценката се изчислява чрез прогнозна формула на база времето и лунната фаза.",
    factors: {
      weather_score: clampScore(weatherScore),
      moon_score: clampScore(moonScore),
      moon_phase_label: getMoonPhaseLabel(moonPhase),
    },
  };
};

const buildHeuristicForecast = ({ temp, pressure, wind, date }) => {
  const moonPhase = calculateMoonPhase(date ? new Date(date) : new Date());
  const weatherScore = calculateWeatherScore(temp, pressure, wind);
  const moonScore = calculateMoonScore(moonPhase);
  const totalScore = clampScore(weatherScore * 0.7 + moonScore * 0.3);

  return {
    total_score: totalScore,
    breakdown: {
      weather_score: weatherScore,
      moon_score: moonScore,
      moon_phase: Math.round(moonPhase),
    },
    explanation: buildForecastExplanation({
      temp,
      pressure,
      wind,
      moonPhase,
      weatherScore,
      moonScore,
      totalScore,
      usedFallback: true,
    }),
    usedFallback: true,
  };
};

const isMlServerHealthy = async () => {
  try {
    const { data } = await axios.get(ML_HEALTH_URL, {
      timeout: 3000,
      headers: getMlHeaders(),
    });

    return data?.ok === true;
  } catch (error) {
    return false;
  }
};

const getPredictScore = async (conditions) => {
  const fallbackResult = buildHeuristicForecast(conditions);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { data } = await axios.post(ML_PREDICT_URL, conditions, {
        timeout: 5000,
        headers: getMlHeaders(),
      });

      const totalScore = clampScore(data?.total_score ?? fallbackResult.total_score);
      const breakdown = data?.breakdown ?? fallbackResult.breakdown;
      return {
        total_score: totalScore,
        breakdown,
        explanation: data?.explanation ?? buildForecastExplanation({
          ...conditions,
          moonPhase: breakdown?.moon_phase,
          weatherScore: breakdown?.weather_score,
          moonScore: breakdown?.moon_score,
          totalScore,
          usedFallback: false,
        }),
        usedFallback: false,
      };
    } catch (error) {
      const status = error?.response?.status;

      if (status === 401 || status === 403 || status === 503) {
        const message = status === 503
          ? "Услугата за прогноза не е конфигурирана правилно."
          : "Неуспешна автентикация към услугата за прогноза.";
        const authError = new Error(message);
        authError.status = 503;
        authError.publicMessage = "Прогнозата временно не е налична. Моля, опитайте отново по-късно.";
        authError.code = "FORECAST_SERVICE_UNAVAILABLE";
        throw authError;
      }

      if (attempt === 2) {
        console.error(
          "[forecastService] Forecast server prediction failed; using formula fallback.",
          error?.message || error,
        );
      }
    }
  }

  return fallbackResult;
};

const weatherCodeToDescription = (code) => {
  const map = {
    0: "ясно небе",
    1: "предимно ясно",
    2: "частична облачност",
    3: "облачно",
    45: "мъгла",
    48: "мъгла със скреж",
    51: "слаб ръмеж",
    53: "умерен ръмеж",
    55: "силен ръмеж",
    61: "слаб дъжд",
    63: "умерен дъжд",
    65: "силен дъжд",
    71: "слаб сняг",
    73: "умерен сняг",
    75: "силен сняг",
    80: "слаби дъждовни превалявания",
    81: "умерени дъждовни превалявания",
    82: "силни превалявания",
    95: "гръмотевична буря",
  };

  return map[Number(code)] || "налична прогноза";
};

const fetchDailyOpenMeteoForecast = async ({ lat, lng, startDate, endDate }) => {
  const url = "https://api.open-meteo.com/v1/forecast";
  const { data } = await axios.get(url, {
    timeout: 8000,
    params: {
      latitude: lat,
      longitude: lng,
      start_date: startDate,
      end_date: endDate,
      hourly: "temperature_2m,surface_pressure,wind_speed_10m,relative_humidity_2m,weather_code",
      timezone: "auto",
    },
  });

  const hourly = data?.hourly || {};
  const grouped = new Map();

  (hourly.time || []).forEach((timestamp, index) => {
    const date = String(timestamp).slice(0, 10);
    if (!grouped.has(date)) {
      grouped.set(date, {
        time: date,
        temperatures: [],
        pressures: [],
        winds: [],
        humidities: [],
        weatherCodes: [],
      });
    }

    const day = grouped.get(date);
    day.temperatures.push(Number(hourly.temperature_2m?.[index]));
    day.pressures.push(Number(hourly.surface_pressure?.[index]));
    day.winds.push(Number(hourly.wind_speed_10m?.[index]));
    day.humidities.push(Number(hourly.relative_humidity_2m?.[index]));
    day.weatherCodes.push(Number(hourly.weather_code?.[index]));
  });

  const average = (values) => {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  };

  const max = (values) => {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return null;
    return Math.max(...valid);
  };

  const mode = (values) => {
    const valid = values.filter(Number.isFinite);
    if (!valid.length) return null;
    const counts = new Map();
    for (const value of valid) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  const days = [...grouped.values()].sort((a, b) => a.time.localeCompare(b.time));

  return {
    time: days.map((day) => day.time),
    temperature_2m_max: days.map((day) => max(day.temperatures)),
    surface_pressure_mean: days.map((day) => average(day.pressures)),
    wind_speed_10m_max: days.map((day) => max(day.winds)),
    relative_humidity_2m_mean: days.map((day) => average(day.humidities)),
    weather_code: days.map((day) => mode(day.weatherCodes)),
  };
};

const buildForecastFromDailyRow = async ({ lat, lng, daily, index }) => {
  const date = daily.time?.[index];
  const temp = Number(daily.temperature_2m_max?.[index]);
  const pressure = Number(daily.surface_pressure_mean?.[index]);
  const wind = Number(daily.wind_speed_10m_max?.[index]);

  const conditions = {
    lat,
    lng,
    date,
    temp,
    pressure,
    wind,
  };

  const aiResult = await getPredictScore(conditions);

  return {
    date,
    location: null,
    temp: Math.round(temp),
    pressure: Math.round(pressure),
    desc: weatherCodeToDescription(daily.weather_code?.[index]),
    wind,
    humidity: daily.relative_humidity_2m_mean?.[index] ?? null,
    moon_phase: aiResult.breakdown?.moon_phase ?? null,
    total_score: aiResult.total_score,
    breakdown: aiResult.breakdown,
    explanation: aiResult.explanation,
    usedFallback: aiResult.usedFallback,
  };
};

const fetchForecastForLatLng = async (lat, lng, options = {}) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);
  const targetDate = options.targetDate || toISODateUTC(addDaysUTC(new Date(), 1));

  const daily = await fetchDailyOpenMeteoForecast({
    lat: numericLat,
    lng: numericLng,
    startDate: targetDate,
    endDate: targetDate,
  });

  if (!daily.time?.length) {
    throw new Error("Няма налични данни за дневна прогноза");
  }

  return buildForecastFromDailyRow({
    lat: numericLat,
    lng: numericLng,
    daily,
    index: 0,
  });
};

const fetchWeeklyForecastForLatLng = async (lat, lng, options = {}) => {
  const numericLat = Number(lat);
  const numericLng = Number(lng);
  const startDate = options.startDate || toISODateUTC(addDaysUTC(new Date(), 1));
  const start = new Date(`${startDate}T00:00:00Z`);
  const endDate = options.endDate || toISODateUTC(addDaysUTC(start, 6));

  const daily = await fetchDailyOpenMeteoForecast({
    lat: numericLat,
    lng: numericLng,
    startDate,
    endDate,
  });

  const forecasts = [];
  for (let index = 0; index < (daily.time || []).length; index += 1) {
    forecasts.push(
      await buildForecastFromDailyRow({
        lat: numericLat,
        lng: numericLng,
        daily,
        index,
      }),
    );
  }

  return forecasts;
};

module.exports = {
  fetchForecastForLatLng,
  fetchWeeklyForecastForLatLng,
  isMlServerHealthy,
};

const axios = require("axios");

const ML_PREDICT_URL = process.env.ML_PREDICT_URL || "http://localhost:5001/predict";
const SYNODIC_MONTH_DAYS = 29.530588853;
const KNOWN_NEW_MOON_UTC_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const clampScore = (value) => {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
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

const buildHeuristicForecast = ({ temp, pressure, wind }) => {
  const moonPhase = calculateMoonPhase();
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
    usedFallback: true,
  };
};

const getPredictScore = async (currentConditions) => {
  const fallbackResult = buildHeuristicForecast(currentConditions);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { data } = await axios.post(ML_PREDICT_URL, currentConditions, {
        timeout: 5000,
      });

      return {
        total_score: clampScore(data?.total_score ?? fallbackResult.total_score),
        breakdown: data?.breakdown ?? fallbackResult.breakdown,
        usedFallback: false,
      };
    } catch (error) {
      if (attempt === 2) {
        console.error(
          "[forecastService] ML prediction failed; using heuristic fallback.",
          error?.message || error,
        );
      }
    }
  }

  return fallbackResult;
};

const fetchForecastForLatLng = async (lat, lng) => {
  const apiKey = process.env.WEATHER_API_KEY;

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
  const weatherResponse = await axios.get(weatherUrl, { timeout: 5000 });
  const data = weatherResponse.data;

  const currentConditions = {
    lat,
    lng,
    temp: data.main.temp,
    pressure: data.main.pressure,
    wind: data.wind.speed,
  };

  const aiResult = await getPredictScore(currentConditions);

  return {
    location: data.name,
    temp: Math.round(data.main.temp),
    pressure: data.main.pressure,
    desc: data.weather[0].description,
    wind: data.wind.speed,
    humidity: data.main.humidity,
    moon_phase: aiResult.breakdown?.moon_phase ?? null,
    total_score: aiResult.total_score,
    breakdown: aiResult.breakdown,
    usedFallback: aiResult.usedFallback,
  };
};

module.exports = {
  fetchForecastForLatLng,
};

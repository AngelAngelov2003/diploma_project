const axios = require("axios");

const ML_PREDICT_URL = process.env.ML_PREDICT_URL || "http://localhost:5001/predict";

const getPredictScore = async (currentConditions) => {
  const fallbackResult = { total_score: 50, breakdown: null, usedFallback: true };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const { data } = await axios.post(ML_PREDICT_URL, currentConditions, {
        timeout: 5000,
      });

      return {
        total_score: data?.total_score ?? fallbackResult.total_score,
        breakdown: data?.breakdown ?? null,
        usedFallback: false,
      };
    } catch (error) {
      if (attempt === 2) {
        console.error(
          "[forecastService] ML prediction failed; using fallback score.",
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
    total_score: aiResult.total_score,
    breakdown: aiResult.breakdown,
    usedFallback: aiResult.usedFallback,
  };
};

module.exports = {
  fetchForecastForLatLng,
};

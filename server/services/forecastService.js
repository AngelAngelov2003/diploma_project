const axios = require("axios");

const fetchForecastForLatLng = async (lat, lng) => {
  const apiKey = process.env.WEATHER_API_KEY;

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
  const weatherResponse = await axios.get(weatherUrl);
  const data = weatherResponse.data;

  const currentConditions = {
    lat,
    lng,
    temp: data.main.temp,
    pressure: data.main.pressure,
    wind: data.wind.speed,
  };

  let aiResult = { total_score: 50, breakdown: null };

  try {
    aiResult = (await axios.post("http://localhost:5001/predict", currentConditions)).data;
  } catch {
    // fallback score already defined
  }

  return {
    location: data.name,
    temp: Math.round(data.main.temp),
    pressure: data.main.pressure,
    desc: data.weather[0].description,
    wind: data.wind.speed,
    total_score: aiResult.total_score,
    breakdown: aiResult.breakdown,
  };
};

module.exports = {
  fetchForecastForLatLng,
};
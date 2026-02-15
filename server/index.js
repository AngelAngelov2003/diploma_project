const express = require('express');
const cors = require('cors');
const pool = require('./db');
const axios = require('axios'); 
require('dotenv').config(); 

const app = express();
app.use(cors());
app.use(express.json());

app.get('/water-bodies', async (req, res) => {
  try {
    const allWaterBodies = await pool.query("SELECT * FROM water_bodies");
    res.json(allWaterBodies.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Грешка на сървъра");
  }
});

app.get('/forecast/:lat/:lng', async (req, res) => {
  const { lat, lng } = req.params;
  const apiKey = process.env.WEATHER_API_KEY;

  try {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric&lang=bg`;
    const weatherResponse = await axios.get(weatherUrl);
    const data = weatherResponse.data;

    const currentConditions = {
        lat: lat,
        lng: lng,
        temp: data.main.temp,
        pressure: data.main.pressure,
        wind: data.wind.speed
    };

    let aiResult = { total_score: 50, breakdown: null };
    
    try {
        const mlResponse = await axios.post('http://localhost:5001/predict', currentConditions);
        
        aiResult = mlResponse.data;
        console.log("Python отговори:", aiResult);
    } catch (mlError) {
        console.error("ВНИМАНИЕ: Python сървърът не отговаря!", mlError.message);
    }

    res.json({
      location: data.name,
      temp: Math.round(data.main.temp),
      pressure: data.main.pressure,
      desc: data.weather[0].description,
      wind: data.wind.speed,
      
      total_score: aiResult.total_score,
      breakdown: aiResult.breakdown 
    });

  } catch (err) {
    console.error("Грешка с OpenWeatherMap:", err.message);
    res.status(500).json({ error: "Няма данни за времето" });
  }
});

app.listen(5000, () => {
  console.log("Node.js сървърът работи на порт 5000");
});
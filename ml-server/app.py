from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestRegressor
import numpy as np
import pandas as pd
import requests
import ephem
from datetime import datetime

app = Flask(__name__)

models_cache = {}

def get_moon_phase(date_obj):
    try:
        moon = ephem.Moon(date_obj)
        return moon.phase 
    except:
        return 0

def calculate_moon_score(moon_phase):
    if moon_phase >= 90 or moon_phase <= 10:
        return 100 
    elif 40 <= moon_phase <= 60:
        return 20  
    else:
        return 50  

def calculate_weather_score(temp, pressure, wind):
    score = 50
    
    if 1012 <= pressure <= 1018: score += 25
    elif pressure < 1000 or pressure > 1030: score -= 25
    
    if 15 <= temp <= 25: score += 25
    elif temp < 5: score -= 30
    
    if wind < 10: score += 15
    elif wind > 30: score -= 25

    return max(0, min(100, score))

def calculate_trend_score(current_pressure, prev_pressure):
    diff = current_pressure - prev_pressure
    if abs(diff) <= 2: 
        return 80 
    elif diff < -5: 
        return 10 
    elif diff > 5:
        return 30 
    return 50

def calculate_total_score(row):
    w_score = calculate_weather_score(row['temperature_2m_max'], row['surface_pressure_mean'], row['wind_speed_10m_max'])
    
    m_score = calculate_moon_score(row['moon_phase'])
    
    p_trend_score = calculate_trend_score(row['surface_pressure_mean'], row['prev_pressure'])

    final_score = (w_score * 0.4) + (m_score * 0.3) + (p_trend_score * 0.3)
    
    return final_score

def get_or_train_model(lat, lng):
    location_key = f"{lat}_{lng}"
    if location_key in models_cache:
        print(f"⚡ Кеширан модел за {location_key}")
        return models_cache[location_key]

    print(f"⏳ Обучение на PRO модел за {location_key}...")
    try:
        url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date=2022-01-01&end_date=2024-01-01&daily=temperature_2m_max,surface_pressure_mean,wind_speed_10m_max&timezone=auto"
        res = requests.get(url).json()
        
        if 'daily' not in res: return None

        df = pd.DataFrame(res['daily'])
        df = df.dropna()

        df['prev_pressure'] = df['surface_pressure_mean'].shift(1)
        df = df.dropna() 

        df['moon_phase'] = df['time'].apply(lambda x: get_moon_phase(datetime.strptime(x, "%Y-%m-%d")))

        df['score'] = df.apply(calculate_total_score, axis=1)

        X = df[['temperature_2m_max', 'surface_pressure_mean', 'wind_speed_10m_max', 'moon_phase']]
        y = df['score']

        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)
        
        models_cache[location_key] = model
        print("✅ Моделът е готов!")
        return model

    except Exception as e:
        print(f"❌ Грешка: {e}")
        return None

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    try:
        lat, lng = data.get('lat'), data.get('lng')
        temp = float(data.get('temp'))
        pressure = float(data.get('pressure'))
        wind = float(data.get('wind')) * 3.6 

        today = datetime.now()
        moon_phase = get_moon_phase(today)
        moon_score = calculate_moon_score(moon_phase)

        weather_score = calculate_weather_score(temp, pressure, wind)

        model = get_or_train_model(lat, lng)
        if model:
            ai_score = model.predict([[temp, pressure, wind, moon_phase]])[0]
        else:
            ai_score = 50

        return jsonify({
            'total_score': round(ai_score),
            'breakdown': {
                'weather_score': weather_score,
                'moon_score': moon_score,
                'moon_phase': round(moon_phase)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(port=5001, debug=True)
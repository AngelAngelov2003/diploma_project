from flask import Flask, request, jsonify
from sklearn.ensemble import RandomForestRegressor
import numpy as np
import pandas as pd
import requests
import ephem
from datetime import datetime

app = Flask(__name__)

models_cache = {}


def clamp_score(value):
    try:
        numeric = float(value)
    except Exception:
        return 50

    return int(max(0, min(100, round(numeric))))


def get_moon_phase(date_obj):
    try:
        moon = ephem.Moon(date_obj)
        return moon.phase
    except Exception:
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
    if 1012 <= pressure <= 1018:
        score += 25
    elif pressure < 1000 or pressure > 1030:
        score -= 25
    if 15 <= temp <= 25:
        score += 25
    elif temp < 5:
        score -= 30
    if wind < 10:
        score += 15
    elif wind > 30:
        score -= 25
    return clamp_score(score)


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
    w_score = calculate_weather_score(
        row["temperature_2m_max"],
        row["surface_pressure_mean"],
        row["wind_speed_10m_max"],
    )
    m_score = calculate_moon_score(row.get("moon_phase", 50))
    p_trend_score = calculate_trend_score(
        row["surface_pressure_mean"], row.get("prev_pressure", row["surface_pressure_mean"])
    )
    return (w_score * 0.4) + (m_score * 0.3) + (p_trend_score * 0.3)


def get_or_train_model(lat, lng, force_refresh=False):
    zone_lat = round(float(lat), 1)
    zone_lng = round(float(lng), 1)
    location_key = f"{zone_lat}_{zone_lng}"

    if location_key in models_cache and not force_refresh:
        return models_cache[location_key]

    try:
        url = (
            f"https://archive-api.open-meteo.com/v1/archive?"
            f"latitude={lat}&longitude={lng}"
            f"&start_date=2022-01-01&end_date=2024-01-01"
            f"&daily=temperature_2m_max,surface_pressure_mean,wind_speed_10m_max"
            f"&timezone=auto"
        )
        res = requests.get(url, timeout=20)
        res.raise_for_status()
        archive_json = res.json()

        daily = archive_json.get("daily") or {}
        if not daily:
            return None

        df = pd.DataFrame(daily)
        if df.empty:
            return None

        df["score"] = df.apply(calculate_total_score, axis=1)

        try:
            catch_res = requests.get("http://localhost:5000/ml/training-data", timeout=10)
            catch_res.raise_for_status()
            catch_payload = catch_res.json()

            if catch_payload and len(catch_payload) > 0:
                df_real = pd.DataFrame(catch_payload)

                if {"lat", "lng", "temp", "pressure", "wind_speed"}.issubset(df_real.columns):
                    df_real["lat_f"] = df_real["lat"].astype(float)
                    df_real["lng_f"] = df_real["lng"].astype(float)

                    tolerance = 0.2
                    regional_logs = df_real[
                        (abs(df_real["lat_f"] - zone_lat) <= tolerance)
                        & (abs(df_real["lng_f"] - zone_lng) <= tolerance)
                    ]

                    if not regional_logs.empty:
                        v1 = regional_logs.copy()
                        v1["temp"] += 5
                        v1["pressure"] += 5

                        v2 = regional_logs.copy()
                        v2["temp"] -= 5
                        v2["pressure"] -= 5

                        v3 = regional_logs.copy()
                        v3["wind_speed"] += 10

                        df_boosted_base = pd.concat(
                            [regional_logs, v1, v2, v3], ignore_index=True
                        )
                        df_final_boost = pd.concat(
                            [df_boosted_base] * 400, ignore_index=True
                        )

                        df_real_mapped = pd.DataFrame(
                            {
                                "temperature_2m_max": df_final_boost["temp"],
                                "surface_pressure_mean": df_final_boost["pressure"],
                                "wind_speed_10m_max": df_final_boost["wind_speed"],
                                "score": 100,
                            }
                        )

                        df = pd.concat([df, df_real_mapped], ignore_index=True)
        except Exception:
            pass

        X = df[["temperature_2m_max", "surface_pressure_mean", "wind_speed_10m_max"]]
        y = df["score"]

        model = RandomForestRegressor(
            n_estimators=120,
            random_state=42,
            min_samples_leaf=1,
        )
        model.fit(X.fillna(0), y.fillna(0))

        models_cache[location_key] = model
        return model
    except Exception:
        return None


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json or {}
    try:
        lat = data.get("lat")
        lng = data.get("lng")
        temp = float(data.get("temp"))
        pressure = float(data.get("pressure"))
        wind = float(data.get("wind"))

        weather_score = calculate_weather_score(temp, pressure, wind)
        moon_phase = get_moon_phase(datetime.now())
        moon_score = calculate_moon_score(moon_phase)

        heuristic_score = clamp_score((weather_score * 0.7) + (moon_score * 0.3))
        model = get_or_train_model(lat, lng, force_refresh=False)

        if model:
            input_df = pd.DataFrame(
                [[temp, pressure, wind]],
                columns=[
                    "temperature_2m_max",
                    "surface_pressure_mean",
                    "wind_speed_10m_max",
                ],
            )
            ai_score = model.predict(input_df)[0]
            total_score = clamp_score((float(ai_score) * 0.8) + (heuristic_score * 0.2))
        else:
            total_score = heuristic_score

        return jsonify(
            {
                "total_score": total_score,
                "breakdown": {
                    "weather_score": weather_score,
                    "moon_score": moon_score,
                    "moon_phase": round(moon_phase),
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/reset-model", methods=["POST"])
def reset_model():
    data = request.json or {}
    lat = data.get("lat")
    lng = data.get("lng")

    zone_lat = round(float(lat), 1)
    zone_lng = round(float(lng), 1)
    location_key = f"{zone_lat}_{zone_lng}"

    if location_key in models_cache:
        del models_cache[location_key]
        return jsonify({"message": f"Cache cleared for {location_key}"}), 200

    return jsonify({"message": "No cache found for this location"}), 200


if __name__ == "__main__":
    app.run(port=5001, debug=True)

from flask import Flask, request, jsonify
import os
from functools import wraps
import ephem
from datetime import datetime

app = Flask(__name__)


def load_local_env_file():
    """Load ml-server/.env without requiring python-dotenv."""
    env_path = os.path.join(os.path.dirname(__file__), ".env")

    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key and key not in os.environ:
                os.environ[key] = value


load_local_env_file()

ML_INTERNAL_API_KEY = os.getenv("ML_INTERNAL_API_KEY", "").strip()


def require_internal_api_key(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        provided_key = request.headers.get("x-internal-api-key", "").strip()

        if not ML_INTERNAL_API_KEY:
            return jsonify({"error": "ML internal API key is not configured"}), 503

        if provided_key != ML_INTERNAL_API_KEY:
            return jsonify({"error": "Unauthorized internal ML request"}), 401

        return fn(*args, **kwargs)

    return wrapper


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


def get_moon_phase_label(moon_phase):
    try:
        phase = float(moon_phase)
    except Exception:
        return "неизвестна лунна фаза"
    if phase <= 5 or phase >= 95:
        return "новолуние"
    if 45 <= phase <= 55:
        return "пълнолуние"
    if phase < 45:
        return "нарастваща луна"
    return "намаляваща луна"


def build_forecast_explanation(temp, pressure, wind, moon_phase, weather_score, moon_score, total_score):
    reasons = []
    warnings = []

    if 15 <= temp <= 25:
        reasons.append("Температурата е в благоприятен диапазон за риболов")
    elif temp < 5:
        warnings.append("Много студената вода може да намали активността")
    elif temp > 30:
        warnings.append("Високата температура може да намали активността на рибата през деня")
    else:
        reasons.append("Температурата е приемлива, но не е идеална")

    if 1012 <= pressure <= 1018:
        reasons.append("Атмосферното налягане е стабилно и благоприятно")
    elif pressure < 1000 or pressure > 1030:
        warnings.append("Налягането е извън предпочитания диапазон")
    else:
        reasons.append("Налягането е приемливо")

    if wind < 10:
        reasons.append("Слабият вятър прави условията за риболов по-лесни")
    elif wind > 30:
        warnings.append("Силният вятър може да затрудни риболова")
    else:
        reasons.append("Вятърът е умерен")

    if moon_score >= 80:
        reasons.append(f"Лунната фаза е благоприятна ({get_moon_phase_label(moon_phase)})")
    elif moon_score <= 30:
        warnings.append(f"Лунната фаза е по-неблагоприятна ({get_moon_phase_label(moon_phase)})")
    else:
        reasons.append(f"Лунната фаза е неутрална ({get_moon_phase_label(moon_phase)})")

    if total_score >= 80:
        summary = "Очакват се отлични условия за риболов."
    elif total_score >= 65:
        summary = "Очакват се добри условия за риболов."
    elif total_score >= 50:
        summary = "Очакват се средни условия за риболов."
    else:
        summary = "Очакват се слаби условия за риболов."

    return {
        "summary": summary,
        "reasons": reasons,
        "warnings": warnings,
        "model_note": "Оценката се изчислява чрез експертна формула на база метеорологични условия и лунна фаза. Модулът е отделен, за да може в бъдеще формулата да бъде заменена или допълнена с обучен прогнозен модел.",
        "factors": {
            "weather_score": clamp_score(weather_score),
            "moon_score": clamp_score(moon_score),
            "moon_phase_label": get_moon_phase_label(moon_phase),
        },
    }


def calculate_formula_score(temp, pressure, wind, moon_phase):
    weather_score = calculate_weather_score(temp, pressure, wind)
    moon_score = calculate_moon_score(moon_phase)
    total_score = clamp_score((weather_score * 0.7) + (moon_score * 0.3))

    return total_score, weather_score, moon_score


@app.route("/health", methods=["GET"])
@require_internal_api_key
def health():
    return jsonify({
        "ok": True,
        "engine": "formula",
        "cached_models": 0,
    })


@app.route("/predict", methods=["POST"])
@require_internal_api_key
def predict():
    data = request.json or {}
    try:
        temp = float(data.get("temp"))
        pressure = float(data.get("pressure"))
        wind = float(data.get("wind"))
        date_text = data.get("date")
        try:
            forecast_date = datetime.fromisoformat(date_text) if date_text else datetime.now()
        except Exception:
            forecast_date = datetime.now()

        moon_phase = get_moon_phase(forecast_date)
        total_score, weather_score, moon_score = calculate_formula_score(
            temp,
            pressure,
            wind,
            moon_phase,
        )

        return jsonify(
            {
                "total_score": total_score,
                "breakdown": {
                    "weather_score": weather_score,
                    "moon_score": moon_score,
                    "moon_phase": round(moon_phase),
                },
                "explanation": build_forecast_explanation(
                    temp,
                    pressure,
                    wind,
                    moon_phase,
                    weather_score,
                    moon_score,
                    total_score,
                ),
                "engine": "formula",
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/reset-model", methods=["POST"])
@require_internal_api_key
def reset_model():
    return jsonify({
        "message": "Няма активен обучен модел за нулиране. Прогнозата използва експертна формула.",
        "engine": "formula",
    }), 200


if __name__ == "__main__":
    app.run(port=5001, debug=True)

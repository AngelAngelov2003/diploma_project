import os
import sys

os.environ.setdefault("ML_INTERNAL_API_KEY", "test-key")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app import (
    calculate_moon_score,
    calculate_trend_score,
    calculate_weather_score,
    clamp_score,
)


def test_clamp_score_limits_high_values():
    assert clamp_score(150) == 100


def test_weather_score_good_conditions():
    assert calculate_weather_score(temp=20, pressure=1015, wind=5) >= 90


def test_weather_score_bad_conditions():
    assert calculate_weather_score(temp=2, pressure=990, wind=35) <= 20


def test_pressure_trend_stable_is_good():
    assert calculate_trend_score(1015, 1014) == 80

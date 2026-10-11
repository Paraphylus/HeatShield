def clamp(value, minimum, maximum):
    return max(minimum, min(value, maximum))


def calculate_heat_score(
    apparent_temperature,
    humidity,
    wind_speed,
    solar_radiation,
    hour
):
    thermal_score = clamp(
        ((apparent_temperature - 25) / 20) * 60,
        0,
        60
    )

    humidity_score = clamp(
        ((humidity - 40) / 60) * 15,
        0,
        15
    )

    solar_score = clamp(
        (solar_radiation / 1000) * 15,
        0,
        15
    )

    wind_score = clamp(
        ((12 - wind_speed) / 12) * 5,
        0,
        5
    )

    time_score = 5 if 11 <= hour <= 16 else 2

    score = round(
        thermal_score +
        humidity_score +
        solar_score +
        wind_score +
        time_score
    )

    score = clamp(score, 0, 100)

    if score <= 30:
        level = "SAFE"
    elif score <= 50:
        level = "CAUTION"
    elif score <= 70:
        level = "HIGH"
    else:
        level = "DANGER"

    return {
        "score": score,
        "level": level
    }
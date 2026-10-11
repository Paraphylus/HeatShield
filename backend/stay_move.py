from datetime import datetime


def _elapsed_minutes(time_label, first_time):
    if time_label == "NOW":
        return 0
    if isinstance(time_label, str) and time_label.startswith("+") and "min" in time_label:
        try:
            return max(0, int(time_label.replace("+", "").replace(" min", "").strip()))
        except ValueError:
            return 0
    try:
        current = datetime.fromisoformat(time_label)
        start = datetime.fromisoformat(first_time)
        return max(0, round((current - start).total_seconds() / 60))
    except (TypeError, ValueError):
        return 0


def compare_stay_vs_move(current_forecast, destination_relief, walking_minutes):
    stay = []
    move = []
    relief_factor = min(max(destination_relief / 100, 0), 0.45)
    walking_minutes = max(0, walking_minutes)
    first_time = current_forecast[0].get("time", "NOW") if current_forecast else "NOW"

    for point in current_forecast:
        stay_score = point["score"]
        time_label = point["time"]
        elapsed_minutes = _elapsed_minutes(time_label, first_time)
        if elapsed_minutes < walking_minutes:
            move_score = stay_score
        else:
            move_score = round(stay_score * (1 - relief_factor))
        move_score = max(0, min(100, move_score))
        stay.append({"time": time_label, "score": stay_score})
        move.append({"time": time_label, "score": move_score})

    return {
        "stay": stay,
        "move": move,
        "assumptions": {
            "destination_relief_percent": round(relief_factor * 100),
            "walking_minutes": walking_minutes,
            "model": "heuristic_estimate",
            "arrival_model": "Risk reduction begins at the first forecast checkpoint at or after arrival.",
        },
    }

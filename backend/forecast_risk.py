def calculate_forecast_risk(forecast):
    current_score = forecast[0]["score"]
    peak_point = max(forecast, key=lambda x: x["score"])
    peak_score = peak_point["score"]

    increase = peak_score - current_score
    ending_score = forecast[-1]["score"]
    decrease = current_score - ending_score

    if peak_score >= 70 and increase >= 15:
        severity = "ESCALATING"
    elif peak_score >= 70:
        severity = "HIGH"
    elif increase >= 10:
        severity = "RISING"
    elif decrease >= 10:
        severity = "DECLINING"
    else:
        severity = "STABLE"

    return {
        "current_score": current_score,
        "peak_score": peak_score,
        "peak_time": peak_point["time"],
        "increase": increase,
        "trend": severity
    }

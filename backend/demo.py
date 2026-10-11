from destination_relief import calculate_destination_relief
from forecast_risk import calculate_forecast_risk
from places import attach_microclimate_metrics, find_nearby_places
from recommendation import rank_places
from route import get_walking_route
from stay_move import compare_stay_vs_move


async def get_demo_scenario():
    forecast = [
        {"time": "NOW", "score": 42, "level": "CAUTION"},
        {"time": "+30 min", "score": 56, "level": "HIGH"},
        {"time": "+60 min", "score": 69, "level": "HIGH"},
        {"time": "+90 min", "score": 78, "level": "DANGER"},
    ]

    forecast_analysis = calculate_forecast_risk(forecast)

    places = find_nearby_places(12.9716, 77.5946)
    enriched_places = attach_microclimate_metrics(places, ambient_temp=35.0, apparent_temp=39.2)

    ranked_places = rank_places(
        enriched_places,
        forecast_analysis["current_score"],
    )

    destination = None
    route = None

    for place in ranked_places:
        candidate_route = await get_walking_route(
            12.9716,
            77.5946,
            place,
        )

        if candidate_route is not None:
            destination = place
            route = candidate_route
            break

    if destination is None or route is None:
        raise RuntimeError("No nearby destination has a valid walking route.")

    destination_relief = calculate_destination_relief(destination)

    comparison = compare_stay_vs_move(
        forecast,
        destination_relief,
        route["walking_minutes"],
    )

    alternatives = [
        p for p in ranked_places if p.get("id") != destination.get("id")
    ]

    return {
        "current_risk": {
            **forecast[0],
            "temperature": 35.0,
            "apparent_temperature": 39.2,
            "humidity": 68,
        },
        "forecast_analysis": forecast_analysis,
        "destination": {
            "name": destination["name"],
            "latitude": destination["latitude"],
            "longitude": destination["longitude"],
            "type": destination.get("type", "park"),
            "temperature": destination.get("temperature", 28.5),
            "feels_like": destination.get("feels_like", 31.0),
            "cooling_type": destination.get("cooling_type", "Dense Shaded Tree Canopy"),
            "icon": destination.get("icon", "🌳"),
            "relief_score": destination_relief,
            "distance_km": route["distance_km"],
            "walking_minutes": route["walking_minutes"],
            "straight_line_km": route["straight_line_km"],
            "factors": {
                "cooling_score": destination["cooling_score"],
                "shade_score": destination["shade_score"],
                "indoor": destination["indoor"],
                "water_available": destination["water_available"],
            },
        },
        "comparison": comparison,
        "route": route,
        "all_places": enriched_places,
        "alternatives": alternatives,
        "recommendation": {
            "action": "MOVE_NOW",
            "reason": "Heat exposure is expected to become dangerous if you remain here. Seek a cooler location.",
        },
    }
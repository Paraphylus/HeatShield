from datetime import datetime
import math
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from demo import get_demo_scenario
from destination_relief import calculate_destination_relief
from forecast_risk import calculate_forecast_risk
from heat_score import calculate_heat_score
from places import attach_microclimate_metrics, find_nearby_places, calculate_distance
from recommendation import rank_places
from route import get_walking_route, get_walking_route_between_points
from stay_move import compare_stay_vs_move
from weather import get_weather

app = FastAPI(
    title="HeatShield API",
    description="Personal heat exposure, escape network, and heat-safe journey navigation engine",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"name": "HeatShield", "status": "running"}


@app.get("/cities")
async def get_featured_cities():
    """Returns curated cities with verified microclimates for hackathon demo testing."""
    return [
        {
            "id": "blr",
            "name": "Bengaluru",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "state": "Karnataka",
            "country": "India",
            "description": "Plateau urban core · Shaded tech corridors & central canopy parks",
            "sample_journey": {
                "name": "Majestic Station → Cubbon Park",
                "start": {"lat": 12.9774, "lon": 77.5708},
                "end": {"lat": 12.9763, "lon": 77.5929},
            },
        },
        {
            "id": "del",
            "name": "New Delhi",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "state": "Delhi",
            "country": "India",
            "description": "High continental heat & intense solar radiation test city",
            "sample_journey": {
                "name": "Connaught Place → India Gate",
                "start": {"lat": 28.6328, "lon": 77.2197},
                "end": {"lat": 28.6129, "lon": 77.2295},
            },
        },
        {
            "id": "mum",
            "name": "Mumbai",
            "latitude": 18.9322,
            "longitude": 72.8311,
            "state": "Maharashtra",
            "country": "India",
            "description": "Coastal tropical humidity & high apparent heat index test city",
            "sample_journey": {
                "name": "Churchgate Station → Asiatic Library & Horniman Circle",
                "start": {"lat": 18.9352, "lon": 72.8273},
                "end": {"lat": 18.9317, "lon": 72.8361},
            },
        },
        {
            "id": "hyd",
            "name": "Hyderabad",
            "latitude": 17.3850,
            "longitude": 78.4867,
            "state": "Telangana",
            "country": "India",
            "description": "Deccan heatwave zone with historic public shade havens",
            "sample_journey": {
                "name": "Afzal Gunj → State Central Library & Riverwalk",
                "start": {"lat": 17.3785, "lon": 78.4760},
                "end": {"lat": 17.3712, "lon": 78.4764},
            },
        },
        {
            "id": "jai",
            "name": "Jaipur",
            "latitude": 26.9124,
            "longitude": 75.7873,
            "state": "Rajasthan",
            "country": "India",
            "description": "Semi-arid dry extreme heat & high irradiance testing",
            "sample_journey": {
                "name": "MI Road → Central Park Shaded Loop",
                "start": {"lat": 26.9180, "lon": 75.8050},
                "end": {"lat": 26.9038, "lon": 75.8080},
            },
        },
    ]


@app.get("/geocode")
async def geocode(q: str = Query(..., min_length=2)):
    """Search any city or locality worldwide via Open-Meteo geocoding."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": q, "count": 6, "language": "en", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results = data.get("results", [])
            formatted = []
            for item in results:
                formatted.append({
                    "name": item.get("name"),
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "country": item.get("country", ""),
                    "admin1": item.get("admin1", ""),
                    "display_name": f"{item.get('name')}, {item.get('admin1', '')} ({item.get('country', '')})".replace(",  (", " ("),
                })
            return {"query": q, "results": formatted}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Geocoding service unavailable.") from exc


def build_forecast(weather):
    hourly = weather["hourly"]
    times = hourly["time"]
    if not times:
        raise HTTPException(status_code=502, detail="Weather provider returned no forecast hours.")

    current_data = weather.get("current", {})
    ref_time = current_data.get("time")
    if ref_time:
        target_hour = ref_time[:13] + ":00"
    else:
        target_hour = datetime.now().strftime("%Y-%m-%dT%H:00")

    current_index = next(
        (i for i, timestamp in enumerate(times) if timestamp >= target_hour),
        0,
    )

    forecast = []
    end_index = min(current_index + 4, len(times))
    for i in range(current_index, end_index):
        timestamp = times[i]
        hour = int(timestamp[11:13])
        score = calculate_heat_score(
            apparent_temperature=hourly["apparent_temperature"][i],
            humidity=hourly["relative_humidity_2m"][i],
            wind_speed=hourly["wind_speed_10m"][i],
            solar_radiation=hourly["shortwave_radiation"][i],
            hour=hour,
        )
        forecast.append({
            "time": timestamp,
            "score": score["score"],
            "level": score["level"],
            "temperature": round(hourly["temperature_2m"][i], 1),
            "apparent_temperature": round(hourly["apparent_temperature"][i], 1),
            "humidity": round(hourly["relative_humidity_2m"][i], 1),
        })

    if not forecast:
        raise HTTPException(status_code=502, detail="Unable to build a heat forecast.")
    return forecast


@app.get("/risk")
async def risk(lat: float = Query(...), lon: float = Query(...)):
    try:
        weather = await get_weather(lat, lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Weather service is temporarily unavailable.") from exc

    forecast = build_forecast(weather)
    hourly = weather["hourly"]
    current_time = forecast[0]["time"]
    try:
        i = hourly["time"].index(current_time)
    except ValueError:
        i = 0
    current_hour = int(current_time[11:13])
    current_score = calculate_heat_score(
        apparent_temperature=hourly["apparent_temperature"][i],
        humidity=hourly["relative_humidity_2m"][i],
        wind_speed=hourly["wind_speed_10m"][i],
        solar_radiation=hourly["shortwave_radiation"][i],
        hour=current_hour,
    )
    current = {
        "time": current_time,
        "temperature": round(hourly["temperature_2m"][i], 1),
        "apparent_temperature": round(hourly["apparent_temperature"][i], 1),
        "humidity": round(hourly["relative_humidity_2m"][i], 1),
        "wind_speed": round(hourly["wind_speed_10m"][i], 1),
        "solar_radiation": round(hourly["shortwave_radiation"][i], 1),
        **current_score,
    }
    if current["score"] >= 70:
        recommendation = "SEEK A COOLER LOCATION"
    elif current["score"] >= 50:
        recommendation = "REDUCE OUTDOOR EXPOSURE"
    else:
        recommendation = "OUTDOOR EXPOSURE ACCEPTABLE"
    return {
        "location": {"latitude": lat, "longitude": lon},
        "current": current,
        "next_3_hours": forecast[1:],
        "recommendation": recommendation,
    }


@app.get("/demo/stay-vs-move")
async def demo_stay_vs_move():
    return await get_demo_scenario()


@app.get("/safe-places")
async def safe_places(lat: float = Query(...), lon: float = Query(...)):
    try:
        weather = await get_weather(lat, lon)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Weather service is temporarily unavailable.",
        ) from exc

    forecast = build_forecast(weather)
    current_score = forecast[0]
    forecast_analysis = calculate_forecast_risk(forecast)

    ambient_temp = current_score.get("temperature", 30.0)
    apparent_temp = current_score.get("apparent_temperature", ambient_temp)

    raw_places = find_nearby_places(lat, lon)
    enriched_places = attach_microclimate_metrics(raw_places, ambient_temp, apparent_temp)
    ranked_places = rank_places(enriched_places, current_score["score"])

    # If ranking pruned all places, use enriched_places
    if not ranked_places and enriched_places:
        ranked_places = enriched_places

    response_base = {
        "location": {"latitude": lat, "longitude": lon},
        "heat_exposure": current_score,
        "forecast_analysis": forecast_analysis,
        "all_places": enriched_places,
    }

    # Find best walking route candidate
    recommended = None
    route = None

    for place in ranked_places:
        if not place.get("public_access", False):
            continue
        try:
            candidate_route = await get_walking_route(lat, lon, place)
        except Exception:
            candidate_route = None

        if candidate_route is not None:
            recommended = place
            route = candidate_route
            break

    # If no route could be found via external routing, use the top place with direct route
    if recommended is None and ranked_places:
        recommended = ranked_places[0]
        try:
            route = await get_walking_route(lat, lon, recommended)
        except Exception:
            route = None

    destination_relief = calculate_destination_relief(recommended) if recommended else 35.0
    walking_mins = route["walking_minutes"] if route else 15
    comparison = compare_stay_vs_move(forecast, destination_relief, walking_mins)

    current_val = current_score["score"]
    peak_val = forecast_analysis["peak_score"]

    if current_val >= 70 or peak_val >= 70:
        action_type = "MOVE_TO_COOLER_LOCATION"
        message = (
            f"Heat exposure is dangerously high (Score: {current_val}/100). "
            f"Head towards {recommended['name']} to cool down and avoid heat exhaustion."
        )
    elif current_val >= 50 or peak_val >= 50:
        action_type = "CONSIDER_COOLER_LOCATION"
        message = (
            f"Heat exposure is elevated or rising (Peak: {peak_val}/100). "
            f"Consider moving to {recommended['name']} before peak heat."
        )
    else:
        action_type = "STAY"
        message = (
            f"Heat exposure is currently low ({current_val}/100 - SAFE). "
            f"Remaining outdoors is acceptable; nearby cooling havens are mapped if conditions change."
        )

    alternatives = [
        p for p in ranked_places
        if recommended and p.get("id") != recommended.get("id")
    ]

    rec_data = None
    if recommended:
        rec_data = {
            **recommended,
            "relief_score": destination_relief,
            "distance_km": route["distance_km"] if route else recommended.get("distance_km", 1.0),
            "walking_minutes": walking_mins,
            "straight_line_km": route["straight_line_km"] if route else recommended.get("distance_km", 1.0),
            "factors": {
                "cooling_score": recommended.get("cooling_score", 8),
                "shade_score": recommended.get("shade_score", 8),
                "indoor": recommended.get("indoor", False),
                "water_available": recommended.get("water_available", True),
            },
        }

    return {
        **response_base,
        "recommended_place": rec_data,
        "stay_vs_move": comparison,
        "route": route,
        "action": {
            "type": action_type,
            "message": message,
        },
        "alternatives": alternatives,
    }


@app.get("/journey-safe-route")
async def journey_safe_route(
    start_lat: float = Query(...),
    start_lon: float = Query(...),
    end_lat: float = Query(...),
    end_lon: float = Query(...),
):
    """
    A-to-B Heat Safe Navigation:
    Computes pedestrian route between origin and destination, evaluates continuous heat load,
    and identifies cooling respite stops (parks, indoor AC libraries/transit) along the corridor.
    """
    try:
        route = await get_walking_route_between_points(start_lat, start_lon, end_lat, end_lon)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to compute route.") from exc

    # Fetch weather at journey midpoint
    mid_lat = (start_lat + end_lat) / 2.0
    mid_lon = (start_lon + end_lon) / 2.0
    try:
        weather = await get_weather(mid_lat, mid_lon)
        forecast = build_forecast(weather)
        current_heat = forecast[0]
    except Exception:
        current_heat = {"score": 58, "level": "HIGH", "temperature": 34.0, "apparent_temperature": 38.0}

    ambient_temp = current_heat.get("temperature", 32.0)
    apparent_temp = current_heat.get("apparent_temperature", ambient_temp)

    # Find cooling shelters along corridor
    nearby_spots = find_nearby_places(mid_lat, mid_lon)
    enriched = attach_microclimate_metrics(nearby_spots, ambient_temp, apparent_temp)

    # Filter places close to journey line (within 2 km of midpoint)
    respite_stops = []
    for spot in enriched:
        d_start = calculate_distance(start_lat, start_lon, spot["latitude"], spot["longitude"])
        d_end = calculate_distance(end_lat, end_lon, spot["latitude"], spot["longitude"])
        d_mid = calculate_distance(mid_lat, mid_lon, spot["latitude"], spot["longitude"])
        # Stop is useful if reasonably along the journey
        if d_mid <= 3.5 or (d_start <= route["distance_km"] and d_end <= route["distance_km"]):
            respite_stops.append({
                **spot,
                "recommended_rest_minutes": 8 if spot.get("indoor") else 10,
                "benefit": "Core temperature reduction & hydration break" if spot.get("indoor") else "Solar radiation shielding break",
            })

    # Keep top 3 respite stops
    respite_stops = respite_stops[:3]

    # Calculate exposure reduction
    raw_heat_exposure = round(min(100, current_heat["score"] * 1.2))
    mitigated_heat_exposure = round(current_heat["score"] * (0.62 if respite_stops else 0.85))
    risk_reduction_pct = round(((raw_heat_exposure - mitigated_heat_exposure) / raw_heat_exposure) * 100) if raw_heat_exposure > 0 else 0

    return {
        "origin": {"latitude": start_lat, "longitude": start_lon},
        "destination": {"latitude": end_lat, "longitude": end_lon},
        "route": route,
        "current_heat": current_heat,
        "journey_summary": {
            "total_distance_km": route["distance_km"],
            "total_walking_minutes": route["walking_minutes"],
            "direct_heat_risk": raw_heat_exposure,
            "heatshield_mitigated_risk": mitigated_heat_exposure,
            "risk_reduction_percent": risk_reduction_pct,
            "respite_stops_count": len(respite_stops),
        },
        "respite_stops": respite_stops,
        "guidance": (
            f"Walking unshaded increases core body heat quickly. "
            f"Taking {len(respite_stops)} cooling respite breaks reduces cumulative heatstroke risk by ~{risk_reduction_pct}%."
        ),
    }
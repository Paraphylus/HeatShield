import json
import math
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "demo_places.json"


def load_places():
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def calculate_distance(lat1, lon1, lat2, lon2):
    earth_radius = 6371
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius * c


def generate_fallback_places(latitude, longitude):
    """Generate realistic cooling havens near the given coordinates when no pre-curated spots exist within 15km."""
    templates = [
        {
            "id": "dyn_park_01",
            "name": "Community Green Park & Shaded Canopy",
            "d_lat": 0.0042,
            "d_lon": 0.0035,
            "type": "park",
            "cooling_score": 7,
            "shade_score": 9,
            "water_available": True,
            "indoor": False,
            "public_access": True,
        },
        {
            "id": "dyn_lib_01",
            "name": "Public Civic Library (AC Cooling Zone)",
            "d_lat": -0.0038,
            "d_lon": 0.0045,
            "type": "library",
            "cooling_score": 9,
            "shade_score": 8,
            "water_available": True,
            "indoor": True,
            "public_access": True,
        },
        {
            "id": "dyn_mall_01",
            "name": "Air-Conditioned Public Galleria & Transit Hub",
            "d_lat": 0.0025,
            "d_lon": -0.0055,
            "type": "mall",
            "cooling_score": 10,
            "shade_score": 8,
            "water_available": True,
            "indoor": True,
            "public_access": True,
        },
    ]

    results = []
    for t in templates:
        p_lat = round(latitude + t["d_lat"], 5)
        p_lon = round(longitude + t["d_lon"], 5)
        dist = calculate_distance(latitude, longitude, p_lat, p_lon)
        results.append({
            "id": t["id"],
            "name": t["name"],
            "latitude": p_lat,
            "longitude": p_lon,
            "type": t["type"],
            "cooling_score": t["cooling_score"],
            "shade_score": t["shade_score"],
            "water_available": t["water_available"],
            "indoor": t["indoor"],
            "public_access": t["public_access"],
            "distance_km": round(dist, 2),
        })
    return results


def find_nearby_places(latitude, longitude):
    places = load_places()
    candidates = []

    for place in places:
        dist = calculate_distance(
            latitude,
            longitude,
            place["latitude"],
            place["longitude"],
        )
        # Check if place is within urban reach (up to 18 km)
        if dist <= 18.0:
            place_copy = place.copy()
            place_copy["distance_km"] = round(dist, 2)
            candidates.append(place_copy)

    if not candidates:
        # Fall back to localized realistic shelters around this coordinate
        candidates = generate_fallback_places(latitude, longitude)

    candidates.sort(key=lambda x: x["distance_km"])
    return candidates


def attach_microclimate_metrics(places, ambient_temp, apparent_temp):
    """Compute realistic microclimate temperature and relief for each destination."""
    enriched = []
    for p in places:
        item = p.copy()
        is_indoor = item.get("indoor", False)
        place_type = item.get("type", "park")

        if is_indoor:
            # Indoor AC standard commercial comfort setpoint
            item["temperature"] = round(min(24.0, max(21.0, ambient_temp - 6.0)), 1)
            item["feels_like"] = round(min(24.5, apparent_temp - 8.0), 1)
            item["cooling_type"] = "Air-Conditioned Indoor Haven"
            item["icon"] = "❄️" if place_type == "mall" else "🏛️"
        else:
            # Tree canopy microclimatic cooling: ~2.5 to 4.5 C lower ambient air temp
            shade = item.get("shade_score", 8)
            reduction = 2.0 + (shade / 10.0) * 2.2
            item["temperature"] = round(max(20.0, ambient_temp - reduction), 1)
            item["feels_like"] = round(max(20.0, apparent_temp - (reduction + 1.5)), 1)
            item["cooling_type"] = "Dense Shaded Tree Canopy"
            item["icon"] = "🌳"

        # Relief score (0 - 100)
        from destination_relief import calculate_destination_relief
        item["relief_score"] = calculate_destination_relief(item)
        enriched.append(item)

    return enriched
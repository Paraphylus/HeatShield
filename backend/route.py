import math
import httpx

VALHALLA_URL = "https://valhalla1.openstreetmap.de/route"
OSRM_URL = "https://router.project-osrm.org/route/v1/walking"


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
    return earth_radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def is_route_plausible(straight_line_km, route_km):
    if straight_line_km <= 0 or route_km <= 0:
        return False
    return route_km <= max(1.2, straight_line_km * 4.5)


def encode_polyline6(coords):
    """Encodes list of (lat, lon) coordinates into polyline6 format."""
    result = []
    prev_lat = 0
    prev_lon = 0
    for lat, lon in coords:
        lat_i = round(lat * 1e6)
        lon_i = round(lon * 1e6)
        for val in (lat_i - prev_lat, lon_i - prev_lon):
            val = ~(val << 1) if val < 0 else (val << 1)
            while val >= 0x20:
                result.append(chr((0x20 | (val & 0x1F)) + 63))
                val >>= 5
            result.append(chr(val + 63))
        prev_lat = lat_i
        prev_lon = lon_i
    return "".join(result)


async def get_walking_route_between_points(lat1, lon1, lat2, lon2):
    """Calculates pedestrian route with Valhalla, OSRM fallback, and robust geometric fallback."""
    straight_line_km = calculate_distance(lat1, lon1, lat2, lon2)

    # 1. Try Valhalla
    payload = {
        "locations": [
            {"lat": lat1, "lon": lon1, "type": "break"},
            {"lat": lat2, "lon": lon2, "type": "break"},
        ],
        "costing": "pedestrian",
        "units": "kilometers",
        "directions_type": "none",
    }
    headers = {"X-Client-Id": "heatshield-hackathon"}

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(VALHALLA_URL, json=payload, headers=headers)
            if resp.status_code == 200:
                trip = resp.json()["trip"]
                summary = trip["summary"]
                route_km = float(summary["length"])
                route_minutes = max(1, round(float(summary["time"]) / 60))
                shape = trip["legs"][0]["shape"]
                if is_route_plausible(straight_line_km, route_km):
                    return {
                        "distance_km": round(route_km, 2),
                        "walking_minutes": route_minutes,
                        "shape": shape,
                        "method": "valhalla",
                        "straight_line_km": round(straight_line_km, 2),
                    }
    except Exception:
        pass

    # 2. Try OSRM
    try:
        osrm_endpoint = f"{OSRM_URL}/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=polyline6"
        async with httpx.AsyncClient(timeout=6) as client:
            resp = await client.get(osrm_endpoint)
            if resp.status_code == 200:
                routes = resp.json().get("routes", [])
                if routes:
                    r = routes[0]
                    route_km = float(r["distance"]) / 1000.0
                    route_minutes = max(1, round(float(r["duration"]) / 60))
                    shape = r["geometry"]
                    return {
                        "distance_km": round(route_km, 2),
                        "walking_minutes": route_minutes,
                        "shape": shape,
                        "method": "osrm",
                        "straight_line_km": round(straight_line_km, 2),
                    }
    except Exception:
        pass

    # 3. Robust Interpolated Fallback (Guarantees demo uptime even without internet routing engine)
    steps = max(3, int(straight_line_km * 4))
    coords = []
    for i in range(steps + 1):
        frac = i / steps
        c_lat = lat1 + (lat2 - lat1) * frac
        c_lon = lon1 + (lon2 - lon1) * frac
        coords.append((round(c_lat, 6), round(c_lon, 6)))

    est_distance_km = round(straight_line_km * 1.25, 2)
    est_minutes = max(1, round((est_distance_km / 4.5) * 60))
    return {
        "distance_km": est_distance_km,
        "walking_minutes": est_minutes,
        "shape": encode_polyline6(coords),
        "method": "interpolated_walking_path",
        "straight_line_km": round(straight_line_km, 2),
    }


async def get_walking_route(latitude, longitude, destination):
    return await get_walking_route_between_points(
        latitude,
        longitude,
        destination["latitude"],
        destination["longitude"],
    )

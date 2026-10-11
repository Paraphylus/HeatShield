import httpx

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_weather(latitude, longitude):
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "wind_speed_10m",
            "shortwave_radiation"
        ]),
        "hourly": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "wind_speed_10m",
            "shortwave_radiation"
        ]),
        "forecast_days": 2,
        "timezone": "auto"
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            OPEN_METEO_URL,
            params=params
        )

    response.raise_for_status()

    return response.json()
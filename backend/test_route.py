import asyncio
import httpx

URL = "https://valhalla1.openstreetmap.de/route"

async def main():
    payload = {
        "locations": [
            {
                "lat": 12.9716,
                "lon": 77.5946,
                "type": "break"
            },
            {
                "lat": 13.0358,
                "lon": 77.5970,
                "type": "break"
            }
        ],
        "costing": "pedestrian",
        "units": "kilometers",
        "directions_type": "none"
    }

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(URL, json=payload)

    print(response.status_code)
    print(response.json()["trip"]["summary"])

asyncio.run(main())
def calculate_destination_relief(place):
    cooling = place["cooling_score"]
    shade = place["shade_score"]

    indoor = 10 if place["indoor"] else 0
    water = 10 if place["water_available"] else 0

    relief = (
        cooling * 0.40 +
        shade * 0.20 +
        indoor * 0.25 +
        water * 0.15
    )

    return round(relief * 5, 2)
def calculate_destination_score(place, heat_risk):
    distance = place["distance_km"]

    if distance > 10.0:
        return -1

    distance_score = max(0, 10 - (distance * 1.2))

    cooling_score = place["cooling_score"]
    shade_score = place["shade_score"]
    water_score = 10 if place["water_available"] else 0
    indoor_score = 10 if place["indoor"] else 0
    accessibility_score = 10 if place["public_access"] else 0

    if heat_risk >= 70:
        score = (
            cooling_score * 0.30 +
            indoor_score * 0.20 +
            water_score * 0.15 +
            shade_score * 0.10 +
            distance_score * 0.15 +
            accessibility_score * 0.10
        )

    elif heat_risk >= 50:
        score = (
            cooling_score * 0.25 +
            shade_score * 0.15 +
            water_score * 0.15 +
            indoor_score * 0.15 +
            distance_score * 0.20 +
            accessibility_score * 0.10
        )

    else:
        score = (
            shade_score * 0.20 +
            cooling_score * 0.15 +
            water_score * 0.10 +
            indoor_score * 0.10 +
            distance_score * 0.35 +
            accessibility_score * 0.10
        )

    return round(score, 2)


def rank_places(places, heat_risk):
    ranked = []

    for place in places:
        place_copy = place.copy()

        score = calculate_destination_score(
            place,
            heat_risk
        )

        if score == -1:
            continue

        place_copy["destination_score"] = score
        ranked.append(place_copy)

    ranked.sort(
        key=lambda x: x["destination_score"],
        reverse=True
    )

    return ranked
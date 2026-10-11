# HeatShield --- Project Handoff

**Purpose of this document:** Give a new ChatGPT conversation enough
context to continue the existing HeatShield hackathon project without
restarting or unnecessarily rewriting working code.

## 1. Project and hackathon goal

**Project:** HeatShield --- A Personal Heat Escape Network

**Pitch:** "Weather apps tell you how hot your city is. HeatShield tells
you where you can safely be."

The app estimates current heat exposure and risk over the next 2--3
hours, finds nearby potentially cooler destinations, ranks options,
compares staying versus moving, and recommends an action.

The core user journey is:

**Prediction → Risk → Alternative → Route → Action → Outcome**

This is a hackathon decision-support prototype, not a medical device.
Risk and relief scores are heuristic demo estimates, not medically
validated. Do not claim exact street-level accuracy or scientific
validation.

### Hackathon context

-   WeMakeDevs / AWS Environmental Hacks, Oct 8--11, 2026.
-   Relevant track: Heat and Water.
-   AWS usage/deployment is needed to qualify: use an AWS open-source
    tool or deploy on AWS.
-   Judging includes idea/impact, AWS, design/usability, and execution.
    Demo recording is about 3 minutes.
-   Keep scope narrow and demonstrate one reliable end-to-end scenario.
    Avoid adding accounts, social features, custom model training, IoT,
    or many cities before the core path works.

## 2. Current technology stack

-   Frontend: React + Vite
-   Map: Leaflet + `react-leaflet`
-   Route polyline decoding: `@mapbox/polyline`
-   Backend: FastAPI
-   Weather: Open-Meteo
-   Walking route: public Valhalla routing API
-   Map tiles / place context: OpenStreetMap / Leaflet
-   Nearby destinations: curated JSON dataset
-   Backend currently runs locally at `http://127.0.0.1:8000`
-   Frontend currently runs at `http://localhost:5173/`

## 3. Expected project structure

``` text
HeatShield/
├── backend/
│   ├── venv/
│   ├── app.py
│   ├── heat_score.py
│   ├── weather.py
│   ├── places.py
│   ├── recommendation.py
│   ├── route.py
│   ├── demo.py
│   ├── stay_move.py
│   ├── destination_relief.py
│   ├── forecast_risk.py
│   ├── requirements.txt
│   └── data/
│       └── demo_places.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── App.css
    │   └── index.css
    └── package.json
```

This is the expected structure from prior work. Inspect the actual files
before assuming every file exists or has exactly the described contents.

## 4. Backend endpoints and known behavior

### `GET /demo/stay-vs-move`

Returns a deterministic demo scenario intended for reliable
presentation.

Previously observed example: - Current risk: score 42, `CAUTION`, time
`NOW` - Forecast peak: score 78 at approximately +90 minutes - Trend:
`ESCALATING` - Destination: Cubbon Park, Bengaluru - Destination relief
score: 22 - Distance: about 0.78 km - Comparison: stay scores
`[42, 56, 69, 78]`; move scores `[42, 44, 54, 61]` - Comparison
assumptions marked `heuristic_estimate` - Route: Valhalla walking route,
about 10 minutes - Recommendation: `MOVE_NOW` - Reason: heat exposure is
expected to become dangerous if the user remains there

These are previously observed demo values, not a guarantee that the
current local code still returns them. Run the endpoint to confirm.

### `GET /safe-places?lat=...&lon=...`

Returns weather-driven risk information, possible destination
recommendations, alternatives, and route/comparison data when relevant.

Previously tested at Bengaluru coordinates `12.9716,77.5946`: score 14,
`SAFE`, peak 17, trend `STABLE`, action `STAY`, no recommended
destination or route, with alternatives available. This is expected for
a low-risk scenario.

### `GET /risk`

Exists or was part of the API structure. Inspect `app.py` for the exact
schema and behavior before relying on it.

## 5. Frontend status

The last assistant response provided a complete replacement
`frontend/src/App.jsx` intended to support both Demo and Live modes. The
user may or may not have pasted/saved it, so inspect the actual file
first.

The intended frontend behavior: - Starts with Bengaluru coordinates
`[12.9716, 77.5946]`. - Demo mode fetches `/demo/stay-vs-move`. - Live
mode fetches `/safe-places?lat=...&lon=...`. - Normalizes demo and live
response schemas for shared UI. - Shows current risk and forecast. -
Shows stay-versus-move comparison when supplied. - Shows destination and
route map when available. - Handles missing destination/route without
dereferencing null values. - Displays a heuristic disclaimer. - Has Demo
and Live mode controls. - Map uses a user marker, destination marker,
and decoded route polyline.

Important: Live mode currently uses fixed Bengaluru coordinates. It does
not yet use browser geolocation or manual location input.

## 6. Known bugs / risks to verify

Fix only after inspecting the actual current code and reproducing the
issue.

### A. Live forecast timestamps may crash stay-vs-move comparison

`build_forecast()` in `app.py` produces forecast entries with ISO
timestamps,
e.g. `{"time": "2026-10-10T00:00", "score": 42, "level": "CAUTION"}`.
The existing `stay_move.py` logic was described as converting a time
label to an integer after removing `+` and `" min"`, which only works
for labels like `NOW` and `+30 min`. An ISO timestamp could raise
`ValueError` if this code path is used.

**Task:** Inspect `stay_move.py` and the caller. Update time handling to
safely support the actual forecast schema (prefer deriving elapsed
minutes from forecast timestamps, or explicitly support both formats).
Add a simple test or run the live endpoint to verify.

### B. Retry button may do nothing

The previous `App.jsx` had a Retry button that called `setMode(mode)`.
React state won't trigger a rerender/fetch if the state value does not
change.

**Task:** Verify the current code. If still present, implement a proper
retry mechanism, e.g. a refresh counter included in the effect
dependency or a shared fetch function.

### C. Misleading message when no destination exists

The previous UI could show "No move recommended right now" whenever
there was no destination. That is only accurate when the backend action
is `STAY`; it is misleading when a move is recommended but
destination/route data is unavailable.

**Task:** Branch the message on the actual action and distinguish: -
Stay is recommended. - No suitable destination/route could be
confirmed. - Data could not be loaded.

### D. Implausible walking routes

A previous route lookup returned an implausibly long route compared with
the straight-line distance (example: about 8.29 km route for about 0.29
km straight-line). `route.py` has plausibility validation described as
rejecting routes longer than `max(1 km, 5 × straight-line distance)`,
and `demo.py` tries another destination if a route is rejected. This
caused a fallback to Cubbon Park.

**Task:** Keep route plausibility checks. Do not label a straight-line
fallback as a walking route. If routing is unavailable, say so clearly
and offer a fallback destination or an explicit route-unavailable state.

### E. Heat-score limitations

The heuristic score was described as using: - apparent/thermal score:
60% - humidity: 15% - solar: 15% - wind: 5% - time: 5% with levels SAFE
0--30, CAUTION 31--50, HIGH 51--70, DANGER 71--100.

Open-Meteo apparent temperature already accounts for factors such as
humidity and wind, so this may double-count factors. Treat the score as
a prototype heuristic, not a validated scientific model. Do not spend
time tuning this before the end-to-end demo works.

### F. Forecast timezone/timestamps

Forecast timestamps appeared in a local-looking format such as
`2026-10-10T00:00`. Verify how Open-Meteo timezone settings and Python
datetime handling interact before changing time logic. Avoid assuming
UTC/local behavior without checking the API parameters and actual
responses.

### G. Live low-risk state

A low-risk response can legitimately have no destination and no route.
The frontend must handle this as a normal state and not crash.

## 7. Curated destinations

The demo POI dataset has included places such as: - City Central
Library - Phoenix Mall - Cubbon Park - City Central Library South Zone -
Lulu Mall Bengaluru

Place data uses heuristic attributes such as indoor access, shade, water
availability, and public access. Do not claim these attributes have been
freshly verified unless the project actually verifies them.

## 8. Reliability plan / fallbacks

Build a reliable demo, not a broad but fragile product: - Weather API
fails → cached or deterministic demo scenario. - Routing API fails →
show route unavailable or use a clearly labelled fallback; never pretend
a straight line is a verified walking route. - POI lookup fails →
curated local dataset. - AI explanation is unavailable → deterministic
explanation. - AWS backend/deployment is not ready → local fallback for
development; for judging, be clear about what is actually deployed. -
Location permission denied → manual location entry or a clearly labelled
Bengaluru demo location. - Internet unstable → deterministic demo mode
and a prerecorded backup recording.

## 9. Recommended next steps (in order)

1.  **Inspect actual files first.** Confirm whether the latest `App.jsx`
    was saved. Do not rewrite it before looking.
2.  **Run backend and frontend.** Verify the actual startup commands
    from `requirements.txt`, `package.json`, and project configuration.
3.  **Smoke-test endpoints.** Test `/demo/stay-vs-move`, `/safe-places`
    at the known Bengaluru coordinates, and `/risk` if applicable.
4.  **Fix the timestamp bug** if reproducible; test live mode with both
    low- and elevated-risk inputs.
5.  **Fix Retry** if it is still ineffective.
6.  **Fix empty-state messages** so `STAY`, unavailable destination,
    unavailable route, and API failure are distinct.
7.  **Test map and route rendering.** Confirm route polyline decoding
    precision and that no implausible route is presented as valid.
8.  **Run a complete demo rehearsal** from page load to recommendation
    and route.
9.  **Deploy the smallest reliable version to AWS** to satisfy the
    hackathon requirement; verify the deployed URL and APIs end to end.
10. **Prepare the 3-minute demo recording** and a backup recording /
    deterministic demo path.

Do not add authentication, user profiles, social features, model
training, or multiple-city support until the core journey is reliable.

## 10. Instructions for the new ChatGPT chat

Paste this handoff document into the new chat, then add the prompt
below:

> We are continuing an existing hackathon project called HeatShield.
> Treat the attached handoff as project context, but inspect the actual
> code/files I provide before making changes. Do not restart or redesign
> the project. Work incrementally, preserve working behavior, and give
> me exact file paths and complete corrected code only when needed.
> First help me verify the current state and run smoke tests. Then
> reproduce and fix the known bugs one at a time, starting with live
> forecast timestamp handling in `stay_move.py`. Do not claim a bug
> exists until the current code or a test confirms it. Explain commands
> for Windows PowerShell where relevant. Keep the hackathon deadline in
> mind and prioritize a reliable end-to-end demo and AWS deployment over
> adding features.

## 11. What to provide in the new chat

Best options: - Upload this handoff file. - If possible, upload a ZIP of
the current project **without** the `backend/venv/`, `node_modules/`,
`.git/`, `.env`, API keys, or other secrets. - Alternatively, paste the
current `backend/stay_move.py`, relevant parts of `backend/app.py`, and
the current `frontend/src/App.jsx`. - Never share API keys or secret
environment values.

## 12. Truthfulness checklist for the final demo

-   Label scores and stay/move curves as heuristic estimates.
-   Do not claim medical validation.
-   Do not claim exact street-level temperature or safety.
-   Do not claim a route is a verified walking route if routing failed.
-   Do not claim AWS deployment until the deployed application is
    tested.
-   Explain that recommendations depend on available weather, place, and
    routing data.

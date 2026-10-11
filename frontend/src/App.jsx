import { useEffect, useState, useRef, useMemo } from "react";
import polyline from "@mapbox/polyline";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const DEFAULT_CITIES = [
  {
    id: "blr",
    name: "Bengaluru",
    latitude: 12.9716,
    longitude: 77.5946,
    description: "Plateau urban core · Shaded tech corridors & canopy parks",
    sample_journey: {
      name: "Majestic Station → Cubbon Park",
      start: { name: "Majestic Bus Station", lat: 12.9774, lon: 77.5708 },
      end: { name: "Cubbon Park Central", lat: 12.9763, lon: 77.5929 },
    },
  },
  {
    id: "del",
    name: "New Delhi",
    latitude: 28.6139,
    longitude: 77.2090,
    description: "High continental heat & intense solar radiation test city",
    sample_journey: {
      name: "Connaught Place → India Gate",
      start: { name: "Connaught Place Inner Circle", lat: 28.6328, lon: 77.2197 },
      end: { name: "India Gate Canopy", lat: 28.6129, lon: 77.2295 },
    },
  },
  {
    id: "mum",
    name: "Mumbai",
    latitude: 18.9322,
    longitude: 72.8311,
    description: "Coastal tropical humidity & high apparent heat index test city",
    sample_journey: {
      name: "Churchgate → Asiatic Library & Horniman Circle",
      start: { name: "Churchgate Station", lat: 18.9352, lon: 72.8273 },
      end: { name: "Asiatic Society Library", lat: 18.9317, lon: 72.8361 },
    },
  },
  {
    id: "hyd",
    name: "Hyderabad",
    latitude: 17.3850,
    longitude: 78.4867,
    description: "Deccan heatwave zone with historic public shade havens",
    sample_journey: {
      name: "Afzal Gunj → State Central Library",
      start: { name: "Afzal Gunj Transit Hub", lat: 17.3785, lon: 78.4760 },
      end: { name: "State Central Library", lat: 17.3712, lon: 78.4764 },
    },
  },
  {
    id: "jai",
    name: "Jaipur",
    latitude: 26.9124,
    longitude: 75.7873,
    description: "Semi-arid dry extreme heat & high solar irradiance",
    sample_journey: {
      name: "MI Road → Central Park Shaded Loop",
      start: { name: "MI Road Commercial Corridor", lat: 26.9180, lon: 75.8050 },
      end: { name: "Central Park Jaipur", lat: 26.9038, lon: 75.8080 },
    },
  },
];

// Helper to create clean custom HTML div-markers
function createUserIcon(score) {
  return new L.DivIcon({
    className: "custom-marker",
    html: `<div class="user-marker">YOU<span>${score ? score + "/100" : ""}</span></div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

function createPlaceIcon(icon, temp, isPrimary) {
  const cssClass = isPrimary ? "dest-marker" : "cool-marker";
  return new L.DivIcon({
    className: "custom-marker",
    html: `<div class="${cssClass}">
      <span>${icon || "🌳"}</span>
      <span class="temp-pill">${temp != null ? temp + "°C" : "Cool"}</span>
    </div>`,
    iconSize: [85, 34],
    iconAnchor: [42, 17],
  });
}

function createJourneyIcon(label, color) {
  return new L.DivIcon({
    className: "custom-marker",
    html: `<div style="width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:${color};color:white;font-weight:900;font-size:14px;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function createRespiteIcon(index, icon) {
  return new L.DivIcon({
    className: "custom-marker",
    html: `<div class="cool-marker" style="background:#1b633f;border-color:#a4f2c0;">
      <span>💧 Stop ${index}</span>
      <span>${icon || "🌳"}</span>
    </div>`,
    iconSize: [95, 32],
    iconAnchor: [47, 16],
  });
}

function FitRoute({ routePath, center, markers = [] }) {
  const map = useMap();

  useEffect(() => {
    if (routePath && routePath.length > 1) {
      map.fitBounds(L.latLngBounds(routePath), { padding: [50, 50], maxZoom: 16 });
    } else if (markers && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lon]));
      if (center) bounds.extend(center);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [map, routePath, center, markers]);

  return null;
}

function App() {
  const [mode, setMode] = useState("demo"); // "demo" | "live" | "journey"
  const [selectedCityId, setSelectedCityId] = useState("blr");
  const [userPosition, setUserPosition] = useState([12.9716, 77.5946]);
  const [cityName, setCityName] = useState("Bengaluru");
  const [gpsActive, setGpsActive] = useState(false);

  // Search autocomplete state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimeoutRef = useRef(null);

  // Main escape data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Active destination override (when user clicks an alternative place)
  const [activeDestination, setActiveDestination] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);

  // Journey Mode state
  const [journeyOrigin, setJourneyOrigin] = useState(DEFAULT_CITIES[0].sample_journey.start);
  const [journeyDest, setJourneyDest] = useState(DEFAULT_CITIES[0].sample_journey.end);
  const [journeyData, setJourneyData] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);

  // Load cities from backend or fallback to DEFAULT_CITIES
  const [cities, setCities] = useState(DEFAULT_CITIES);
  useEffect(() => {
    fetch(`${API_URL}/cities`)
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setCities(list);
      })
      .catch(() => {});
  }, []);

  // Handle Location Search
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/geocode?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setSearchResults(json.results || []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const selectSearchResult = (item) => {
    setUserPosition([item.latitude, item.longitude]);
    setCityName(item.name);
    setSelectedCityId("custom");
    setGpsActive(false);
    setSearchOpen(false);
    setSearchQuery("");
    setActiveDestination(null);
    setActiveRoute(null);
    if (mode === "demo") setMode("live");
    setRefreshKey((k) => k + 1);
  };

  // City Pill click handler
  const handleCitySelect = (city) => {
    setSelectedCityId(city.id);
    setUserPosition([city.latitude, city.longitude]);
    setCityName(city.name);
    setGpsActive(false);
    setActiveDestination(null);
    setActiveRoute(null);
    if (city.sample_journey) {
      setJourneyOrigin(city.sample_journey.start);
      setJourneyDest(city.sample_journey.end);
    }
    if (mode === "journey") {
      fetchJourneyRoute(city.sample_journey.start, city.sample_journey.end);
    } else {
      setRefreshKey((k) => k + 1);
    }
  };

  // GPS "Use My Location" handler
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserPosition([lat, lon]);
        setCityName("My Location");
        setSelectedCityId("custom");
        setGpsActive(true);
        setActiveDestination(null);
        setActiveRoute(null);
        if (mode === "demo") setMode("live");
        setRefreshKey((k) => k + 1);
      },
      (err) => {
        setLoading(false);
        alert(`Location access denied or unavailable: ${err.message}`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Fetch Escape Data (Demo / Live)
  useEffect(() => {
    if (mode === "journey") return;

    let cancelled = false;
    async function loadEscapeData() {
      setLoading(true);
      setError(null);
      try {
        const endpoint =
          mode === "demo"
            ? `${API_URL}/demo/stay-vs-move`
            : `${API_URL}/safe-places?lat=${userPosition[0]}&lon=${userPosition[1]}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        if (cancelled) return;

        let normalized;
        if (mode === "demo") {
          normalized = {
            current_risk: result.current_risk,
            forecast_analysis: result.forecast_analysis,
            destination: result.destination,
            comparison: result.comparison,
            route: result.route,
            recommendation: result.recommendation,
            all_places: result.all_places || (result.destination ? [result.destination] : []),
            alternatives: result.alternatives || [],
          };
        } else {
          normalized = {
            current_risk: {
              time: result.heat_exposure?.time ?? "NOW",
              score: result.heat_exposure?.score ?? 0,
              level: result.heat_exposure?.level ?? "SAFE",
              temperature: result.heat_exposure?.temperature ?? 30.0,
              apparent_temperature: result.heat_exposure?.apparent_temperature ?? 32.0,
              humidity: result.heat_exposure?.humidity ?? 60,
            },
            forecast_analysis: result.forecast_analysis ?? {
              peak_score: result.heat_exposure?.score ?? 0,
              peak_time: "the forecast period",
              increase: 0,
              trend: "STABLE",
            },
            destination: result.recommended_place ?? null,
            comparison: result.stay_vs_move ?? null,
            route: result.route ?? null,
            recommendation: {
              action: result.action?.type ?? "STAY",
              reason: result.action?.message ?? "Heat conditions are acceptable.",
            },
            all_places: result.all_places ?? [],
            alternatives: result.alternatives ?? [],
          };
        }
        setData(normalized);
        setActiveDestination(normalized.destination);
        setActiveRoute(normalized.route);
      } catch (err) {
        if (!cancelled) {
          if (mode === "demo") {
            const fallbackDemo = {
              current_risk: { time: "NOW", score: 42, level: "CAUTION", temperature: 35.0, apparent_temperature: 39.2, humidity: 68 },
              forecast_analysis: { current_score: 42, peak_score: 78, peak_time: "+90 min", increase: 36, trend: "ESCALATING" },
              destination: {
                name: "Cubbon Park",
                latitude: 12.9763,
                longitude: 77.5929,
                type: "park",
                temperature: 28.5,
                feels_like: 31.0,
                cooling_type: "Dense Shaded Tree Canopy",
                icon: "🌳",
                relief_score: 42.0,
                distance_km: 0.78,
                walking_minutes: 10,
                factors: { cooling_score: 7, shade_score: 10, indoor: false, water_available: true },
              },
              comparison: {
                stay: [
                  { time: "NOW", score: 42 },
                  { time: "+30 min", score: 56 },
                  { time: "+60 min", score: 69 },
                  { time: "+90 min", score: 78 },
                ],
                move: [
                  { time: "NOW", score: 42 },
                  { time: "+30 min", score: 42 },
                  { time: "+60 min", score: 40 },
                  { time: "+90 min", score: 45 },
                ],
              },
              route: {
                distance_km: 0.78,
                walking_minutes: 10,
                shape: "_dvvWo}~~rCwdHfiB",
              },
              recommendation: {
                action: "MOVE_NOW",
                reason: "Heat exposure is expected to become dangerous if you remain here. Seek a cooler location.",
              },
              all_places: [
                { id: "blr_park_01", name: "Cubbon Park", latitude: 12.9763, longitude: 77.5929, type: "park", temperature: 28.5, icon: "🌳", cooling_type: "Dense Shaded Tree Canopy", distance_km: 0.78, relief_score: 42.0, water_available: true, indoor: false },
                { id: "blr_library_01", name: "City Central Library, Cubbon Park", latitude: 12.9735, longitude: 77.5905, type: "library", temperature: 24.0, icon: "🏛️", cooling_type: "Air-Conditioned Indoor Haven", distance_km: 0.65, relief_score: 48.0, water_available: true, indoor: true },
                { id: "blr_mall_01", name: "UB City Shaded Galleria & Plaza", latitude: 12.9719, longitude: 77.5958, type: "mall", temperature: 23.5, icon: "🏢", cooling_type: "Air-Conditioned Indoor Haven", distance_km: 0.85, relief_score: 50.0, water_available: true, indoor: true },
              ],
            };
            setData(fallbackDemo);
            setActiveDestination(fallbackDemo.destination);
            setActiveRoute(fallbackDemo.route);
            setLoading(false);
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to load data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEscapeData();
    return () => {
      cancelled = true;
    };
  }, [mode, userPosition, refreshKey]);

  // Fetch Journey Data (A to B)
  const fetchJourneyRoute = async (origin, dest) => {
    if (!origin || !dest) return;
    setJourneyLoading(true);
    try {
      const url = `${API_URL}/journey-safe-route?start_lat=${origin.lat}&start_lon=${origin.lon}&end_lat=${dest.lat}&end_lon=${dest.lon}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not calculate heat-safe journey route.");
      const json = await res.json();
      setJourneyData(json);
    } catch (e) {
      alert(e.message);
    } finally {
      setJourneyLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "journey" && journeyOrigin && journeyDest) {
      fetchJourneyRoute(journeyOrigin, journeyDest);
    }
  }, [mode, journeyOrigin, journeyDest]);

  // Select a specific cooling destination to route to
  const handleSelectAlternative = async (place) => {
    setActiveDestination(place);
    try {
      const res = await fetch(
        `${API_URL}/journey-safe-route?start_lat=${userPosition[0]}&start_lon=${userPosition[1]}&end_lat=${place.latitude}&end_lon=${place.longitude}`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.route) {
          setActiveRoute(json.route);
        }
      }
    } catch {}
    document.getElementById("escape-map-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Timestamp formatting
  const formatForecastTime = (value) => {
    if (typeof value !== "string") return value ?? "";
    const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})$/);
    if (!match) return value;
    const hour = Number(match[1]);
    const minute = match[2];
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${period}`;
  };

  const formatAction = (value) => String(value).replaceAll("_", " ");

  // Decode Polyline Path for Leaflet
  const currentRouteToRender = activeRoute || data?.route;
  const routePath = useMemo(() => {
    if (mode === "journey" && journeyData?.route?.shape) {
      try {
        return polyline.decode(journeyData.route.shape, 6);
      } catch {
        return [];
      }
    }
    if (currentRouteToRender?.shape) {
      try {
        return polyline.decode(currentRouteToRender.shape, 6);
      } catch {
        return [];
      }
    }
    return [];
  }, [mode, journeyData, currentRouteToRender]);

  const markersForFit = useMemo(() => {
    if (mode === "journey") {
      const list = [];
      if (journeyOrigin) list.push({ lat: journeyOrigin.lat, lon: journeyOrigin.lon });
      if (journeyDest) list.push({ lat: journeyDest.lat, lon: journeyDest.lon });
      if (journeyData?.respite_stops) {
        journeyData.respite_stops.forEach((s) => list.push({ lat: s.latitude, lon: s.longitude }));
      }
      return list;
    }
    if (data?.all_places) {
      return data.all_places.map((p) => ({ lat: p.latitude, lon: p.longitude }));
    }
    return [];
  }, [mode, journeyOrigin, journeyDest, journeyData, data]);

  if (loading && mode !== "journey") {
    return (
      <div className="loading-screen">
        <div className="loading-logo">H</div>
        <h2>HeatShield</h2>
        <p>Analyzing local microclimate and heat risk...</p>
      </div>
    );
  }

  if (error && !data && mode !== "journey") {
    return (
      <div className="loading-screen">
        <div className="error-icon">!</div>
        <h2>Unable to connect</h2>
        <p>{error}</p>
        <p className="error-help">Ensure FastAPI backend is running on http://127.0.0.1:8000</p>
        <button className="move-button" onClick={() => setRefreshKey((k) => k + 1)}>
          Retry Connection →
        </button>
      </div>
    );
  }

  const current = data?.current_risk ?? { score: 25, level: "SAFE", temperature: 28, humidity: 55 };
  const forecast = data?.forecast_analysis ?? {};
  const destination = activeDestination || data?.destination;
  const comparison = data?.comparison;
  const recommendation = data?.recommendation ?? {};
  const allPlaces = data?.all_places ?? [];

  const trend = forecast.trend ?? "STABLE";
  const action = recommendation.action ?? "STAY";
  const reason = recommendation.reason ?? "Heat exposure is acceptable.";
  const peakTime = forecast.peak_time ?? "the forecast period";

  const badgeClass =
    current.score >= 70
      ? "badge-danger"
      : current.score >= 50
      ? "badge-high"
      : current.score >= 30
      ? "badge-caution"
      : "badge-safe";

  return (
    <div className="app">
      {/* TOPBAR */}
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">H</span>
          <span>HeatShield</span>
        </div>

        {/* Global Location Search */}
        <div className="header-center">
          <div className="search-box-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search any locality, landmark or city..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery.length >= 2 && setSearchOpen(true)}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="search-dropdown">
                {searchResults.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="search-item"
                    onClick={() => selectSearchResult(item)}
                  >
                    <span className="search-item-title">{item.name}</span>
                    <span className="search-item-sub">
                      {item.admin1 ? `${item.admin1}, ` : ""}
                      {item.country}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions: GPS & Mode switch */}
        <div className="header-actions">
          <button
            type="button"
            className={`gps-button ${gpsActive ? "active" : ""}`}
            onClick={handleUseMyLocation}
            title="Detect GPS location"
          >
            <span>📍</span>
            <span>{gpsActive ? "GPS Active" : "Use My Location"}</span>
          </button>

          <div className="mode-switch">
            <button
              className={mode === "demo" ? "active" : ""}
              onClick={() => {
                setMode("demo");
                setSelectedCityId("blr");
                setUserPosition([12.9716, 77.5946]);
                setCityName("Bengaluru");
              }}
            >
              Demo
            </button>
            <button
              className={mode === "live" ? "active" : ""}
              onClick={() => setMode("live")}
            >
              Live
            </button>
            <button
              className={mode === "journey" ? "active" : ""}
              onClick={() => setMode("journey")}
            >
              Journey (A→B)
            </button>
          </div>
        </div>
      </header>

      {/* QUICK CITY SELECTOR SUB-BAR */}
      <div className="sub-bar">
        <span className="city-pill-label">Test Cities:</span>
        {cities.map((city) => (
          <button
            key={city.id}
            type="button"
            className={`city-pill ${selectedCityId === city.id ? "active" : ""}`}
            onClick={() => handleCitySelect(city)}
          >
            {city.name}
          </button>
        ))}
        {selectedCityId === "custom" && (
          <span className="city-pill active">📍 {cityName}</span>
        )}
      </div>

      <main className="dashboard">
        {/* ================= MODE: JOURNEY PLANNER (A -> B) ================= */}
        {mode === "journey" ? (
          <>
            <section className="journey-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">HEAT-SAFE NAVIGATION</p>
                  <h2>Journey Planner (Point A → Point B)</h2>
                  <p style={{ margin: "6px 0 0", color: "#65756a", fontSize: "14px" }}>
                    Standard navigation finds the fastest route under direct sunlight.
                    HeatShield maps pedestrian paths with cooling respite shelters along the way to prevent heatstroke.
                  </p>
                </div>
                <span className="trend-badge">ACTIVE JOURNEY</span>
              </div>

              {/* Sample Journey Presets */}
              <div className="journey-inputs-row">
                <div className="journey-input-group">
                  <label>Origin (Start A)</label>
                  <input
                    type="text"
                    value={journeyOrigin.name}
                    onChange={(e) => setJourneyOrigin({ ...journeyOrigin, name: e.target.value })}
                  />
                </div>
                <div className="journey-input-group">
                  <label>Destination (Target B)</label>
                  <input
                    type="text"
                    value={journeyDest.name}
                    onChange={(e) => setJourneyDest({ ...journeyDest, name: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  className="journey-calc-btn"
                  onClick={() => fetchJourneyRoute(journeyOrigin, journeyDest)}
                  disabled={journeyLoading}
                >
                  {journeyLoading ? "Routing..." : "Recalculate Route →"}
                </button>
              </div>

              {/* Journey Metrics Banner */}
              {journeyData && (
                <>
                  <div className="journey-metrics-banner">
                    <div className="journey-stat-card">
                      <span>Total Distance</span>
                      <strong>{journeyData.journey_summary.total_distance_km} km</strong>
                    </div>
                    <div className="journey-stat-card">
                      <span>Walking Duration</span>
                      <strong>{journeyData.journey_summary.total_walking_minutes} min</strong>
                    </div>
                    <div className="journey-stat-card">
                      <span>Direct Sun Heat Risk</span>
                      <strong style={{ color: "#c64d38" }}>
                        {journeyData.journey_summary.direct_heat_risk}/100
                      </strong>
                    </div>
                    <div className="journey-stat-card">
                      <span>HeatShield Mitigated</span>
                      <strong style={{ color: "#1b633f" }}>
                        {journeyData.journey_summary.heatshield_mitigated_risk}/100
                      </strong>
                      <span className="saved-badge">
                        ↓ {journeyData.journey_summary.risk_reduction_percent}% Heatstroke Risk
                      </span>
                    </div>
                  </div>

                  {/* Respite Stops Along Corridor */}
                  <div className="respite-stops-list">
                    <p className="eyebrow">COOLING STOPS ALONG YOUR ROUTE</p>
                    {journeyData.respite_stops && journeyData.respite_stops.length > 0 ? (
                      journeyData.respite_stops.map((stop, idx) => (
                        <div className="respite-stop-item" key={stop.id || idx}>
                          <div className="respite-stop-info">
                            <span className="respite-stop-badge">{stop.icon || "💧"}</span>
                            <div className="respite-stop-details">
                              <strong>
                                Stop {idx + 1}: {stop.name} ({stop.temperature}°C)
                              </strong>
                              <span>{stop.cooling_type} · {stop.benefit}</span>
                            </div>
                          </div>
                          <span className="respite-stop-action">
                            Rest: {stop.recommended_rest_minutes} mins
                          </span>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#777", fontSize: "13px" }}>
                        No public cooling stops found directly on this corridor. Carry hydration.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          /* ================= MODE: HEAT ESCAPE (DEMO & LIVE) ================= */
          <>
            {/* CURRENT HEAT RISK HERO */}
            <section className="hero">
              <div>
                <p className="eyebrow">CURRENT HEAT EXPOSURE · {cityName.toUpperCase()}</p>
                <div className="risk-row">
                  <span className="risk-score">{current.score}</span>
                  <span className="risk-max">/100</span>
                </div>
                <span className={`risk-badge ${badgeClass}`}>{current.level}</span>
                <p className="hero-message">
                  {current.score >= 70
                    ? "Extreme thermal risk. Unshaded outdoor physical exertion poses immediate heatstroke danger."
                    : current.score >= 50
                    ? "Elevated heat stress. Solar irradiance and humidity amplify physiological heat accumulation."
                    : "Heat exposure is currently within tolerable parameters. Monitor changing conditions."}
                </p>

                <div className="weather-stats-row">
                  <div className="weather-stat-chip">
                    <span>Air Temp</span>
                    <strong>{current.temperature ?? "31.2"}°C</strong>
                  </div>
                  <div className="weather-stat-chip">
                    <span>Perceived (Heat Index)</span>
                    <strong>{current.apparent_temperature ?? "34.5"}°C</strong>
                  </div>
                  <div className="weather-stat-chip">
                    <span>Humidity</span>
                    <strong>{current.humidity ?? "65"}%</strong>
                  </div>
                </div>
              </div>

              {/* Forecast Alert */}
              <div className="forecast-alert">
                <div className="alert-icon">
                  {trend === "ESCALATING" ? "↑" : trend === "DECLINING" ? "↓" : "•"}
                </div>
                <div>
                  <p className="alert-title">
                    Forecast Peak: <strong>{forecast.peak_score ?? current.score}/100</strong>
                  </p>
                  <p className="alert-subtitle">
                    {typeof peakTime === "string" && peakTime.startsWith("+")
                      ? `Expected in approximately ${peakTime.slice(1)}`
                      : formatForecastTime(peakTime)}
                  </p>
                  <p className="alert-trend">
                    {forecast.increase > 0 ? `+${forecast.increase} ` : ""}
                    Trend: {trend}
                  </p>
                </div>
              </div>
            </section>

            {/* STAY VS MOVE TRAJECTORY */}
            <section className="trend-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">HEAT TRAJECTORY</p>
                  <h2>Stay vs Move Predictive Timeline</h2>
                </div>
                <span className="trend-badge">{trend}</span>
              </div>

              {/* Descriptive guidance directly answering user's feedback */}
              <div className="chart-guide-box">
                <p>
                  <strong>How to read this chart:</strong> Compares your projected heat-risk score if you remain
                  at your current exposed location (<span style={{ color: "#e95d43", fontWeight: 700 }}>Stay here</span>) versus
                  the reduced heat risk once you reach a verified cooling sanctuary (
                  <span style={{ color: "#2b7a54", fontWeight: 700 }}>Move to sanctuary</span>). Lower scores indicate safer conditions.
                </p>
                <div className="chart-guide-scales">
                  <div className="scale-tag">
                    <span className="scale-bullet" style={{ background: "#1e6b37" }} /> 0–30 Safe
                  </div>
                  <div className="scale-tag">
                    <span className="scale-bullet" style={{ background: "#d99b00" }} /> 31–50 Caution
                  </div>
                  <div className="scale-tag">
                    <span className="scale-bullet" style={{ background: "#c64d38" }} /> 51–70 High Risk
                  </div>
                  <div className="scale-tag">
                    <span className="scale-bullet" style={{ background: "#b91c1c" }} /> 71–100 Extreme Danger
                  </div>
                </div>
              </div>

              {comparison && Array.isArray(comparison.stay) && Array.isArray(comparison.move) ? (
                <>
                  <div className="chart">
                    <div className="chart-line stay-line">
                      {comparison.stay.map((point, index) => (
                        <span
                          className={`point ${Number(point.score) >= 70 ? "danger-point" : ""}`}
                          key={`stay-${index}`}
                          title={`Stay Exposure: ${point.score}/100`}
                        >
                          {point.score}
                        </span>
                      ))}
                    </div>

                    <div className="chart-line move-line">
                      {comparison.move.map((point, index) => (
                        <span
                          className="point"
                          key={`move-${index}`}
                          title={`Protected Score: ${point.score}/100`}
                        >
                          {point.score}
                        </span>
                      ))}
                    </div>

                    <div className="chart-times">
                      {comparison.stay.map((point, index) => (
                        <span key={`time-${index}`}>{formatForecastTime(point.time)}</span>
                      ))}
                    </div>
                  </div>

                  <div className="legend">
                    <span>
                      <i className="legend-dot stay" />
                      Stay here (unprotected exposure)
                    </span>
                    <span>
                      <i className="legend-dot move" />
                      Move to cooling sanctuary
                    </span>
                  </div>
                </>
              ) : (
                <p style={{ color: "#777", fontSize: "14px", marginTop: "16px" }}>
                  Current ambient heat is mild. Continue monitoring the forecast.
                </p>
              )}
            </section>

            {/* RECOMMENDED DESTINATION */}
            <section className="recommendation-card">
              <div className="recommendation-header">
                <div>
                  <p className="eyebrow">RECOMMENDED ESCAPE SANCTUARY</p>
                  <h2>{destination ? destination.name : "Local Cooling Sanctuary"}</h2>
                </div>
                <button
                  type="button"
                  className="destination-icon-btn"
                  onClick={() => {
                    document.getElementById("escape-map-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  title="Center map on sanctuary"
                >
                  {destination?.icon || "⌂"}
                </button>
              </div>

              {destination ? (
                <>
                  <div className="destination-details">
                    <div>
                      <strong>
                        {destination.distance_km != null
                          ? `${destination.distance_km} km`
                          : "Nearby"}
                      </strong>
                      <span>Walking Distance</span>
                    </div>
                    <div>
                      <strong>
                        {destination.walking_minutes != null
                          ? `${destination.walking_minutes} min`
                          : "10-15 min"}
                      </strong>
                      <span>Walking Time</span>
                    </div>
                    <div>
                      <strong>
                        {destination.temperature != null
                          ? `${destination.temperature}°C`
                          : "Cool"}
                      </strong>
                      <span>Sanctuary Microclimate</span>
                    </div>
                    <div>
                      <strong>
                        {destination.relief_score != null
                          ? `${destination.relief_score}/50`
                          : "High"}
                      </strong>
                      <span>Estimated Relief Score</span>
                    </div>
                  </div>

                  <p className="recommendation-text">{reason}</p>

                  {/* Fact-based "Why This Place?" */}
                  <div className="why-destination">
                    <p className="eyebrow">WHY THIS DESTINATION COOLS YOU DOWN</p>
                    <div className="reason-item">
                      <span className="reason-icon">{destination.icon || "❄️"}</span>
                      <div>
                        <strong>{destination.cooling_type || "Verified Cooling Zone"}</strong>
                        <p>
                          {destination.indoor
                            ? "Indoor air-conditioned environment shielded completely from direct sunlight and ambient thermal radiation."
                            : "Mature tree canopy coverage creates an urban cool island, reducing radiant surface heat by ~3–5°C."}
                        </p>
                      </div>
                    </div>
                    <div className="reason-item">
                      <span className="reason-icon">💧</span>
                      <div>
                        <strong>Free Public Hydration & Rest</strong>
                        <p>
                          {destination.water_available
                            ? "Clean drinking water refill points and public seating available on site."
                            : "Public shaded benches and green rest areas accessible without commercial admission."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "24px" }}>
                    <button
                      type="button"
                      className="move-button"
                      onClick={() => {
                        document.getElementById("escape-map-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      {formatAction(action)} → View Escape Route
                    </button>
                  </div>
                </>
              ) : (
                <p className="recommendation-text">
                  Current conditions do not require immediate relocation. You can safely remain in your current area.
                </p>
              )}
            </section>
          </>
        )}

        {/* ================= INTERACTIVE MAP ================= */}
        <section className="map-card" id="escape-map-section">
          <div className="map-header">
            <div>
              <p className="eyebrow">HEAT ESCAPE NETWORK</p>
              <h2>
                {mode === "journey"
                  ? "Pedestrian Corridor with Cooling Respites"
                  : "Nearby Cooling Sanctuaries & Routes"}
              </h2>
            </div>
            <span style={{ fontSize: "12px", color: "#6a776e", fontWeight: 700 }}>
              {mode === "journey"
                ? `${journeyData?.journey_summary?.total_distance_km || 0} km walk`
                : `${allPlaces.length} cooling spots mapped`}
            </span>
          </div>

          <div className="real-map">
            <MapContainer
              center={userPosition}
              zoom={13}
              scrollWheelZoom
              className="leaflet-map"
            >
              <FitRoute
                routePath={routePath}
                center={userPosition}
                markers={markersForFit}
              />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Mode: Escape Network Markers */}
              {mode !== "journey" && (
                <>
                  {/* YOU Marker */}
                  <Marker position={userPosition} icon={createUserIcon(current.score)}>
                    <Popup>
                      <div className="popup-container">
                        <strong className="popup-title">Your Current Position</strong>
                        <p className="popup-type">Location: {cityName}</p>
                        <div className="popup-stat-row">
                          <span>Exposure: <strong>{current.score}/100</strong></span>
                          <span>Temp: <strong>{current.temperature}°C</strong></span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>

                  {/* All Nearby Cool Places Markers with Temperatures */}
                  {allPlaces.map((place) => {
                    const isSelected = destination && destination.name === place.name;
                    return (
                      <Marker
                        key={place.id || place.name}
                        position={[place.latitude, place.longitude]}
                        icon={createPlaceIcon(place.icon, place.temperature, isSelected)}
                      >
                        <Popup>
                          <div className="popup-container">
                            <strong className="popup-title">{place.name}</strong>
                            <p className="popup-type">{place.cooling_type}</p>
                            <div className="popup-stat-row">
                              <span className="popup-temp-badge">
                                Microclimate: {place.temperature}°C
                              </span>
                              <span>Distance: {place.distance_km} km</span>
                            </div>
                            <button
                              type="button"
                              className="popup-route-btn"
                              onClick={() => handleSelectAlternative(place)}
                            >
                              Route to this Haven →
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              )}

              {/* Mode: Journey (A -> B) Markers */}
              {mode === "journey" && journeyData && (
                <>
                  {journeyOrigin && (
                    <Marker
                      position={[journeyOrigin.lat, journeyOrigin.lon]}
                      icon={createJourneyIcon("A", "#1e40af")}
                    >
                      <Popup>
                        <strong>Start: {journeyOrigin.name}</strong>
                      </Popup>
                    </Marker>
                  )}
                  {journeyDest && (
                    <Marker
                      position={[journeyDest.lat, journeyDest.lon]}
                      icon={createJourneyIcon("B", "#6b21a8")}
                    >
                      <Popup>
                        <strong>Destination: {journeyDest.name}</strong>
                      </Popup>
                    </Marker>
                  )}
                  {journeyData.respite_stops?.map((stop, idx) => (
                    <Marker
                      key={stop.id || idx}
                      position={[stop.latitude, stop.longitude]}
                      icon={createRespiteIcon(idx + 1, stop.icon)}
                    >
                      <Popup>
                        <div className="popup-container">
                          <strong className="popup-title">
                            Stop {idx + 1}: {stop.name}
                          </strong>
                          <p className="popup-type">{stop.cooling_type}</p>
                          <div className="popup-stat-row">
                            <span className="popup-temp-badge">Temp: {stop.temperature}°C</span>
                            <span>Rest: {stop.recommended_rest_minutes} mins</span>
                          </div>
                          <p style={{ margin: "4px 0", fontSize: "11px", color: "#555" }}>
                            {stop.benefit}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </>
              )}

              {/* Walking Route Polyline */}
              {routePath.length > 1 && (
                <Polyline
                  positions={routePath}
                  pathOptions={{
                    color: mode === "journey" ? "#1e40af" : "#2b7a54",
                    weight: 6,
                    opacity: 0.9,
                    dashArray: mode === "journey" ? "8, 6" : undefined,
                  }}
                />
              )}
            </MapContainer>

            {/* Overlay banner on the map */}
            <div className="map-overlay">
              <div className="map-overlay-title">
                {mode === "journey" ? "Heat-Safe Walking Corridor" : "Active Destination"}
              </div>
              <div className="map-overlay-place">
                {mode === "journey"
                  ? `${journeyOrigin?.name} → ${journeyDest?.name}`
                  : destination?.name || "Current Location"}
              </div>
              <div className="map-overlay-meta">
                {mode === "journey"
                  ? `${journeyData?.journey_summary?.total_distance_km || 0} km · ${journeyData?.respite_stops?.length || 0} respite stops`
                  : destination
                  ? `${destination.distance_km || "1.2"} km · ${destination.walking_minutes || "14"} min walk`
                  : "Showing local cooling shelters"}
              </div>
            </div>
          </div>
        </section>

        {/* ================= ALL NEARBY COOL PLACES GRID ================= */}
        {mode !== "journey" && allPlaces.length > 0 && (
          <section className="trend-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">NETWORK OF HAVENS</p>
                <h2>All Verified Cooling Spots in {cityName}</h2>
                <p style={{ margin: "4px 0 0", color: "#68766c", fontSize: "13.5px" }}>
                  Click any sanctuary to inspect its microclimate cooling and view the walking route.
                </p>
              </div>
            </div>

            <div className="alternatives-list">
              {allPlaces.map((place) => {
                const isSelected = destination && destination.name === place.name;
                return (
                  <div
                    key={place.id || place.name}
                    className="alternative-card"
                    style={{
                      borderColor: isSelected ? "#2b7a54" : "#e1e8e2",
                      background: isSelected ? "#f3f8f4" : "#fbfcfb",
                    }}
                  >
                    <div>
                      <div className="alt-card-header">
                        <h4 className="alt-card-name">
                          {place.icon} {place.name}
                        </h4>
                        <span className="alt-card-temp">{place.temperature}°C</span>
                      </div>
                      <div className="alt-card-meta">
                        <span>📍 {place.distance_km} km</span>
                        <span>{place.indoor ? "❄️ Indoor AC" : "🌳 Shaded Canopy"}</span>
                        <span>💧 {place.water_available ? "Hydration" : "Seating"}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="alt-route-btn"
                      onClick={() => handleSelectAlternative(place)}
                    >
                      {isSelected ? "✓ Active Route" : "Route to this Spot →"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="error-help" style={{ textAlign: "center", marginTop: "20px" }}>
          HeatShield provides decision support for urban heat resilience. Microclimatic values are
          empirically estimated from canopy and architectural factors. Always seek emergency medical
          assistance if experiencing symptoms of heatstroke.
        </p>
      </main>
    </div>
  );
}

export default App;

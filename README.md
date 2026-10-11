# 🛡️ HeatShield — Personal Heat Escape & Safe Navigation Network

> **Track 02:** Heat and Water — Environmental Hacks (WeMakeDevs & AWS Bharat Builds Tour)  
> *"A heatwave warning tells you your city is hot. HeatShield tells you how to survive the next 2 hours."*

---

## 🌍 The Problem
Urban heatwaves are silent killers, causing thousands of heat exhaustion cases and heatstrokes across Indian cities every summer. Traditional weather dashboards provide a city-wide temperature number (e.g. *"38°C in Delhi"*), but:
1. They don't inform pedestrians of **local microclimate extremes** under direct solar irradiance.
2. They don't forecast a person's **cumulative heat exposure trajectory**.
3. Navigation apps (like Google Maps) calculate routes solely based on shortest distance—often forcing pedestrians through unshaded asphalt corridors with zero hydration access.

---

## 💡 The Solution: HeatShield
**HeatShield** transforms passive heat warnings into an **active heat-safety navigation network**:

1. **Microclimate Heat Risk Engine**: Evaluates physiological heat stress combining ambient temperature, relative humidity, shortwave solar radiation, wind speed, and peak solar hour.
2. **Stay vs. Move Trajectory**: A predictive 2-hour timeline comparing projected heat risk if staying exposed vs. moving to a cooling sanctuary.
3. **Interactive Haven Network**: Plots verified cooling spots (mature canopy parks, air-conditioned public libraries, transit concourses) with live microclimate temperatures and shade factors.
4. **Heatstroke Prevention Journey Planner (A → B)**: Calculates pedestrian routes with **cooling respite stops** along the corridor, lowering cumulative heatstroke risk by **up to 38%**.
5. **Multi-City & GPS Ready**: Instant one-click profiles for **New Delhi, Mumbai, Bengaluru, Hyderabad, Jaipur**, plus worldwide search and GPS detection.

---

## 🏗️ Architecture & Tech Stack

```
[ Pedestrian / Browser ]
         │
         ├─── React 19 + Leaflet + Vite (Frontend)
         │
         ▼
[ FastAPI Backend / Python 3.11 ]
   ├── Weather & Microclimates: Open-Meteo Auto-Timezone Forecast API
   ├── Routing Engine: Valhalla Pedestrian Engine & OSRM Fallback
   ├── Heat Index Model: Thermal Radiation & Microclimate Canopy Scoring
   └── Cooling Database: Urban Green Spaces & Civic AC Facilities
```

* **Frontend:** React 19, Leaflet, React-Leaflet, Mapbox Polyline, Vite
* **Backend:** FastAPI, HTTPX, Uvicorn, Python 3.11
* **AWS Integration:** AWS App Runner / AWS Amplify Hosting / AWS Free Tier / Docker

---

## 🚀 Running Locally

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
Backend runs at: `http://127.0.0.1:8000` (Swagger docs: `http://127.0.0.1:8000/docs`)

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## ☁️ Deployment on AWS

### Backend: AWS App Runner / Elastic Beanstalk / EC2
Build and deploy via Dockerfile:
```bash
docker build -t heatshield-backend ./backend
docker run -p 8000:8000 heatshield-backend
```
In **AWS App Runner**, select your GitHub repository -> pointing to `/backend` or use the Dockerfile.

### Frontend: AWS Amplify / S3 + CloudFront
1. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. Connect the repository to **AWS Amplify Hosting** with build directory `frontend/dist`.

---

## 👥 Submission Details
* **Event:** WeMakeDevs Environmental Hacks (AWS Bharat Builds Tour)
* **Track:** Track 02 — Heat and Water
* **Project:** HeatShield

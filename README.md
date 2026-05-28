# 🏁 ApexGrid

> A premium telemetry-inspired Formula 1 web experience built for fans who love data, speed, and visual storytelling.

ApexGrid is a high-performance Formula 1 analytics and exploration platform that transforms raw motorsport telemetry and historical race data into an immersive, visually rich single-page application.

ApexGrid quickly evolved into a large-scale frontend engineering experiment focused on real-world API handling, interactive data visualisation, responsive UI systems, and performance-conscious client-side architecture.

---

## ✨ Features

### 🏎️ Live Grand Prix Countdown System

* Dynamic UTC-aware race countdown timers
* Automatic live race detection
* Intelligent race-state switching

---

### 📊 Interactive Championship Standings

* Custom asymmetrical leaderboard layouts
* Featured P1 hero cards
* Constructor and driver championship tables
* Telemetry-inspired dominance indicators

---

### 📈 SVG Telemetry Charts

Custom-built inline SVG visualization system without heavyweight charting libraries.

Features include:

* Race finish progression tracking
* Qualifying vs race comparisons
* Multi-driver constructor overlays
* Dynamic coordinate scaling
* Smart tooltip positioning

---

### 🗓️ Dynamic Race Calendar

* Full Formula 1 season schedule
* Lazy-loaded race details
* Podium snapshots
* Session timelines
* Race classification modals

---

### 👤 Driver & Team Profiles

Detailed pages including:

* Career timelines
* Constructor history
* Wins, podiums, poles, starts
* Championship standings by season
* Team performance analytics

---

### 🎨 Premium Motorsport UI

Inspired by Formula 1 broadcast aesthetics:

* Dark telemetry-focused interface
* Neon-accented visual hierarchy
* Motion-driven interactions
* Animated skeleton loaders
* Responsive layouts optimized for desktop and mobile

---

# 🧠 Engineering Highlights

## ⚡ Viewport-Based Lazy Loading

Race cards fetch deep telemetry data only when they enter the viewport, using Framer Motion viewport observers.

This significantly reduces unnecessary API calls and improves perceived loading performance.

---

## 🗄️ LocalStorage Smart Caching

ApexGrid implements custom client-side caching policies to reduce pressure on public APIs.

---

## 🔁 Automatic Retry & Backoff Handling

### OpenF1 API

* Automatic retry every 10 seconds on temporary failures
* Mount safety checks to prevent state updates on unmounted components

### Jolpica Ergast API

* Retry throttling for `429 Too Many Requests`
* Delayed retry system to reduce rate-limit pressure

---

## 📡 Third-Party API Disclaimer

ApexGrid relies on two public third-party Formula 1 APIs that are **not owned or controlled by this project**.

Because these APIs aggregate massive telemetry datasets and are community/publicly maintained:

* occasional slow responses,
* downtime,
* inconsistent schemas,
* or rate limiting

may occur.

To improve stability, ApexGrid implements:

* local caching,
* retry systems,
* skeleton loading states,
* and deferred data fetching.

Still, some pages — especially deep historical profiles — may load slower during high API traffic.

---

# 🧱 Tech Stack

## Frontend

* React 18
* React Router DOM
* Vite

## Styling

* Vanilla CSS
* CSS Modules

## Motion & Interaction

* Framer Motion

## Data Handling

* Fetch API
* Custom hooks
* LocalStorage caching

## Visualization

* Raw SVG telemetry rendering

## Tooling

* ESLint
* Prettier
* npm

---

# 📡 APIs Used

## OpenF1 API

Used for:

* live telemetry data
* meetings
* session timelines
* standings
* driver/team positioning

Base URL:

```bash
https://api.openf1.org/v1
```

---

## Jolpica Ergast API

Used for:

* historical race archives
* qualifying sheets
* standings history
* constructor timelines
* driver statistics

Base URL:

```bash
https://api.jolpi.ca/ergast/f1
```

---

# 📂 Project Structure

```bash
ApexGrid/
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── pages/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
└── vite.config.js
```

---

# 📦 Installation

## Clone Repository

```bash
git clone https://github.com/<your-username>/ApexGrid.git
cd ApexGrid
```

---

## Install Dependencies

```bash
npm install
```

---

## Run Development Server

```bash
npm run dev
```

---

## Build Production Assets

```bash
npm run build
```

---

## Preview Production Build

```bash
npm run preview
```

---

# 🖥️ Deployment

ApexGrid is currently deployed on Vercel: https://apex-grid-seven.vercel.app/

Since the app uses SPA routing, redirect/rewrite rules may be required for page refreshes on nested routes.

---

# 📱 Responsiveness

The application is optimized for:

* desktop
* tablets
* modern smartphones

Special attention was given to:

* responsive typography
* layout wrapping
* overflow handling
* mobile alignment systems
* viewport-safe SVG rendering

---

# ⚠️ Known Limitations

## Slow Deep Historical Queries

Some driver/team profiles require multiple sequential standings requests across seasons.

Initial loading may occasionally feel slow depending on API response times.

---

## Public API Reliability

Because the project depends on public/community-maintained APIs:

* some endpoints may temporarily fail,
* future season endpoints may return 404s,
* or schema inconsistencies may appear.

---

## Technical Debt

Some page files became significantly larger during rapid feature expansion and experimentation.

Potential future improvements:

* component extraction
* better utility normalization
* centralized telemetry helpers
* stronger TypeScript migration

---

# 🚀 Future Improvements

Planned ideas include:

* predictive race analytics
* fantasy/team systems

---

# 💭 Final Notes

ApexGrid was built as both:

* a motorsport passion project,
* and a frontend engineering playground.

A major focus of the project was learning how to handle:

* imperfect APIs,
* performance bottlenecks,
* data-heavy UI systems,
* and scalable component-driven architecture.

The project intentionally balances experimentation, visual design, and practical engineering tradeoffs — making it both a technical showcase and a creative build.

---

## 📄 License

MIT License

Feel free to fork, learn from, and build upon the project.

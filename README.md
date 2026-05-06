# Encore FM: Full-Stack AI-Powered Live Music Archive

Encore FM is a full-stack AI-powered live music archive that helps users explore artists, submit concert setlists, and generate AI-based “Vibe Check” summaries from fan reviews.

The platform combines a crowd-sourced setlist archive, interactive concert review features, and AI-powered summaries to make live music discovery more engaging, searchable, and user-friendly.

---

## Setup & Run Instructions

### 1. Install prerequisites

You need three things installed on your machine before starting.

**Node.js (v18 or higher)** — the JavaScript runtime that powers the back-end.
- Download: https://nodejs.org (pick the LTS version)
- Verify: open a terminal and run `node --version`. Should print `v18.x.x` or higher.

**MongoDB Community Edition** — the local database.
- **macOS** (recommended):
  ```bash
  brew tap mongodb/brew
  brew install mongodb-community
  ```
- **Windows**: download from https://www.mongodb.com/try/download/community and follow the installer.
- **Linux**: see https://www.mongodb.com/docs/manual/administration/install-on-linux/

**A modern web browser** (Chrome, Safari, Firefox, or Edge — any recent version works).

### 2. Open the project folder in a terminal

```bash
cd path/to/encore-fm
```

For example, if the folder is on your Desktop:

```bash
cd ~/Desktop/encore-fm
```

### 3. Install project dependencies

From inside the `encore-fm` folder:

```bash
npm install
```

This downloads all required libraries (Express, Mongoose, Anthropic SDK, etc.) into a local `node_modules/` folder. Takes about a minute. You'll see some progress text — that's normal.

### 4. Verify the included `.env` file

A pre-configured `.env` file is already in the project root (see the note above). Open it in any text editor to verify it looks like this:

```
MONGODB_URI=mongodb://127.0.0.1:27017/encore_fm
PORT=5050
ANTHROPIC_API_KEY=sk-ant-...
```

The first two lines should match exactly. The third line should start with `sk-ant-` followed by a long string. **Do not change these values**, you want to substitute your own API key.

### 5. Start MongoDB

MongoDB needs to be running in the background before the server can connect to it.

**macOS (Homebrew):**

```bash
brew services start mongodb/brew/mongodb-community
```

To verify it's running:

```bash
brew services list | grep mongodb
```

You should see `started` next to `mongodb-community`. If you see `stopped`, run the start command again.

**Windows / Linux:** MongoDB usually starts automatically after install. If not, follow your operating system's MongoDB documentation.

### 6. Seed the database

This populates MongoDB with the synthetic data needed to demo the site — 5 artists, ~23 historical setlists, 6 upcoming shows, 55 reviews, and ~180 tracks:

```bash
npm run seed
```

You should see output like:
```
[seed] Cleared existing collections.
[seed] Seeded 5 artists, 23 setlists, 55 reviews, 6 upcoming shows.
```

The seed script clears existing data first, so it's safe to run repeatedly if needed.

### 7. Run the server

```bash
npm run dev
```

You should see:
```
[db] Connected to MongoDB → encore_fm
[server] Encore FM listening on http://localhost:5050
```

The terminal will stay open and continue running the server. **Leave it running.**

### 8. Open the site

Open **http://localhost:5050/** in your browser. You should land on the Encore FM home page with trending artists and recent vibe checks already loaded.

---

### Stopping the server

In the terminal running `npm run dev`, press `Ctrl+C`.

To stop MongoDB on macOS:
```bash
brew services stop mongodb/brew/mongodb-community
```

### Re-seeding (resetting the database to original state)

If you want a clean slate:
```bash
npm run seed
```

## What it does

Encore FM lets fans log past concerts, see AI-generated summaries of how shows felt, and predict what songs an artist will play at their next show.

Three flagship features:

| Feature | What it does | How it works |
|---|---|---|
| **Setlist Builder** | Log a concert with drag-and-drop song ordering | Stored in MongoDB, indexed by artist + date |
| **Song Predictor** | Ranks how likely each song is at the next show | Transparent scoring: `0.7 × frequency + 0.3 × recency` over the artist's last 20 shows |
| **AI Vibe Check** | Synthesizes fan reviews into one evocative paragraph + 4 mood tags | Calls Claude (Anthropic) on demand, caches result on the show |

---

## Tech stack & dependencies

### Stack overview

| Layer | Choice | Why |
|---|---|---|
| Front-end | Vanilla HTML / CSS / JavaScript | Course requirement; framework-free, easy to grade |
| Back-end | Node.js + Express | Industry standard, minimal scaffolding, large ecosystem |
| Database | MongoDB + Mongoose | Setlists are variable, ordered song lists — document storage fits better than relational tables |
| AI | Anthropic Claude (Haiku model) | Fast and cheap for short-form synthesis; clean structured-output prompting |

### Runtime dependencies (from `package.json`)

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.x | Web framework — handles HTTP routing, middleware, static file serving |
| `mongoose` | ^8.x | MongoDB ODM — schema definition, validation, query helpers |
| `@anthropic-ai/sdk` | latest | Official Anthropic SDK — wraps the Claude API for Vibe Check generation |
| `dotenv` | ^16.x | Loads environment variables from `.env` into `process.env` at startup |
| `cors` | ^2.x | CORS middleware (defensive — the project is same-origin so it's not strictly needed) |
| `morgan` | ^1.x | HTTP request logger middleware — prints incoming requests to the server console |

### Development dependencies

| Package | Purpose |
|---|---|
| `nodemon` | Auto-restarts the Node server when source files change. Used by `npm run dev`. |

### npm scripts (from `package.json`)

| Script | What it does |
|---|---|
| `npm run dev` | Starts the server with nodemon (auto-reload on file changes) |
| `npm start` | Starts the server with plain node (production-style) |
| `npm run seed` | Runs `server/scripts/seed.js` to populate MongoDB with synthetic data |

---

## Project structure

```
encore-fm/
├── public/                       Front-end (served as static files)
│   ├── index.html                Home — trending artists + recent vibe checks
│   ├── artist.html               Artist profile — bio, past shows, upcoming
│   ├── setlist.html              Setlist detail (past) + AI prediction (upcoming)
│   ├── add.html                  Submit a new setlist
│   ├── style.css                 Shared styles + page-specific utilities
│   ├── main.js                   Shared JS — fetches, animations, search, drag-drop
│   └── images/                   Local artist photos
│
├── server/                       Back-end
│   ├── index.js                  Express bootstrap — middleware, static, routes
│   ├── db/
│   │   └── connection.js         MongoDB connection
│   ├── models/                   Mongoose schemas
│   │   ├── Artist.js             Artist + auto-slug + denormalized counters
│   │   ├── Setlist.js            Past show with embedded songs + cached vibe check
│   │   ├── Review.js             User-submitted reviews
│   │   └── UpcomingShow.js       Planned future events (no songs yet)
│   ├── routes/                   HTTP handlers
│   │   ├── artists.js
│   │   ├── setlists.js           Includes /predict (Song Predictor)
│   │   ├── reviews.js            Includes /recent and /vibecheck
│   │   └── shows.js              Upcoming shows
│   ├── controllers/              Business logic
│   │   ├── predictController.js  Song Predictor scoring
│   │   └── vibeCheckController.js  Claude API integration
│   └── scripts/
│       └── seed.js               Synthetic-data loader
│
├── .env                          Environment configuration (API key included for grading)
├── package.json                  Dependencies + npm scripts
├── package-lock.json             Locked dependency versions
└── README.md                     This file
```

---

## Key modules and scripts

### `server/index.js` — Express bootstrap

Loads environment variables, connects to Mongo, mounts API routes, and serves the `public/` folder as static files. Same-origin setup means the front-end can use relative URLs (`fetch('/api/artists')`) and CORS is a non-issue.

### `server/db/connection.js` — MongoDB connection

Single source of truth for the Mongo connection. Reads `MONGODB_URI` from `.env`, establishes the connection at server startup, and logs success/failure. Uses Mongoose's connection pool — no per-request connection overhead.

### `server/models/Setlist.js` — Setlist schema

Songs are **embedded** inside each setlist (not in a separate Songs collection). Concerts have variable, ordered song lists; embedding means one read per setlist instead of a join. The `vibeCheck` subdocument caches the AI summary to avoid re-calling the LLM on every page view.

### `server/models/Artist.js` — Artist schema

Includes a `pre('validate')` hook that auto-generates a URL-friendly slug from the artist name. Carries denormalized counters (`showCount`, `upcomingCount`, `totalTracks`) maintained at write time so home-page sorts don't require aggregations.

### `server/controllers/predictController.js` — Song Predictor

The prediction algorithm. Pulls the artist's last 20 setlists, tallies song appearances, weights each as `frequency × 0.7 + recency × 0.3`, buckets songs as `guaranteed / very_likely / possible / deep_cut`. Intentionally a transparent algorithm rather than ML — explainable to users, no training data needed, works from day one.

### `server/controllers/vibeCheckController.js` — AI Vibe Check

Sends all reviews for a show to Claude with a structured JSON-output prompt, asks for a 2-4 sentence paragraph + 4 keyword tags. Caches the result on the parent setlist; the "Regenerate" button bypasses cache. The cache invalidates when a new review is submitted.

### `server/scripts/seed.js` — Synthetic data loader

Drops existing collections, then inserts 5 artists, ~23 setlists, 6 upcoming shows, and 55 reviews. Songs are split into "core / frequent / occasional / rare" buckets per artist so the Song Predictor produces clean, interpretable bars on first load. Run with `npm run seed`.

### `public/main.js` — Shared front-end logic

Renders trending artists and vibe cards on the home page, loads the artist page (parallel fetches for hero/bio/shows/upcoming), loads the setlist page in two distinct view modes (past show vs. upcoming-show prediction), and powers the search dropdown, custom cursor, scroll animations, and toast notifications.

### `public/style.css` — Visual design

Single shared stylesheet with CSS variables (`--red`, `--red-light`, `--dark`, etc.) for theming. Implements the dark editorial aesthetic with magenta accents. Responsive breakpoints at 1024px and 768px.

---

## API reference

All endpoints return JSON. Errors return `{ error: "message" }` with appropriate HTTP status (400, 404, 500).

### Artists

| Method | Path | Description |
|---|---|---|
| GET | `/api/artists?sort=trending&limit=6` | Trending artists by show count |
| GET | `/api/artists?q=valentine` | Substring search by name |
| GET | `/api/artists/:slug` | Single artist by slug or ObjectId |
| POST | `/api/artists` | Create artist (used internally by setlist POST) |

### Setlists

| Method | Path | Description |
|---|---|---|
| GET | `/api/setlists?artistId=:slug` | List setlists for an artist |
| GET | `/api/setlists/:id` | Single setlist with all songs |
| GET | `/api/setlists/predict?artistId=:slug` | Song Predictor for the artist's next show |
| POST | `/api/setlists` | Submit a new setlist (auto-creates artist if needed) |

### Reviews

| Method | Path | Description |
|---|---|---|
| GET | `/api/reviews?setlistId=:id` | All reviews for a show |
| GET | `/api/reviews/recent?limit=3` | Recent reviews aggregated for home page |
| GET | `/api/reviews/vibecheck?setlistId=:id` | Cached AI vibe check |
| POST | `/api/reviews/vibecheck/generate` | Force-regenerate the vibe check |
| POST | `/api/reviews` | Submit a new review (invalidates vibe cache) |

### Shows

| Method | Path | Description |
|---|---|---|
| GET | `/api/shows/upcoming?artistId=:slug` | Future shows for an artist |
| GET | `/api/shows/upcoming/:id` | Single upcoming show by ID |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness probe |

---

## Design decisions worth highlighting

**Slug-based artist URLs.** `/artist.html?name=cocteau-twins` is readable and shareable; ObjectIds are not. Slugs auto-generate from artist names on first save via a Mongoose `pre('validate')` hook.

**Denormalized counters.** Artists carry `showCount`, `upcomingCount`, and `totalTracks` fields, maintained at write time. Saves expensive aggregations on the home page's trending sort.

**Separate `Setlist` and `UpcomingShow` collections.** Past shows have songs; upcoming shows don't. Different query patterns ("future shows ascending" vs. "past shows descending"). Splitting them gives cleaner schemas and simpler queries than one polymorphic collection with conditional fields.

**Transparent predictor scoring.** A user (or a grader) can see *why* a song is ranked high — frequency over the last 20 shows, plus a recency boost. No ML, no cold-start problem, no training data, defensible to anyone reviewing the code.

**Cached AI vibe checks.** Each LLM call costs money and takes 1-3 seconds. Caching on the parent setlist means repeated views are instant. The cache invalidates when a new review is submitted, so the next view triggers a fresh generation.

**Two view modes on `setlist.html`.** A single page handles both past-show display (`?id=<setlistId>`) and upcoming-show prediction (`?upcoming=<showId>`). The URL determines which mode is rendered; both modes share the page header but have different body layouts. This avoids duplicating navigation, footer, and header markup across two separate pages.

**Synthetic seed data engineered for the demo.** Songs are split into "core / frequent / occasional / rare" buckets per artist. The predictor produces clean, interpretable bars (top tracks at ~100%, deep cuts at <30%) that show the algorithm working on first load.

---

## Acknowledgments

- Sample artist names and song titles are real but used illustratively. No actual fan reviews were used; all review text is synthetic.
- Claude (Anthropic) generates the live AI vibe checks on demand.

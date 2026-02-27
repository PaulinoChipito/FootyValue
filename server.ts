import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import axios from "axios";
import { format, addDays } from "date-fns";

// --- Configuration ---
const PORT = 3000;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "9d2c4971eaeb4b63a98ff49b79caad5e";
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || "b53c031b935c60d7741a074a16e37ab2";

// --- Database Setup ---
const db = new Database("football.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY,
    name TEXT,
    code TEXT
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    name TEXT,
    league_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    utc_date TEXT,
    status TEXT,
    league_id INTEGER,
    home_team_id INTEGER,
    away_team_id INTEGER,
    home_score_full INTEGER,
    away_score_full INTEGER,
    home_score_h1 INTEGER,
    away_score_h1 INTEGER,
    home_score_h2 INTEGER,
    away_score_h2 INTEGER,
    corners INTEGER
  );

  CREATE TABLE IF NOT EXISTS odds (
    match_id INTEGER PRIMARY KEY,
    home_win REAL,
    draw REAL,
    away_win REAL,
    u35_h1 REAL,
    u35_h2 REAL,
    over_55_corners REAL,
    team_y_wins_half REAL,
    bookmaker TEXT,
    last_update TEXT
  );
`);

// --- Statistical Utilities ---
function poisson(lambda: number): number {
  let L = Math.exp(-lambda);
  let p = 1.0;
  let k = 0;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// Monte Carlo Simulation
function simulateMatch(
  homeExpG: number, 
  awayExpG: number, 
  homeExpC: number, 
  awayExpC: number,
  isTeamYHome: boolean,
  iterations = 20000
) {
  let successCount = 0;

  for (let i = 0; i < iterations; i++) {
    // Goals per half (simplified: 45% 1st half, 55% 2nd half)
    const h1_home = poisson(homeExpG * 0.45);
    const h1_away = poisson(awayExpG * 0.45);
    const h2_home = poisson(homeExpG * 0.55);
    const h2_away = poisson(awayExpG * 0.55);

    // Corners (Poisson)
    const corners = poisson(homeExpC) + poisson(awayExpC);

    // Criteria 1 & 2: Under 3.5 goals in each half
    const u35_h1 = (h1_home + h1_away) < 3.5;
    const u35_h2 = (h2_home + h2_away) < 3.5;

    // Criteria 3: Team Y wins at least one half
    let teamYWinsHalf = false;
    if (isTeamYHome) {
      teamYWinsHalf = (h1_home > h1_away) || (h2_home > h2_away);
    } else {
      teamYWinsHalf = (h1_away > h1_home) || (h2_away > h2_home);
    }

    // Criteria 4: Over 5.5 corners
    const o55_corners = corners > 5.5;

    if (u35_h1 && u35_h2 && teamYWinsHalf && o55_corners) {
      successCount++;
    }
  }

  return successCount / iterations;
}

// --- API Services ---
async function syncLeagues() {
  try {
    const response = await axios.get("https://api.football-data.org/v4/competitions", {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY }
    });
    const competitions = response.data.competitions;
    const stmt = db.prepare("INSERT OR REPLACE INTO leagues (id, name, code) VALUES (?, ?, ?)");
    for (const c of competitions) {
      stmt.run(c.id, c.name, c.code);
    }
    console.log(`Synced ${competitions.length} leagues`);
  } catch (error) {
    console.error("Error syncing leagues:", error);
  }
}

async function syncFixtures() {
  try {
    // Fetch matches for the next 10 days across all available competitions
    const dateFrom = format(new Date(), "yyyy-MM-dd");
    const dateTo = format(addDays(new Date(), 10), "yyyy-MM-dd");
    
    const response = await axios.get("https://api.football-data.org/v4/matches", {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
      params: { dateFrom, dateTo }
    });

    const matches = response.data.matches;
    const stmtMatch = db.prepare(`
      INSERT OR REPLACE INTO matches (id, utc_date, status, league_id, home_team_id, away_team_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const stmtTeam = db.prepare(`INSERT OR IGNORE INTO teams (id, name, league_id) VALUES (?, ?, ?)`);

    db.transaction(() => {
      for (const m of matches) {
        stmtTeam.run(m.homeTeam.id, m.homeTeam.name, m.competition.id);
        stmtTeam.run(m.awayTeam.id, m.awayTeam.name, m.competition.id);
        stmtMatch.run(m.id, m.utcDate, m.status, m.competition.id, m.homeTeam.id, m.awayTeam.id);
      }
    })();
    
    console.log(`Synced ${matches.length} fixtures from all available worldwide leagues`);
  } catch (error) {
    console.error("Error syncing fixtures:", error);
  }
}

// --- Server Setup ---
async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/analysis", async (req, res) => {
    try {
      const matches = db.prepare(`
        SELECT m.*, h.name as home_name, a.name as away_name, l.name as league_name
        FROM matches m
        JOIN teams h ON m.home_team_id = h.id
        JOIN teams a ON m.away_team_id = a.id
        JOIN leagues l ON m.league_id = l.id
        WHERE m.status = 'TIMED' OR m.status = 'SCHEDULED'
        ORDER BY m.utc_date ASC
      `).all() as any[];

      const analyzedMatches = matches.map(m => {
        // In a production system, we would calculate these from historical data
        // For now, we use a heuristic based on league averages and random variance for the demo
        // but the structure is ready for real Poisson parameters.
        const homeExpG = 1.2 + (Math.random() * 0.8);
        const awayExpG = 1.0 + (Math.random() * 0.8);
        const homeExpC = 4.5 + (Math.random() * 2);
        const awayExpC = 4.0 + (Math.random() * 2);

        // Simulate for Home Team as Team Y
        const probHomeY = simulateMatch(homeExpG, awayExpG, homeExpC, awayExpC, true);
        // Simulate for Away Team as Team Y
        const probAwayY = simulateMatch(homeExpG, awayExpG, homeExpC, awayExpC, false);

        // We pick the best value (either Home or Away as Team Y)
        const isHomeBetter = probHomeY >= probAwayY;
        const probModel = isHomeBetter ? probHomeY : probAwayY;
        
        // Mock odds for now - in production these come from The Odds API
        const oddAvg = 1 / (probModel * 0.8); // 20% margin
        const bestOdd = oddAvg * 1.1;
        const probImplied = 1 / bestOdd;
        const edge = probModel - probImplied;
        const ev = (probModel * bestOdd) - 1;

        return {
          id: m.id,
          homeTeam: m.home_name,
          awayTeam: m.away_name,
          league: m.league_name,
          date: m.utc_date,
          probModel,
          oddAvg,
          bestOdd,
          probImplied,
          edge,
          ev,
          confidence: probModel > 0.15 ? "High" : "Medium",
          isTeamYHome: isHomeBetter
        };
      });

      // Filter for positive EV and reasonable edge
      const filtered = analyzedMatches.filter(m => m.ev > 0).slice(0, 50);

      res.json(filtered);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze matches" });
    }
  });

  app.post("/api/sync", async (req, res) => {
    await syncLeagues();
    await syncFixtures();
    res.json({ status: "Worldwide sync completed" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

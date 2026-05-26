const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CACHE_PREFIX = "apexgrid_jolpica_";

// Cache for mapped driver IDs (in-memory)
let cachedDrivers = null;

// Simple delay helper to respect API rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCache(key) {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const itemStr = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    const now = Date.now();
    if (now > item.expiry) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return item.value;
  } catch (e) {
    return null;
  }
}

function setCache(key, value, ttl) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const now = Date.now();
    const item = {
      value: value,
      expiry: now + ttl
    };
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn("Storage write failed (possibly quota full):", e);
  }
}

function getTtlForEndpoint(endpoint) {
  const currentYear = new Date().getFullYear();
  // 1. Matches /YYYY/ at the start
  const yearMatch = endpoint.match(/^\/(\d{4})\//);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year < currentYear) {
      return 30 * 24 * 60 * 60 * 1000; // 30 days for past seasons
    }
  }

  // 2. Season/Constructor/Drivers list
  if (endpoint.includes("/seasons.json") || endpoint.includes("/constructors.json") || endpoint.includes("/drivers.json")) {
    return 24 * 60 * 60 * 1000; // 1 day
  }

  // 3. Dynamic results, wins, poles, podiums
  return 10 * 60 * 1000; // 10 minutes for active stats
}

async function fetchJolpica(endpoint) {
  const cachedData = getCache(endpoint);
  if (cachedData !== null) {
    return cachedData;
  }

  const response = await fetch(`${JOLPICA_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Jolpica API Error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  
  const ttl = getTtlForEndpoint(endpoint);
  setCache(endpoint, data, ttl);
  
  return data;
}

export const jolpicaApi = {
  /**
   * Resolves an OpenF1 driver number or code to a Jolpica driver ID dynamically
   */
  getDriverId: async (code, number) => {
    try {
      // 1. Fetch current season drivers from API if not cached
      if (!cachedDrivers) {
        const data = await fetchJolpica("/current/drivers.json?limit=100");
        cachedDrivers = data?.MRData?.DriverTable?.Drivers || [];
      }

      // Try matching in the current season active grid list
      let match = cachedDrivers.find(d => 
        (number && d.permanentNumber === number.toString()) || 
        (code && d.code?.toUpperCase() === code.toUpperCase())
      );

      // 2. Fallback: If not in current season, search in 2024 season list
      if (!match) {
        const data2024 = await fetchJolpica("/2024/drivers.json?limit=100");
        const drivers2024 = data2024?.MRData?.DriverTable?.Drivers || [];
        match = drivers2024.find(d => 
          (number && d.permanentNumber === number.toString()) || 
          (code && d.code?.toUpperCase() === code.toUpperCase())
        );
      }

      if (match) {
        return match.driverId;
      }
    } catch (e) {
      console.error("Failed to map driver dynamically", e);
      throw e;
    }

    // 3. Fallback: slugify code or driver name
    return code ? code.toLowerCase() : `driver_${number}`;
  },

  /**
   * Fetches complete career statistics for a driver, calculating titles and best seasons dynamically
   */
  getCareerStats: async (driverId) => {
    try {
      // Fetch total starts, wins, 2nd, and 3rd places, poles, and seasons
      const [startsData, winsData, p2Data, p3Data, polesData, seasonsData] = await Promise.all([
        fetchJolpica(`/drivers/${driverId}/results.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/1.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/2.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/3.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/qualifying/1.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/seasons.json?limit=100`)
      ]);

      const starts = parseInt(startsData?.MRData?.total || 0, 10);
      const wins = parseInt(winsData?.MRData?.total || 0, 10);
      const p2 = parseInt(p2Data?.MRData?.total || 0, 10);
      const p3 = parseInt(p3Data?.MRData?.total || 0, 10);
      const poles = parseInt(polesData?.MRData?.total || 0, 10);
      const podiums = wins + p2 + p3;
      const seasons = seasonsData?.MRData?.SeasonTable?.Seasons || [];

      // Retrieve standings sequentially with 150ms delay to count championships and best season points
      let championshipsCount = 0;
      let bestSeasonPoints = 0;
      let bestSeasonYear = "";

      for (const s of seasons) {
        try {
          const res = await fetchJolpica(`/${s.season}/drivers/${driverId}/driverStandings.json`);
          const list = res?.MRData?.StandingsTable?.StandingsLists || [];
          if (list.length > 0) {
            const driverStandings = list[0].DriverStandings || [];
            if (driverStandings.length > 0) {
              const standing = driverStandings[0];
              const pos = standing.position;
              const pts = parseFloat(standing.points || 0);
              const season = list[0].season;
              
              if (pos === "1") {
                championshipsCount++;
              }
              if (pts > bestSeasonPoints) {
                bestSeasonPoints = pts;
                bestSeasonYear = season;
              }
            }
          }
          await delay(150);
        } catch (err) {
          console.error(`Failed to fetch standings for season ${s.season}`, err);
          
          // If it's a 404 and it's the current year or future, it's safe to skip it (stands for no data yet)
          const is404 = err.message.includes("404");
          const isCurrentOrFuture = parseInt(s.season, 10) >= new Date().getFullYear();
          if (is404 && isCurrentOrFuture) {
            console.log(`Skipping standings for current/future season ${s.season} due to 404 (not started/available yet)`);
            continue;
          }

          if (err.message.includes("429")) {
            await delay(1500); // Backoff and retry once
            try {
              const res = await fetchJolpica(`/${s.season}/drivers/${driverId}/driverStandings.json`);
              const list = res?.MRData?.StandingsTable?.StandingsLists || [];
              if (list.length > 0) {
                const driverStandings = list[0].DriverStandings || [];
                if (driverStandings.length > 0) {
                  const standing = driverStandings[0];
                  const pos = standing.position;
                  const pts = parseFloat(standing.points || 0);
                  const season = list[0].season;
                  
                  if (pos === "1") {
                    championshipsCount++;
                  }
                  if (pts > bestSeasonPoints) {
                    bestSeasonPoints = pts;
                    bestSeasonYear = season;
                  }
                }
              }
            } catch (e) {
              console.error(`Retry failed for season ${s.season}`, e);
              throw e;
            }
          } else {
            throw err;
          }
        }
      }

      return {
        titles: championshipsCount,
        wins,
        poles,
        podiums,
        starts,
        bestSeasonPoints,
        bestSeasonYear
      };
    } catch (error) {
      console.error(`Failed to fetch career stats for driver ${driverId}`, error);
      throw error;
    }
  },

  /**
   * Fetches timeline of constructors the driver has driven for and their active years
   */
  getConstructorTimeline: async (driverId) => {
    try {
      // 1. Get list of constructors
      const constructorsData = await fetchJolpica(`/drivers/${driverId}/constructors.json?limit=100`);
      const constructors = constructorsData?.MRData?.ConstructorTable?.Constructors || [];

      // 2. Fetch years for each constructor in parallel
      const timeline = await Promise.all(
        constructors.map(async (con) => {
          try {
            const seasonsData = await fetchJolpica(`/drivers/${driverId}/constructors/${con.constructorId}/seasons.json?limit=100`);
            const seasons = seasonsData?.MRData?.SeasonTable?.Seasons || [];
            
            const years = seasons.map(s => parseInt(s.season, 10)).sort((a, b) => a - b);
            
            return {
              id: con.constructorId,
              name: con.name,
              nationality: con.nationality,
              url: con.url,
              startYear: years.length > 0 ? years[0] : null,
              endYear: years.length > 0 ? years[years.length - 1] : null,
              seasonsCount: years.length
            };
          } catch (e) {
            console.error(`Error fetching seasons for constructor ${con.constructorId}`, e);
            throw e;
          }
        })
      );

      // Sort timeline chronologically (latest team last, i.e., in order of start year)
      return timeline.filter(t => t.startYear !== null).sort((a, b) => a.startYear - b.startYear);
    } catch (error) {
      console.error(`Failed to fetch constructor timeline for driver ${driverId}`, error);
      throw error;
    }
  }
};

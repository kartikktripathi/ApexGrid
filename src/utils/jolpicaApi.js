const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

// Cache for mapped driver IDs
let cachedDrivers = null;

// Standard F1 driver code to Ergast driverId mapping
const CODE_TO_ID = {
  VER: 'max_verstappen',
  HAM: 'hamilton',
  NOR: 'norris',
  PIA: 'piastri',
  LEC: 'leclerc',
  SAI: 'sainz',
  RUS: 'russell',
  PER: 'perez',
  GAS: 'gasly',
  OCO: 'ocon',
  ALB: 'albon',
  BOT: 'bottas',
  TSU: 'tsunoda',
  STR: 'stroll',
  MAG: 'magnussen',
  HUL: 'hulkenberg',
  LAW: 'lawson',
  BEA: 'bearman',
  COL: 'colapinto',
  BOR: 'bortoleto',
  HAD: 'hadjar',
  LIN: 'arvid_lindblad',
  ANT: 'antonelli'
};

// Known championships map
const CHAMPIONSHIPS = {
  max_verstappen: 4,
  hamilton: 7,
  alonso: 2,
  norris: 1,
  vettel: 4,
  raikkonen: 1
};

async function fetchJolpica(endpoint) {
  const response = await fetch(`${JOLPICA_BASE_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Jolpica API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const jolpicaApi = {
  /**
   * Resolves an OpenF1 driver number or code to a Jolpica driver ID
   */
  getDriverId: async (code, number) => {
    // 1. Check local dictionary first
    if (code && CODE_TO_ID[code.toUpperCase()]) {
      return CODE_TO_ID[code.toUpperCase()];
    }

    // 2. Fetch current season drivers from API if not cached
    try {
      if (!cachedDrivers) {
        const data = await fetchJolpica("/current/drivers.json?limit=100");
        cachedDrivers = data?.MRData?.DriverTable?.Drivers || [];
      }

      const match = cachedDrivers.find(d => 
        (number && d.permanentNumber === number.toString()) || 
        (code && d.code?.toUpperCase() === code.toUpperCase())
      );

      if (match) {
        return match.driverId;
      }
    } catch (e) {
      console.error("Failed to fetch drivers list from Jolpica:", e);
    }

    // 3. Fallback: Slugify name
    return code ? code.toLowerCase() : `driver_${number}`;
  },

  /**
   * Fetches complete career statistics for a driver
   */
  getCareerStats: async (driverId) => {
    try {
      // Fetch total starts, wins, 2nd, and 3rd places in parallel
      const [startsData, winsData, p2Data, p3Data, polesData] = await Promise.all([
        fetchJolpica(`/drivers/${driverId}/results.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/1.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/2.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/results/3.json?limit=1`),
        fetchJolpica(`/drivers/${driverId}/qualifying/1.json?limit=1`)
      ]);

      const starts = parseInt(startsData?.MRData?.total || 0, 10);
      const wins = parseInt(winsData?.MRData?.total || 0, 10);
      const p2 = parseInt(p2Data?.MRData?.total || 0, 10);
      const p3 = parseInt(p3Data?.MRData?.total || 0, 10);
      const poles = parseInt(polesData?.MRData?.total || 0, 10);
      const podiums = wins + p2 + p3;
      const titles = CHAMPIONSHIPS[driverId] || 0;

      return {
        titles,
        wins,
        poles,
        podiums,
        starts
      };
    } catch (error) {
      console.error(`Failed to fetch career stats for driver ${driverId}`, error);
      return {
        titles: CHAMPIONSHIPS[driverId] || 0,
        wins: 0,
        poles: 0,
        podiums: 0,
        starts: 0
      };
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
            return {
              id: con.constructorId,
              name: con.name,
              nationality: con.nationality,
              url: con.url,
              startYear: null,
              endYear: null,
              seasonsCount: 0
            };
          }
        })
      );

      // Sort timeline chronologically (latest team last, i.e., in order of start year)
      return timeline.filter(t => t.startYear !== null).sort((a, b) => a.startYear - b.startYear);
    } catch (error) {
      console.error(`Failed to fetch constructor timeline for driver ${driverId}`, error);
      return [];
    }
  }
};

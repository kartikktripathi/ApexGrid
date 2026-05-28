const API_BASE_URL = "https://api.openf1.org/v1";

// Generic fetch with error handling
async function fetchAPI(endpoint) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export const f1Api = {
  // Meetings & Sessions
  getMeetings: (year) => fetchAPI(`/meetings?year=${year}`),
  getSessions: (year, sessionName = "Race") =>
    fetchAPI(`/sessions?year=${year}&session_name=${sessionName}`),

  // Drivers & Teams
  getDrivers: (sessionKey = "latest") =>
    fetchAPI(`/drivers?session_key=${sessionKey}`),
  getChampionshipDrivers: (sessionKey = "latest") =>
    fetchAPI(`/championship_drivers?session_key=${sessionKey}`),
  getChampionshipTeams: (sessionKey = "latest") =>
    fetchAPI(`/championship_teams?session_key=${sessionKey}`),

  // Results & Positions
  getPositions: (sessionKey, positionLimit = 3) =>
    fetchAPI(`/position?session_key=${sessionKey}&position<=${positionLimit}`),
};

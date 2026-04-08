const API_BASE_URL = "https://api.openf1.org/v1"

window.failedDataPool = [];
function renderFailedDataPool() {
    let container = document.getElementById('failed-data-pool');
    if (!container) {
        container = document.createElement('div');
        container.id = 'failed-data-pool';
        container.style.marginTop = '3rem';
        container.style.padding = '1.5rem';
        container.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        container.style.display = 'none';
        
        container.innerHTML = `
            <h3 style="color:#e10600; margin-bottom: 1rem; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;">Data not fetched</h3>
            <div id="failed-data-list" style="display:flex; flex-wrap:wrap; gap:1rem;"></div>
        `;
        
        const main = document.querySelector('main.app-main') || document.body;
        main.appendChild(container);
    }
    
    const list = document.getElementById('failed-data-list');
    list.innerHTML = '';
    
    if (window.failedDataPool.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    window.failedDataPool.forEach((item, idx) => {
        const itemEl = document.createElement('div');
        itemEl.style.background = 'rgba(255,255,255,0.05)';
        itemEl.style.border = '1px solid rgba(255,255,255,0.2)';
        itemEl.style.padding = '0.5rem 1rem';
        itemEl.style.borderRadius = '4px';
        itemEl.style.display = 'flex';
        itemEl.style.alignItems = 'center';
        itemEl.style.gap = '1rem';
        
        itemEl.innerHTML = `
            <span style="font-size:0.9rem; color:#f4f4f5;">${item.label}</span>
            <button class="btn" style="padding:0.3rem 0.6rem; font-size:0.8rem; min-width:60px;">Reload</button>
        `;
        
        const btn = itemEl.querySelector('button');
        btn.addEventListener('click', async () => {
            btn.textContent = '...';
            btn.disabled = true;
            try {
                const success = await item.retry();
                if (success) {
                    window.failedDataPool.splice(idx, 1);
                    renderFailedDataPool();
                } else {
                    btn.textContent = 'Failed';
                    setTimeout(() => { btn.textContent = 'Reload'; btn.disabled = false; }, 2000);
                }
            } catch (err) {
                btn.textContent = 'Failed';
                setTimeout(() => { btn.textContent = 'Reload'; btn.disabled = false; }, 2000);
            }
        });
        
        list.appendChild(itemEl);
    });
}

let loadingIndicator = document.getElementById("loading-indicator")
let dashboardContent = document.getElementById("dashboard-content")
let errorContainer = document.getElementById("error-container")
let errorMessage = document.getElementById("error-message")
let retryButton = document.getElementById("retry-button")
let sessionInfo = document.getElementById("session-info")
let driverGrid = document.getElementById("driver-grid")
let teamGrid = document.getElementById("team-grid")
let seasonsGrid = document.getElementById("seasons-grid")
let seasonSelect = document.getElementById("season-select")

async function initDashboard() {
    if (!sessionInfo && !driverGrid && !teamGrid && !seasonsGrid) return;

    showLoading()
    try {
        const tasks = [];
        let fetchedSession = null;
        let fetchedDrivers = null;
        let fetchedSeasonsData = null;

        if (seasonsGrid) {
            const year = seasonSelect ? seasonSelect.value : new Date().getFullYear();
            tasks.push(fetchSeasonData(year).then(data => fetchedSeasonsData = data));
        }

        if (sessionInfo) {
            const currentYear = new Date().getFullYear();
            tasks.push(fetch(`${API_BASE_URL}/meetings?year=${currentYear}`).then(res => {
                if (!res.ok) throw new Error("Failed to fetch meetings data");
                return res.json().then(async meetings => {
                    meetings.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
                    const now = new Date();
                    const nextMeeting = meetings.find(m => new Date(m.date_end || m.date_start) > now);

                    if (nextMeeting) {
                        return { type: 'next_gp', data: nextMeeting };
                    } else {
                        const [driverRes, teamRes] = await Promise.all([
                            fetch(`${API_BASE_URL}/championship_drivers?session_key=latest`),
                            fetch(`${API_BASE_URL}/championship_teams?session_key=latest`)
                        ]);

                        let dChamp = null;
                        let tChamp = null;

                        if (driverRes.ok) {
                            const dData = await driverRes.json();
                            if (dData && dData.length > 0) dChamp = dData.sort((a, b) => b.points_current - a.points_current)[0];
                        }

                        if (teamRes.ok) {
                            const tData = await teamRes.json();
                            if (tData && tData.length > 0) tChamp = tData.sort((a, b) => b.points_current - a.points_current)[0];
                        }

                        return { type: 'season_ended', driver: dChamp, team: tChamp };
                    }
                });
            }).then(result => fetchedSession = result));
        }
        if (driverGrid || teamGrid) {
            tasks.push(fetch(`${API_BASE_URL}/drivers?session_key=latest`).then(res => {
                if (!res.ok) throw new Error("Failed to fetch drivers data");
                return res.json().then(data => fetchedDrivers = data);
            }));
        }

        await Promise.all(tasks);

        if (sessionInfo) {
            if (!fetchedSession) {
                throw new Error("No session data available.");
            }
            renderSessionInfo(fetchedSession);
        }

        if (driverGrid) {
            if (!fetchedDrivers) {
                throw new Error("No initial driver grid data available.");
            }
            renderDriversGrid(fetchedDrivers);
        }

        if (teamGrid) {
            if (!fetchedDrivers) {
                throw new Error("No initial team data available.");
            }
            renderTeamsGrid(fetchedDrivers);
        }

        if (seasonsGrid) {
            if (!fetchedSeasonsData) {
                throw new Error("No season data available.");
            }
            renderSeasonsGrid(fetchedSeasonsData);
        }

        showDashboard()
    } catch (err) {
        console.log("Error fetching F1 data:", err)
        showError("An unexpected error occurred while loading F1 data.")
    }
}

function renderSessionInfo(result) {
    const sectionTitle = sessionInfo.closest('.session-section').querySelector('.section-title');

    if (result.type === 'next_gp') {
        const meeting = result.data;
        const dateObj = new Date(meeting.date_start)
        const dateStart = dateObj.toDateString() + " " + dateObj.toTimeString().split(" ")[0]

        if (sectionTitle) sectionTitle.textContent = "Next Grand Prix";

        sessionInfo.innerHTML = `
            <div class="session-stat">
                <span class="stat-label">Event / Year</span>
                <span class="stat-value">${meeting.year} ${meeting.country_name || "Grand Prix"}</span>
            </div>
            <div class="session-stat">
                <span class="stat-label">Meeting Name</span>
                <span class="stat-value">${meeting.meeting_name || meeting.meeting_official_name}</span>
            </div>
            <div class="session-stat">
                <span class="stat-label">Circuit</span>
                <span class="stat-value">${meeting.circuit_short_name || meeting.location || "TBA"}</span>
            </div>
            <div class="session-stat">
                <span class="stat-label">Start Time</span>
                <span class="stat-value">${dateStart}</span>
            </div>
        `
    } else if (result.type === 'season_ended') {
        if (sectionTitle) sectionTitle.textContent = "Season Concluded - Champions";

        const dChamp = result.driver;
        const tChamp = result.team;

        const dName = dChamp ? (dChamp.full_name || `${dChamp.first_name} ${dChamp.last_name}`) : "Unknown";
        const tName = tChamp ? tChamp.team_name : "Unknown";
        const dPoints = dChamp ? dChamp.points_current : "-";
        const tPoints = tChamp ? tChamp.points_current : "-";

        sessionInfo.innerHTML = `
            <div class="session-stat" style="grid-column: span 2; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; margin-bottom: 0.5rem; justify-content: center; align-items: center;">
                <span class="stat-value highlight" style="font-size: 1.5rem; letter-spacing: 1px;">Season Finished</span>
            </div>
            <div class="session-stat" style="background: rgba(225, 6, 0, 0.1); border-left: 3px solid #e10600; padding: 1rem;">
                <span class="stat-label">World Driver Champion</span>
                <span class="stat-value">${dName}</span>
                <span class="stat-label" style="margin-top: 0.5rem; font-size: 0.75rem;">Points</span>
                <span class="stat-value" style="font-size: 1.1rem; color: #ffd700;">${dPoints} pts</span>
            </div>
            <div class="session-stat" style="background: rgba(255, 255, 255, 0.05); border-left: 3px solid #ccc; padding: 1rem;">
                <span class="stat-label">World Constructor Champion</span>
                <span class="stat-value">${tName}</span>
                <span class="stat-label" style="margin-top: 0.5rem; font-size: 0.75rem;">Points</span>
                <span class="stat-value" style="font-size: 1.1rem; color: #ffd700;">${tPoints} pts</span>
            </div>
        `;
    }
}

function renderDriversGrid(drivers) {
    driverGrid.innerHTML = ""

    if (!drivers || drivers.length === 0) {
        driverGrid.innerHTML = "<p class='text-muted'>No drivers data available for this session.</p>"
        return
    }

    // handling the duplicates below..
    const uniqueDrivers = []
    const seenNumbers = []

    for (const d of drivers) {
        if (!seenNumbers.includes(d.driver_number)) {
            uniqueDrivers.push(d)
            seenNumbers.push(d.driver_number)
        }
    }

    uniqueDrivers.forEach(driver => {
        const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#e10600"

        const card = document.createElement("div")
        card.className = "driver-card"
        card.style.borderTop = `3px solid ${teamColor}`

        const teamNameText = driver.team_name || "Unknown Team"
        const driverNameText = driver.full_name || `${driver.first_name} ${driver.last_name}`
        const headshot = driver.headshot_url || "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/fallback/fallback.png.transform/1col/image.png"

        card.innerHTML = `
            <div class="card-header">
                <span class="driver-number">${driver.driver_number}</span>
            </div>
            <div class="card-body">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <img src="${headshot}" alt="Photo of ${driverNameText}" 
                         style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%; border: 2px solid ${teamColor};">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span class="driver-name">${driverNameText}</span>
                        <div class="team-chip" style="border-left-color: ${teamColor};">${teamNameText}</div>
                    </div>
                </div>
            </div>
        `

        driverGrid.appendChild(card)
    })
}

function renderTeamsGrid(drivers) {
    teamGrid.innerHTML = ""

    if (!drivers || drivers.length === 0) {
        teamGrid.innerHTML = "<p class='text-muted'>No teams data available for this session.</p>"
        return
    }

    const uniqueTeams = {}

    for (const d of drivers) {
        if (!uniqueTeams[d.team_name] && d.team_name) {
            uniqueTeams[d.team_name] = {
                team_name: d.team_name,
                team_colour: d.team_colour,
                drivers: []
            }
        }
        if (d.team_name) {
            const driverName = d.full_name || `${d.first_name} ${d.last_name}`
            if (!uniqueTeams[d.team_name].drivers.includes(driverName)) {
                uniqueTeams[d.team_name].drivers.push(driverName)
            }
        }
    }

    Object.values(uniqueTeams).forEach(team => {
        const teamColor = team.team_colour ? `#${team.team_colour}` : "#e10600"

        const card = document.createElement("div")
        card.className = "driver-card"
        card.style.borderTop = `3px solid ${teamColor}`

        card.innerHTML = `
            <div class="card-header">
                <span class="driver-number" style="background: ${teamColor}; font-size: 0.8rem; padding: 0.2rem 0.5rem; border-radius: 4px;">F1</span>
            </div>
            <div class="card-body">
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div style="min-width: 60px; height: 60px; border-radius: 50%; border: 2px solid ${teamColor}; background: ${teamColor}33; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.5rem; color: #fff;">
                       ${team.team_name.charAt(0)}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <span class="driver-name">${team.team_name}</span>
                        <div class="team-chip" style="border-left-color: ${teamColor}; height: auto; white-space: normal;">
                            ${team.drivers.join(" & ")}
                        </div>
                    </div>
                </div>
            </div>
        `

        teamGrid.appendChild(card)
    })
}

function showLoading() {
    if (loadingIndicator && loadingIndicator.className.indexOf("hidden") === -1 === false) {
        loadingIndicator.className = loadingIndicator.className.replace("hidden", "").trim()
    }
    if (loadingIndicator) loadingIndicator.className = loadingIndicator.className.replace("hidden", "").trim()
    if (dashboardContent && dashboardContent.className.indexOf("hidden") === -1) dashboardContent.className += " hidden"
    if (errorContainer && errorContainer.className.indexOf("hidden") === -1) errorContainer.className += " hidden"
}

function showDashboard() {
    if (loadingIndicator && loadingIndicator.className.indexOf("hidden") === -1) loadingIndicator.className += " hidden"
    if (dashboardContent) dashboardContent.className = dashboardContent.className.replace("hidden", "").trim()
    if (errorContainer && errorContainer.className.indexOf("hidden") === -1) errorContainer.className += " hidden"
}

function showError(message) {
    if (errorMessage) errorMessage.textContent = message
    if (loadingIndicator && loadingIndicator.className.indexOf("hidden") === -1) loadingIndicator.className += " hidden"
    if (dashboardContent && dashboardContent.className.indexOf("hidden") === -1) dashboardContent.className += " hidden"
    if (errorContainer) errorContainer.className = errorContainer.className.replace("hidden", "").trim()
}

if (retryButton) {
    retryButton.addEventListener("click", initDashboard)
}
if (seasonSelect) {
    seasonSelect.addEventListener("change", initDashboard)
}
document.addEventListener("DOMContentLoaded", initDashboard)

async function fetchSeasonData(year) {
    const sessionRes = await fetch(`${API_BASE_URL}/sessions?year=${year}&session_name=Race`);
    if (!sessionRes.ok) throw new Error("Failed to fetch sessions data");
    const sessions = await sessionRes.json();

    const now = new Date();
    const pastRaces = sessions.filter(s => new Date(s.date_end || s.date_start) < now)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    let driversMap = {};
    const podiumRounds = [];
    
    for (let i = 0; i < pastRaces.length; i += 3) {
        const batch = pastRaces.slice(i, i + 3);
        const batchResults = await Promise.all(batch.map(async (race) => {
            const [posRes, drvRes] = await Promise.all([
                fetch(`${API_BASE_URL}/position?session_key=${race.session_key}&position%3C%3D3`),
                fetch(`${API_BASE_URL}/drivers?session_key=${race.session_key}`)
            ]);
            
            if (drvRes.ok) {
                const drvs = await drvRes.json();
                drvs.forEach(d => {
                    if (!driversMap[d.driver_number]) driversMap[d.driver_number] = d;
                });
            }

            if (!posRes.ok) return { race, podium: [] };
            const posData = await posRes.json();

            const latestPositions = { 1: null, 2: null, 3: null };
            posData.forEach(p => {
                const pos = p.position;
                if (pos >= 1 && pos <= 3) {
                    if (!latestPositions[pos] || new Date(p.date) > new Date(latestPositions[pos].date)) {
                        latestPositions[pos] = p;
                    }
                }
            });

            return { race, podium: [latestPositions[1], latestPositions[2], latestPositions[3]] };
        }));
        
        podiumRounds.push(...batchResults);

        if (i + 3 < pastRaces.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return { pastRaces, podiumRounds, driversMap };
}

function renderSeasonsGrid(data) {
    window.failedDataPool = window.failedDataPool.filter(i => !i.label.includes('(Season Grid)'));
    const { pastRaces, podiumRounds, driversMap } = data;
    seasonsGrid.innerHTML = "";

    if (pastRaces.length === 0) {
        seasonsGrid.innerHTML = "<p class='text-muted' style='grid-column: 1/-1;'>No past races found for this season yet.</p>";
        return;
    }

    podiumRounds.forEach(round => {
        const race = round.race;
        const podium = round.podium;
        const gpTitle = race.location ? `${race.country_name} (${race.location})` : race.country_name;

        const getDriverUI = (posEvent) => {
            if (!posEvent) return `<div class="team-chip" style="margin:0 auto; opacity: 0.5;">N/A</div>`;
            const driver = driversMap[posEvent.driver_number];
            if (!driver) return `<div class="team-chip" style="margin:0 auto;">#${posEvent.driver_number}</div>`;

            const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#ccc";
            const name = driver.name_acronym || driver.last_name || driver.full_name;
            const headshot = driver.headshot_url || "https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/fallback/fallback.png.transform/1col/image.png";

            return `
                <div style="display:flex; flex-direction:column; align-items:center; gap:0.25rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid ${teamColor}; 
                        background-image: url('${headshot}'); background-size: cover; background-position: center; background-color: ${teamColor}33;">
                    </div>
                    <span style="font-size: 0.75rem; font-weight: bold; margin-top:4px; padding: 2px 4px; background: rgba(0,0,0,0.5); border-radius: 4px;">${name}</span>
                </div>
            `;
        }

        const card = document.createElement("div");
        card.className = "driver-card";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";
        card.style.height = "100%";

        const dateObj = new Date(race.date_start);
        
        if (podium.every(p => !p)) {
            window.failedDataPool.push({
                 label: `${gpTitle} (Season Grid)`,
                 retry: async () => {
                     try {
                         const API_B = "https://api.openf1.org/v1";
                         const [posRes, drvRes] = await Promise.all([
                             fetch(`${API_B}/position?session_key=${race.session_key}&position%3C%3D3`),
                             fetch(`${API_B}/drivers?session_key=${race.session_key}`)
                         ]);
                         if (!posRes.ok || !drvRes.ok) return false;
                         const drvs = await drvRes.json();
                         drvs.forEach(d => { driversMap[d.driver_number] = d; });
                         const posData = await posRes.json();
                         const latestPositions = { 1: null, 2: null, 3: null };
                         posData.forEach(p => {
                             const pos = p.position;
                             if (pos >= 1 && pos <= 3) {
                                 if (!latestPositions[pos] || new Date(p.date) > new Date(latestPositions[pos].date)) {
                                     latestPositions[pos] = p;
                                 }
                             }
                         });
                         const newPodium = [latestPositions[1], latestPositions[2], latestPositions[3]];
                         if (newPodium.every(p => !p)) return false;
                         round.podium = newPodium;
                         renderSeasonsGrid(data);
                         return true;
                     } catch(e) { return false; }
                 }
            });
            return;
        }

        const podiumContent = `
                <div style="display: flex; justify-content: center; align-items: flex-end; gap: 0.5rem; height: 100px; padding-top: 10px;">
                    <div style="display: flex; flex-direction: column; align-items: center; width: 30%;">
                        ${getDriverUI(podium[1])}
                        <div style="width: 100%; height: 30px; background: silver; color: black; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-top: 0.5rem; border-radius: 4px 4px 0 0;">2</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; width: 35%;">
                        ${getDriverUI(podium[0])}
                        <div style="width: 100%; height: 45px; background: gold; color: black; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-top: 0.5rem; border-radius: 4px 4px 0 0;">1</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; width: 30%;">
                        ${getDriverUI(podium[2])}
                        <div style="width: 100%; height: 20px; background: #cd7f32; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-top: 0.5rem; border-radius: 4px 4px 0 0;">3</div>
                    </div>
                </div>
            `;

        card.innerHTML = `
            <div class="card-header" style="justify-content: center; background: rgba(255,255,255,0.05); padding: 0.5rem; text-align: center; min-height: 3.5rem;">
                <span class="driver-name" style="font-size: 1rem; text-align: center; width: 100%; white-space: normal; line-height: 1.2;">${gpTitle}</span>
            </div>
            <div class="card-body" style="flex: 1; display:flex; flex-direction:column; justify-content:space-between; gap: 1rem;">
                <div style="text-align: center; color: #aaa; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem;">
                    ${dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                ${podiumContent}
            </div>
        `;
        seasonsGrid.appendChild(card);
    });
    window.renderFailedDataPool();
}

(function initLeaderboard() {
    const lbSeasonSelect = document.getElementById('lb-season-select');
    if (!lbSeasonSelect) return;

    const API = 'https://api.openf1.org/v1';
    const FALLBACK_HEADSHOT = 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/fallback/fallback.png.transform/1col/image.png';

    const seasonLabel       = document.getElementById('season-label');
    const tabDrivers        = document.getElementById('tab-drivers');
    const tabConstructors   = document.getElementById('tab-constructors');
    const panelDrivers      = document.getElementById('panel-drivers');
    const panelConstructors = document.getElementById('panel-constructors');

    const dLoading  = document.getElementById('drivers-loading');
    const dError    = document.getElementById('drivers-error');
    const dErrorMsg = document.getElementById('drivers-error-msg');
    const dContent  = document.getElementById('drivers-content');
    const dPodium   = document.getElementById('drivers-podium');
    const dTbody    = document.getElementById('drivers-tbody');

    const cLoading  = document.getElementById('constructors-loading');
    const cError    = document.getElementById('constructors-error');
    const cErrorMsg = document.getElementById('constructors-error-msg');
    const cContent  = document.getElementById('constructors-content');
    const cPodium   = document.getElementById('constructors-podium');
    const cTbody    = document.getElementById('constructors-tbody');

    document.getElementById('drivers-retry-btn').addEventListener('click', loadLeaderboard);
    document.getElementById('constructors-retry-btn').addEventListener('click', loadLeaderboard);

    function switchTab(tab) {
        [tabDrivers, tabConstructors].forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        [panelDrivers, panelConstructors].forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        document.getElementById(tab.getAttribute('aria-controls')).classList.add('active');
    }

    tabDrivers.addEventListener('click', () => switchTab(tabDrivers));
    tabConstructors.addEventListener('click', () => switchTab(tabConstructors));

    function lbShowEl(el) { el.classList.remove('hidden'); }
    function lbHideEl(el) { el.classList.add('hidden'); }

    function setDriverState(state, msg) {
        lbHideEl(dLoading); lbHideEl(dError); lbHideEl(dContent);
        if (state === 'loading') lbShowEl(dLoading);
        else if (state === 'error') { dErrorMsg.textContent = msg || 'Unable to load driver standings.'; lbShowEl(dError); }
        else lbShowEl(dContent);
    }

    function setConstructorState(state, msg) {
        lbHideEl(cLoading); lbHideEl(cError); lbHideEl(cContent);
        if (state === 'loading') lbShowEl(cLoading);
        else if (state === 'error') { cErrorMsg.textContent = msg || 'Unable to load constructor standings.'; lbShowEl(cError); }
        else lbShowEl(cContent);
    }

    function lbTeamColor(hex) { return hex ? `#${hex}` : '#e10600'; }

    function rankClass(i) {
        if (i === 0) return 'top1';
        if (i === 1) return 'top2';
        if (i === 2) return 'top3';
        return '';
    }

    function podiumClass(i) {
        if (i === 0) return 'p1';
        if (i === 1) return 'p2';
        if (i === 2) return 'p3';
        return '';
    }

    async function getLastLbSessionKey(year) {
        const now = new Date();
        const res = await fetch(`${API}/sessions?year=${year}&session_name=Race`);
        if (!res.ok) throw new Error('Could not fetch sessions');
        const sessions = await res.json();
        if (!sessions.length) throw new Error(`No race sessions found for ${year}`);

        const sorted = sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        const completed = sorted.filter(s => new Date(s.date_end || s.date_start) < now);
        return completed.length > 0
            ? completed[completed.length - 1].session_key
            : sorted[0].session_key;
    }

    function renderDriverPodium(drivers) {
        dPodium.innerHTML = '';
        const top3 = drivers.slice(0, 3);
        const order    = [top3[1], top3[0], top3[2]];
        const posLabel = ['2nd', '1st', '3rd'];
        const podumIdx = [1, 0, 2];

        order.forEach((d, i) => {
            if (!d) return;
            const pc       = podiumClass(podumIdx[i]);
            const color    = lbTeamColor(d.team_colour);
            const name     = d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || `#${d.driver_number}`;
            const headshot = d.headshot_url || FALLBACK_HEADSHOT;
            const pts      = d.points_current ?? '—';

            const card = document.createElement('div');
            card.className = `podium-card ${pc}`;
            card.innerHTML = `
                <div class="podium-rank">${posLabel[i]}</div>
                <img class="podium-avatar" src="${headshot}" alt="${name}" style="border-color:${color};">
                <div class="podium-name">${name}</div>
                <div class="podium-sub">${d.team_name || ''}</div>
                <div class="podium-pts">${pts} <span style="font-size:0.7rem;font-family:Inter,sans-serif;font-weight:400;color:#9ca3af;">PTS</span></div>
            `;
            dPodium.appendChild(card);
        });
    }

    function renderDriverTable(drivers) {
        dTbody.innerHTML = '';
        drivers.forEach((d, i) => {
            const color    = lbTeamColor(d.team_colour);
            const name     = d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || `#${d.driver_number}`;
            const headshot = d.headshot_url || FALLBACK_HEADSHOT;
            const pts      = d.points_current ?? '—';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="rank-cell ${rankClass(i)}">${i + 1}</td>
                <td>
                    <div class="driver-row-info">
                        <div class="team-color-bar" style="background:${color};"></div>
                        <img class="driver-thumb" src="${headshot}" alt="${name}" style="border-color:${color};">
                        <div>
                            <div class="driver-row-name">${name}</div>
                            <div class="driver-row-team">${d.name_acronym || ''}</div>
                        </div>
                    </div>
                </td>
                <td style="color:#9ca3af;font-size:0.88rem;">${d.team_name || '—'}</td>
                <td class="pts-cell">${pts}</td>
            `;
            dTbody.appendChild(tr);
        });
    }

    function renderConstructorPodium(teams) {
        cPodium.innerHTML = '';
        const top3 = teams.slice(0, 3);
        const order    = [top3[1], top3[0], top3[2]];
        const posLabel = ['2nd', '1st', '3rd'];
        const podumIdx = [1, 0, 2];

        order.forEach((t, i) => {
            if (!t) return;
            const pc      = podiumClass(podumIdx[i]);
            const color   = lbTeamColor(t.team_colour);
            const initial = (t.team_name || 'T').charAt(0).toUpperCase();
            const pts     = t.points_current ?? '—';

            const card = document.createElement('div');
            card.className = `podium-card ${pc}`;
            card.innerHTML = `
                <div class="podium-rank">${posLabel[i]}</div>
                <div class="podium-team-dot" style="background:${color}33;border-color:${color};">${initial}</div>
                <div class="podium-name">${t.team_name || '—'}</div>
                <div class="podium-pts">${pts} <span style="font-size:0.7rem;font-family:Inter,sans-serif;font-weight:400;color:#9ca3af;">PTS</span></div>
            `;
            cPodium.appendChild(card);
        });
    }

    function renderConstructorTable(teams) {
        cTbody.innerHTML = '';
        teams.forEach((t, i) => {
            const color   = lbTeamColor(t.team_colour);
            const initial = (t.team_name || 'T').charAt(0).toUpperCase();
            const pts     = t.points_current ?? '—';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="rank-cell ${rankClass(i)}">${i + 1}</td>
                <td>
                    <div class="driver-row-info">
                        <div class="team-color-bar" style="background:${color};"></div>
                        <div class="team-thumb" style="background:${color}33;border:2px solid ${color};">${initial}</div>
                        <div class="driver-row-name">${t.team_name || '—'}</div>
                    </div>
                </td>
                <td class="pts-cell">${pts}</td>
            `;
            cTbody.appendChild(tr);
        });
    }

    async function loadLeaderboard() {
        window.failedDataPool = window.failedDataPool.filter(i => !i.label.includes('(Leaderboard)'));
        const year = lbSeasonSelect.value;
        seasonLabel.textContent = `🏆 ${year}`;

        setDriverState('loading');
        setConstructorState('loading');

        let sessionKey;
        try {
            sessionKey = await getLastLbSessionKey(year);
        } catch (err) {
            const msg = `No race data found for ${year}. ${err.message}`;
            setDriverState('error', msg);
            setConstructorState('error', msg);
            return;
        }

        const [dChampRes, cChampRes, driversRes] = await Promise.allSettled([
            fetch(`${API}/championship_drivers?session_key=${sessionKey}`),
            fetch(`${API}/championship_teams?session_key=${sessionKey}`),
            fetch(`${API}/drivers?session_key=${sessionKey}`)
        ]);

        const driverInfoMap = {};
        const teamColorMap  = {};
        if (driversRes.status === 'fulfilled' && driversRes.value.ok) {
            const driversRaw = await driversRes.value.json();
            driversRaw.forEach(d => {
                if (!driverInfoMap[d.driver_number]) driverInfoMap[d.driver_number] = d;
                if (d.team_name && d.team_colour && !teamColorMap[d.team_name]) teamColorMap[d.team_name] = d.team_colour;
            });
        }

        try {
            if (dChampRes.status !== 'fulfilled' || !dChampRes.value.ok) throw new Error('Failed to fetch driver standings');
            const dData = await dChampRes.value.json();
            if (!dData || dData.length === 0) throw new Error('No driver standings data available for this season yet.');

            const enriched = [];
            dData.forEach(entry => {
                const info = driverInfoMap[entry.driver_number];
                if (!info || !info.first_name) {
                    window.failedDataPool.push({
                        label: `Driver #${entry.driver_number} (Leaderboard)`,
                        retry: async () => {
                            try {
                                const r = await fetch(`${API}/drivers?driver_number=${entry.driver_number}`);
                                if (!r.ok) return false;
                                const arr = await r.json();
                                if (!arr || arr.length === 0) return false;
                                driverInfoMap[entry.driver_number] = arr[arr.length - 1];
                                const currentEnriched = [];
                                dData.forEach(e => {
                                    const inf = driverInfoMap[e.driver_number];
                                    if (inf && inf.first_name) currentEnriched.push(Object.assign({}, inf, e));
                                });
                                const sorted = currentEnriched.sort((a, b) => (b.points_current ?? 0) - (a.points_current ?? 0));
                                renderDriverPodium(sorted);
                                renderDriverTable(sorted);
                                return true;
                            } catch(e) { return false; }
                        }
                    });
                } else {
                    enriched.push(Object.assign({}, info, entry));
                }
            });
            const sorted = enriched.sort((a, b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            renderDriverPodium(sorted);
            renderDriverTable(sorted);
            setDriverState('done');
        } catch (err) {
            setDriverState('error', err.message);
        }

        try {
            if (cChampRes.status !== 'fulfilled' || !cChampRes.value.ok) throw new Error('Failed to fetch constructor standings');
            const cData = await cChampRes.value.json();
            if (!cData || cData.length === 0) throw new Error('No constructor standings data available for this season yet.');

            const enriched = [];
            cData.forEach(entry => {
                const colour = teamColorMap[entry.team_name];
                if (!colour) {
                    window.failedDataPool.push({
                         label: `Constructor: ${entry.team_name} (Leaderboard)`,
                         retry: async () => {
                              try {
                                  const r = await fetch(`${API}/drivers?team_name=${encodeURIComponent(entry.team_name)}`);
                                  if (!r.ok) return false;
                                  const arr = await r.json();
                                  if (!arr || arr.length === 0) return false;
                                  // Look for valid team colour in the driver responses
                                  const tColor = arr.find(d => d.team_colour)?.team_colour;
                                  if (!tColor) return false;
                                  teamColorMap[entry.team_name] = tColor;
                                  const currentEnriched = [];
                                  cData.forEach(e => {
                                      const c = teamColorMap[e.team_name];
                                      if (c) currentEnriched.push(Object.assign({}, e, { team_colour: c }));
                                  });
                                  const sorted = currentEnriched.sort((a,b) => (b.points_current ?? 0) - (a.points_current ?? 0));
                                  renderConstructorPodium(sorted);
                                  renderConstructorTable(sorted);
                                  return true;
                              } catch(e) { return false; }
                         }
                    });
                } else {
                    enriched.push(Object.assign({}, entry, { team_colour: colour }));
                }
            });
            const sorted = enriched.sort((a, b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            renderConstructorPodium(sorted);
            renderConstructorTable(sorted);
            setConstructorState('done');
            window.renderFailedDataPool();
        } catch (err) {
            setConstructorState('error', err.message);
        }
    }

    lbSeasonSelect.addEventListener('change', loadLeaderboard);
    loadLeaderboard();
})();

(function initGame() {
    if (!document.getElementById('game-loading')) return;

    const API = 'https://api.openf1.org/v1';
    const GAME_YEAR = 2025; 
    const FALLBACK_IMG = 'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/fallback/fallback.png.transform/1col/image.png';
    const F1_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

    const DRIVER_PRICE = (rank) => rank <= 5 ? 50 : rank <= 10 ? 30 : rank <= 15 ? 20 : 10;
    const TEAM_PRICE   = (rank) => rank <= 3 ? 50 : rank <= 6 ? 30 : 20;

    const gameLoading  = document.getElementById('game-loading');
    const gameError    = document.getElementById('game-error');
    const gameErrorMsg = document.getElementById('game-error-msg');
    const gameDraft    = document.getElementById('game-draft');
    const gameResults  = document.getElementById('game-results');
    const raceBtn      = document.getElementById('race-btn');
    const playAgainBtn = document.getElementById('play-again-btn');

    document.getElementById('game-retry-btn').addEventListener('click', init);
    playAgainBtn.addEventListener('click', resetGame);

    let allDrivers = [];
    let allTeams   = [];
    let raceSessions = [];

    const state = {
        1: { budget: 100, d1: null, d2: null, team: null },
        2: { budget: 100, d1: null, d2: null, team: null }
    };

    function showOnly(el) {
        [gameLoading, gameError, gameDraft, gameResults].forEach(e => e.classList.add('hidden'));
        el.classList.remove('hidden');
    }

    async function init() {
        window.failedDataPool = window.failedDataPool.filter(i => !i.label.includes('(Game Draft)'));
        showOnly(gameLoading);
        try {
            const sessRes = await fetch(`${API}/sessions?year=${GAME_YEAR}&session_name=Race`);
            if (!sessRes.ok) throw new Error('Could not fetch 2025 sessions');
            const sessions = await sessRes.json();
            const now = new Date();
            const sorted = sessions.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
            raceSessions = sorted.filter(s => new Date(s.date_end || s.date_start) < now);
            if (raceSessions.length === 0) throw new Error('No completed races found for 2025.');

            const lastKey = raceSessions[raceSessions.length - 1].session_key;

            const [dChampRes, cChampRes, driversRes] = await Promise.all([
                fetch(`${API}/championship_drivers?session_key=${lastKey}`),
                fetch(`${API}/championship_teams?session_key=${lastKey}`),
                fetch(`${API}/drivers?session_key=${lastKey}`)
            ]);

            if (!dChampRes.ok || !cChampRes.ok || !driversRes.ok)
                throw new Error('Failed to fetch championship data.');

            const [dChamp, cChamp, dInfo] = await Promise.all([
                dChampRes.json(), cChampRes.json(), driversRes.json()
            ]);

            const dInfoMap = {};
            dInfo.forEach(d => { if (!dInfoMap[d.driver_number]) dInfoMap[d.driver_number] = d; });

            const driversSorted = [...dChamp].sort((a, b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            allDrivers = [];
            driversSorted.forEach(entry => {
                const info = dInfoMap[entry.driver_number];
                if (!info || !info.first_name) {
                    window.failedDataPool.push({
                        label: `Driver #${entry.driver_number} (Game Draft)`,
                        retry: async () => {
                            try {
                                const r = await fetch(`${API}/drivers?driver_number=${entry.driver_number}`);
                                if (!r.ok) return false;
                                const arr = await r.json();
                                if (!arr || arr.length === 0) return false;
                                const fetchedInfo = arr[arr.length - 1];
                                dInfoMap[entry.driver_number] = fetchedInfo;
                                allDrivers.push(Object.assign({}, fetchedInfo, entry));
                                allDrivers.sort((a,b) => (b.points_current ?? 0) - (a.points_current ?? 0));
                                allDrivers.forEach((d, i) => { d.rank = i+1; d.price = DRIVER_PRICE(i+1); });
                                buildDraft();
                                return true;
                            } catch(e) { return false; }
                        }
                    });
                } else {
                    allDrivers.push(Object.assign({}, info, entry));
                }
            });
            allDrivers.sort((a,b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            allDrivers.forEach((d, i) => { d.rank = i+1; d.price = DRIVER_PRICE(i+1); });

            const teamColorMap = {};
            allDrivers.forEach(d => { if (d.team_name && d.team_colour) teamColorMap[d.team_name] = d.team_colour; });
            const teamsSorted = [...cChamp].sort((a, b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            allTeams = [];
            teamsSorted.forEach(t => {
                const colour = teamColorMap[t.team_name];
                if (!colour) {
                    window.failedDataPool.push({
                         label: `Constructor: ${t.team_name} (Game Draft)`,
                         retry: async () => {
                              try {
                                  const r = await fetch(`${API}/drivers?team_name=${encodeURIComponent(t.team_name)}`);
                                  if (!r.ok) return false;
                                  const arr = await r.json();
                                  if (!arr || arr.length === 0) return false;
                                  const tColor = arr.find(d => d.team_colour)?.team_colour;
                                  if (!tColor) return false;
                                  teamColorMap[t.team_name] = tColor;
                                  allTeams.push({ ...t, team_colour: tColor });
                                  allTeams.sort((a,b) => (b.points_current ?? 0) - (a.points_current ?? 0));
                                  allTeams.forEach((team, i) => { team.rank = i+1; team.price = TEAM_PRICE(i+1); });
                                  buildDraft();
                                  return true;
                              } catch(e) { return false; }
                         }
                    });
                } else {
                    allTeams.push({ ...t, team_colour: colour });
                }
            });
            allTeams.sort((a,b) => (b.points_current ?? 0) - (a.points_current ?? 0));
            allTeams.forEach((team, i) => { team.rank = i+1; team.price = TEAM_PRICE(i+1); });
            window.renderFailedDataPool();

            buildDraft();
            showOnly(gameDraft);
        } catch (err) {
            gameErrorMsg.textContent = err.message || 'Unknown error.';
            showOnly(gameError);
        }
    }

    function buildDraft() {
        [1, 2].forEach(p => {
            renderRosterDrivers(p);
            renderRosterTeams(p);
            updateSlots(p);
        });

        document.querySelectorAll('.roster-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const player = tab.dataset.player;
                const tabType = tab.dataset.tab;
                document.querySelectorAll(`.roster-tab[data-player="${player}"]`).forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(`p${player}-drivers-list`).classList.toggle('hidden', tabType !== 'drivers');
                document.getElementById(`p${player}-teams-list`).classList.toggle('hidden', tabType !== 'teams');
            });
        });

        raceBtn.addEventListener('click', startRace);
        checkRaceReady();
    }

    function teamColorHex(t) { return t.team_colour ? `#${t.team_colour}` : '#e10600'; }

    function renderRosterDrivers(p) {
        const list = document.getElementById(`p${p}-drivers-list`);
        list.innerHTML = '';
        allDrivers.forEach(d => {
            const el = document.createElement('div');
            el.className = 'roster-item';
            el.dataset.num = d.driver_number;

            const name = d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || `#${d.driver_number}`;
            const color = teamColorHex(d);
            const img = d.headshot_url || FALLBACK_IMG;

            el.innerHTML = `
                <img class="roster-thumb" src="${img}" alt="${name}" style="border-color:${color};">
                <div class="roster-info">
                    <div class="roster-name">${name}</div>
                    <div class="roster-sub">${d.team_name || ''} · #${d.rank}</div>
                </div>
                <span class="roster-price">${d.price} cr</span>
            `;
            el.addEventListener('click', () => pickDriver(p, d, el));
            list.appendChild(el);
        });
    }

    function renderRosterTeams(p) {
        const list = document.getElementById(`p${p}-teams-list`);
        list.innerHTML = '';
        allTeams.forEach(t => {
            const el = document.createElement('div');
            el.className = 'roster-item';
            el.dataset.team = t.team_name;

            const color = teamColorHex(t);
            const initial = (t.team_name || 'T').charAt(0).toUpperCase();

            el.innerHTML = `
                <div class="team-initial-circle" style="background:${color}33;border-color:${color};">${initial}</div>
                <div class="roster-info">
                    <div class="roster-name">${t.team_name}</div>
                    <div class="roster-sub">Rank #${t.rank} · ${t.points_current ?? '?'} pts</div>
                </div>
                <span class="roster-price">${t.price} cr</span>
            `;
            el.addEventListener('click', () => pickTeam(p, t, el));
            list.appendChild(el);
        });
    }

    function pickDriver(p, driver, el) {
        if (el.classList.contains('disabled')) return;
        const ps = state[p];
        const num = driver.driver_number;

        if (ps.d1 && ps.d1.driver_number === num) {
            ps.budget += ps.d1.price;
            ps.d1 = null;
        } else if (ps.d2 && ps.d2.driver_number === num) {
            ps.budget += ps.d2.price;
            ps.d2 = null;
        } else {
            if (!ps.d1) {
                if (ps.budget < driver.price) return;
                ps.d1 = driver;
                ps.budget -= driver.price;
            } else if (!ps.d2) {
                if (ps.budget < driver.price) return;
                ps.d2 = driver;
                ps.budget -= driver.price;
            } else {
                return;
            }
        }

        refreshAllItems();
        updateSlots(p);
        checkRaceReady();
    }

    function pickTeam(p, team, el) {
        if (el.classList.contains('disabled')) return;
        const ps = state[p];

        if (ps.team && ps.team.team_name === team.team_name) {
            ps.budget += ps.team.price;
            ps.team = null;
        } else {
            if (ps.team) {
                ps.budget += ps.team.price;
            }
            if (ps.budget < team.price) {
                if (ps.team) ps.budget -= ps.team.price;
                return;
            }
            ps.budget -= team.price;
            ps.team = team;
        }

        refreshAllItems();
        updateSlots(p);
        checkRaceReady();
    }

    function refreshAllItems() {
        [1, 2].forEach(p => {
            const ps = state[p];
            const myDriverNums = new Set();
            if (ps.d1) myDriverNums.add(ps.d1.driver_number);
            if (ps.d2) myDriverNums.add(ps.d2.driver_number);
            const slotsFullForPlayer = ps.d1 && ps.d2;

            document.querySelectorAll(`#p${p}-drivers-list .roster-item`).forEach(item => {
                const num = Number(item.dataset.num);
                const isMine = myDriverNums.has(num);
                const driver = allDrivers.find(d => d.driver_number === num);
                const cantAfford = !isMine && driver && driver.price > ps.budget;
                const willOverfill = !isMine && slotsFullForPlayer;

                item.classList.toggle('selected', isMine);
                item.classList.toggle('disabled', (!isMine && (cantAfford || willOverfill)));
            });

            document.querySelectorAll(`#p${p}-teams-list .roster-item`).forEach(item => {
                const teamName = item.dataset.team;
                const isMyTeam = ps.team && ps.team.team_name === teamName;
                const team = allTeams.find(t => t.team_name === teamName);
                const effectiveBudget = isMyTeam ? ps.budget + team.price : ps.budget;
                const cantAfford = !isMyTeam && team && team.price > effectiveBudget;

                item.classList.toggle('selected', isMyTeam);
                item.classList.toggle('disabled', !isMyTeam && cantAfford);
            });

            document.getElementById(`p${p}-budget`).textContent = `${ps.budget} cr`;
        });
    }

    function updateSlots(p) {
        const ps = state[p];

        function fillDriverSlot(slotId, driver, onClear) {
            const slot = document.getElementById(slotId);
            if (!driver) {
                slot.classList.remove('filled');
                slot.querySelector('.slot-empty') && null;
                const label = slot.querySelector('.slot-label');
                slot.innerHTML = '';
                slot.appendChild(label);
                const empty = document.createElement('div');
                empty.className = 'slot-empty';
                empty.textContent = 'tap a driver below';
                slot.appendChild(empty);
                return;
            }
            slot.classList.add('filled');
            const label = slot.querySelector('.slot-label');
            const name = driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || `#${driver.driver_number}`;
            const color = teamColorHex(driver);
            slot.innerHTML = '';
            slot.appendChild(label);
            const info = document.createElement('div');
            info.className = 'slot-filled-info';
            info.innerHTML = `
                <img class="slot-thumb" src="${driver.headshot_url || FALLBACK_IMG}" style="border-color:${color};" alt="${name}">
                <span class="slot-name">${name}</span>
                <span class="slot-price">${driver.price} cr</span>
                <button class="slot-remove" title="Remove">✕</button>
            `;
            info.querySelector('.slot-remove').addEventListener('click', (e) => { e.stopPropagation(); onClear(); });
            slot.appendChild(info);
        }

        function fillTeamSlot(slotId, team, onClear) {
            const slot = document.getElementById(slotId);
            if (!team) {
                const label = slot.querySelector('.slot-label');
                slot.classList.remove('filled');
                slot.innerHTML = '';
                slot.appendChild(label);
                const empty = document.createElement('div');
                empty.className = 'slot-empty';
                empty.textContent = 'tap a team below';
                slot.appendChild(empty);
                return;
            }
            slot.classList.add('filled');
            const label = slot.querySelector('.slot-label');
            const color = teamColorHex(team);
            const initial = (team.team_name || 'T').charAt(0).toUpperCase();
            slot.innerHTML = '';
            slot.appendChild(label);
            const info = document.createElement('div');
            info.className = 'slot-filled-info';
            info.innerHTML = `
                <div style="width:32px;height:32px;border-radius:50%;background:${color}33;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-weight:900;font-size:0.9rem;color:#fff;flex-shrink:0;">${initial}</div>
                <span class="slot-name">${team.team_name}</span>
                <span class="slot-price">${team.price} cr</span>
                <button class="slot-remove" title="Remove">✕</button>
            `;
            info.querySelector('.slot-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                onClear();
            });
            slot.appendChild(info);
        }

        fillDriverSlot(`p${p}-d1-slot`, ps.d1, () => { ps.budget += ps.d1.price; ps.d1 = null; refreshAllItems(); updateSlots(p); checkRaceReady(); });
        fillDriverSlot(`p${p}-d2-slot`, ps.d2, () => { ps.budget += ps.d2.price; ps.d2 = null; refreshAllItems(); updateSlots(p); checkRaceReady(); });
        fillTeamSlot(`p${p}-t1-slot`, ps.team, () => { ps.budget += ps.team.price; ps.team = null; refreshAllItems(); updateSlots(p); checkRaceReady(); });
    }

    function checkRaceReady() {
        const ready = [1, 2].every(p => state[p].d1 && state[p].d2 && state[p].team);
        raceBtn.disabled = !ready;
    }
    async function startRace() {
        showOnly(gameResults);
        document.getElementById('results-loading').classList.remove('hidden');
        document.getElementById('results-content').classList.add('hidden');

        const loadingMsg = document.getElementById('results-loading-msg');
        loadingMsg.textContent = 'Picking a random Grand Prix…';

        try {
            const randomSession = raceSessions[Math.floor(Math.random() * raceSessions.length)];
            const gpName = randomSession.location || randomSession.country_name || 'Unknown GP';
            document.getElementById('results-gp-name').textContent = `🏁 ${gpName} Grand Prix · ${GAME_YEAR}`;

            loadingMsg.textContent = `Fetching results from ${gpName}…`;

            const [resultRes, driverRes] = await Promise.all([
                fetch(`${API}/session_result?session_key=${randomSession.session_key}`),
                fetch(`${API}/drivers?session_key=${randomSession.session_key}`)
            ]);

            if (!resultRes.ok) throw new Error('Failed to fetch race results');
            const [results, sessionDrivers] = await Promise.all([resultRes.json(), driverRes.json()]);

            const posMap = {};
            results.forEach(r => { posMap[r.driver_number] = r.position; });

            const raceDriverMap = {};
            sessionDrivers.forEach(d => { if (!raceDriverMap[d.driver_number]) raceDriverMap[d.driver_number] = d; });

            const posToPoints = (num) => {
                const pos = posMap[num];
                if (!pos || pos < 1 || pos > 10) return 0;
                return F1_POINTS[pos - 1];
            };

            const teamPointsInRace = (teamName) => {
                return sessionDrivers
                    .filter(d => d.team_name === teamName)
                    .reduce((sum, d) => sum + posToPoints(d.driver_number), 0);
            };

            const scores = {};
            [1, 2].forEach(p => {
                const ps = state[p];
                const d1pts  = posToPoints(ps.d1.driver_number);
                const d2pts  = posToPoints(ps.d2.driver_number);
                const tpts   = teamPointsInRace(ps.team.team_name);
                const total  = d1pts * 0.5 + d2pts * 0.2 + tpts * 0.3;
                scores[p] = { d1pts, d2pts, tpts, total };
            });

            renderResults(scores, gpName, posMap, raceDriverMap);

        } catch (err) {
            document.getElementById('results-loading').classList.add('hidden');
            document.getElementById('results-content').classList.remove('hidden');
            document.getElementById('winner-banner').innerHTML = `<div class="winner-title">Error</div><div class="winner-name" style="font-size:1rem;color:#9ca3af;">${err.message}</div>`;
            document.getElementById('winner-banner').className = 'winner-banner w-draw';
            document.getElementById('race-breakdown').innerHTML = '';
            document.getElementById('result-p1').innerHTML = '';
            document.getElementById('result-p2').innerHTML = '';
        }
    }

    function renderResults(scores, gpName, posMap, raceDriverMap) {
        document.getElementById('results-loading').classList.add('hidden');
        document.getElementById('results-content').classList.remove('hidden');

        const s1 = scores[1].total, s2 = scores[2].total;
        const banner = document.getElementById('winner-banner');

        if (s1 > s2) {
            banner.className = 'winner-banner w-p1';
            banner.innerHTML = `<div class="winner-title">🏆 Winner</div><div class="winner-name">Player 1</div>`;
        } else if (s2 > s1) {
            banner.className = 'winner-banner w-p2';
            banner.innerHTML = `<div class="winner-title">🏆 Winner</div><div class="winner-name">Player 2</div>`;
        } else {
            banner.className = 'winner-banner w-draw';
            banner.innerHTML = `<div class="winner-title">It's a tie!</div><div class="winner-name">DRAW</div>`;
        }

        [1, 2].forEach(p => {
            const ps = state[p];
            const sc = scores[p];
            const card = document.getElementById(`result-p${p}`);
            const isWinner = (p === 1 && s1 > s2) || (p === 2 && s2 > s1);
            card.className = `result-card${isWinner ? ' winner-card' : ''}`;

            const badgeClass = p === 1 ? 'p1-badge' : 'p2-badge';
            const scoreColor = p === 1 ? '#e10600' : '#3671c6';

            const d1name = ps.d1.full_name || `#${ps.d1.driver_number}`;
            const d2name = ps.d2.full_name || `#${ps.d2.driver_number}`;
            const d1color = teamColorHex(ps.d1);
            const d2color = teamColorHex(ps.d2);
            const tcolor  = teamColorHex(ps.team);
            const tInitial = (ps.team.team_name || 'T').charAt(0);

            const d1pos = posMap[ps.d1.driver_number] || 'NC';
            const d2pos = posMap[ps.d2.driver_number] || 'NC';

            card.innerHTML = `
                <div class="result-player-header">
                    <span class="player-badge ${badgeClass}">P${p}</span>
                    <span style="font-weight:600;">Player ${p}</span>
                    <span class="result-score" style="color:${scoreColor};">${sc.total.toFixed(1)}</span>
                </div>
                <div class="result-pick-row">
                    <span class="result-pick-label">Driver 1 ×0.5</span>
                    <img class="result-pick-thumb" src="${ps.d1.headshot_url || FALLBACK_IMG}" style="border-color:${d1color};" alt="${d1name}">
                    <span class="result-pick-name">${d1name}</span>
                    <span class="result-pick-pts">P${d1pos} · ${sc.d1pts}pts</span>
                    <span class="result-pick-contrib">+${(sc.d1pts * 0.5).toFixed(1)}</span>
                </div>
                <div class="result-pick-row">
                    <span class="result-pick-label">Driver 2 ×0.2</span>
                    <img class="result-pick-thumb" src="${ps.d2.headshot_url || FALLBACK_IMG}" style="border-color:${d2color};" alt="${d2name}">
                    <span class="result-pick-name">${d2name}</span>
                    <span class="result-pick-pts">P${d2pos} · ${sc.d2pts}pts</span>
                    <span class="result-pick-contrib">+${(sc.d2pts * 0.2).toFixed(1)}</span>
                </div>
                <div class="result-pick-row">
                    <span class="result-pick-label">Team ×0.3</span>
                    <div class="result-pick-thumb" style="background:${tcolor}33;border:2px solid ${tcolor};display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;">${tInitial}</div>
                    <span class="result-pick-name">${ps.team.team_name}</span>
                    <span class="result-pick-pts">${sc.tpts}pts</span>
                    <span class="result-pick-contrib">+${(sc.tpts * 0.3).toFixed(1)}</span>
                </div>
            `;
        });

        const bd = document.getElementById('race-breakdown');
        bd.innerHTML = `
            <h3>Scoring Formula</h3>
            <p style="color:#9ca3af;font-size:0.85rem;line-height:1.7;">
                <strong style="color:#f4f4f5;">Driver 1 pts × 0.5</strong> + 
                <strong style="color:#f4f4f5;">Driver 2 pts × 0.2</strong> + 
                <strong style="color:#f4f4f5;">Constructor pts × 0.3</strong><br>
                Constructor points = sum of F1 race points earned by both team drivers in this Grand Prix.
            </p>
        `;
    }

    function resetGame() {
        state[1] = { budget: 100, d1: null, d2: null, team: null };
        state[2] = { budget: 100, d1: null, d2: null, team: null };

        [1, 2].forEach(p => {
            updateSlots(p);
            document.querySelectorAll(`.roster-tab[data-player="${p}"]`).forEach((t, i) => {
                t.classList.toggle('active', i === 0);
            });
            document.getElementById(`p${p}-drivers-list`).classList.remove('hidden');
            document.getElementById(`p${p}-teams-list`).classList.add('hidden');
        });

        refreshAllItems();
        checkRaceReady();
        showOnly(gameDraft);
    }

    init();
})();
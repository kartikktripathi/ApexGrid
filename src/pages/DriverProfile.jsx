import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { f1Api } from "../utils/api";
import { jolpicaApi } from "../utils/jolpicaApi";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import CustomDropdown from "../components/ui/CustomDropdown";

const getDriverSlug = (first, last, fullName) => {
  const f = first || "";
  const l = last || "";
  const name = l ? `${f}_${l}` : fullName || "";
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export default function DriverProfile() {
  const { driverSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialDriver = location.state?.driver;

  // Seasons list
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  // Loading and Error States
  const [loadingProfile, setLoadingProfile] = useState(() => !initialDriver);
  const [error, setError] = useState(null);
  const [loadingSeasonData, setLoadingSeasonData] = useState(true);

  // Driver details & stats
  const [driverInfo, setDriverInfo] = useState(() => initialDriver || null);
  const currentDriverInfo = driverInfo || initialDriver;
  const [careerStats, setCareerStats] = useState(null);
  const [constructorTimeline, setConstructorTimeline] = useState(null);

  // Season timing & positions data (OpenF1)
  const [sessions, setSessions] = useState([]);
  const [qualSessions, setQualSessions] = useState([]);
  const [positions, setPositions] = useState([]);

  // Fetch static/career data once per driverSlug
  useEffect(() => {
    // Reset all states for new driver slug to avoid UI bleed/previous driver data showing
    setDriverInfo(initialDriver || null);
    setLoadingProfile(!initialDriver);
    setError(null);
    setAvailableSeasons([]);
    setSelectedYear(null);
    setCareerStats(null);
    setConstructorTimeline(null);
    setSessions([]);
    setQualSessions([]);
    setPositions([]);
    setLoadingSeasonData(true);

    let isMounted = true;
    let bioTimerId = null;
    let careerTimerId = null;

    const loadDriverBio = async () => {
      try {
        // 1. Get driver details from OpenF1
        // Try latest session first, fallback to all drivers search
        let driverData = await f1Api.getDrivers("latest");
        let currentDriver = driverData.find(
          (d) =>
            getDriverSlug(d.first_name, d.last_name, d.full_name) ===
            driverSlug,
        );

        if (!currentDriver) {
          // Fetch from the root drivers endpoint if they aren't in the active session
          const response = await fetch(`https://api.openf1.org/v1/drivers`);
          if (response.ok) {
            const list = await response.json();
            const matches = list.filter(
              (d) =>
                getDriverSlug(d.first_name, d.last_name, d.full_name) ===
                driverSlug,
            );
            if (matches.length > 0) {
              currentDriver = matches[matches.length - 1]; // Pick latest session record
            }
          }
        }

        if (!currentDriver) {
          throw new Error("Driver not found in F1 database.");
        }

        if (!isMounted) return;
        setDriverInfo(currentDriver);
        setLoadingProfile(false); // Load page structure immediately!

        // 2. Load career and timeline asynchronously in background
        loadCareerAndTimeline(currentDriver);
      } catch (err) {
        console.error("Failed to load driver bio data", err);
        if (isMounted) {
          bioTimerId = setTimeout(loadDriverBio, 10000);
        }
      }
    };

    const loadCareerAndTimeline = async (currentDriver) => {
      try {
        if (isMounted) {
          setCareerStats(null);
          setConstructorTimeline(null);
        }

        const driverId = await jolpicaApi.getDriverId(
          currentDriver.first_name,
          currentDriver.last_name,
          currentDriver.name_acronym,
          currentDriver.driver_number,
        );

        jolpicaApi
          .getDriverSeasons(driverId)
          .then((allSeasons) => {
            if (!isMounted) return;
            const supported = allSeasons.filter((y) =>
              [2026, 2025, 2024, 2023].includes(y),
            );
            if (supported.length > 0) {
              setAvailableSeasons(supported);
              setSelectedYear(supported[0]);
            } else {
              setAvailableSeasons([2026, 2025, 2024, 2023]);
              setSelectedYear(2026);
            }
          })
          .catch((err) => {
            console.error("Failed to load driver seasons", err);
            if (!isMounted) return;
            setAvailableSeasons([2026, 2025, 2024, 2023]);
            setSelectedYear(2026);
          });

        const [stats, timeline] = await Promise.all([
          jolpicaApi.getCareerStats(driverId),
          jolpicaApi.getConstructorTimeline(driverId),
        ]);

        if (!isMounted) return;
        setCareerStats(stats);
        setConstructorTimeline(timeline);
      } catch (err) {
        console.error("Failed to load career/timeline stats", err);
        if (isMounted) {
          careerTimerId = setTimeout(
            () => loadCareerAndTimeline(currentDriver),
            10000,
          );
        }
      }
    };

    loadDriverBio();
    return () => {
      isMounted = false;
      if (bioTimerId) clearTimeout(bioTimerId);
      if (careerTimerId) clearTimeout(careerTimerId);
    };
  }, [driverSlug]);

  // Fetch OpenF1 season positions when selectedYear changes
  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchSeasonDetails = async () => {
      if (!currentDriverInfo || !selectedYear) return; // Wait until basic driver info and selectedYear are loaded
      if (isMounted) setLoadingSeasonData(true);
      try {
        const [raceData, qualData] = await Promise.all([
          f1Api.getSessions(selectedYear, "Race"),
          f1Api.getSessions(selectedYear, "Qualifying"),
        ]);

        let seasonDriverNumber = null;
        let successfulFetches = 0;

        if (raceData && raceData.length > 0) {
          // Sort race sessions chronologically (ascending)
          const sortedRaces = [...raceData].sort(
            (a, b) => new Date(a.date_start) - new Date(b.date_start),
          );

          // Find the first chronological session that has driver records populated
          for (const race of sortedRaces) {
            try {
              const res = await fetch(
                `https://api.openf1.org/v1/drivers?session_key=${race.session_key}`,
              );
              if (!res.ok) {
                throw new Error(`OpenF1 Driver API error: ${res.status}`);
              }
              const list = await res.json();
              successfulFetches++;

              if (list && list.length > 0) {
                const match = list.find(
                  (d) =>
                    getDriverSlug(d.first_name, d.last_name, d.full_name) ===
                    driverSlug,
                );
                if (match) {
                  seasonDriverNumber = match.driver_number;
                  break; // Found their number! Exit chronological search
                }
              }
            } catch (err) {
              console.warn(
                `Could not resolve driver number in session ${race.session_key}`,
                err,
              );
            }
          }
        }

        // If we were unable to successfully query ANY session due to network/server errors,
        // we throw an error to trigger the 10-second retry loop and keep the loading skeleton active!
        if (raceData && raceData.length > 0 && successfulFetches === 0) {
          throw new Error("Unable to fetch driver lists for any sessions.");
        }

        // If the driver did not participate in this season, we set sessions and positions to empty
        if (!seasonDriverNumber) {
          if (!isMounted) return;
          setSessions([]);
          setQualSessions([]);
          setPositions([]);
          setLoadingSeasonData(false);
          return;
        }

        // Fetch standings with the resolved season-specific driver number!
        const res = await fetch(
          `https://api.openf1.org/v1/session_result?driver_number=${seasonDriverNumber}`,
        );
        if (!res.ok) {
          throw new Error(`OpenF1 session_result API error: ${res.status}`);
        }
        const positionData = await res.json();

        // Validate that we got results if there are past races
        const hasPastRaces =
          raceData &&
          raceData.some((race) => new Date(race.date_start) < new Date());
        if (
          hasPastRaces &&
          (!Array.isArray(positionData) || positionData.length === 0)
        ) {
          throw new Error(
            "No session results returned by OpenF1 API, even though past races exist.",
          );
        }

        if (!isMounted) return;
        setSessions(raceData || []);
        setQualSessions(qualData || []);
        setPositions(Array.isArray(positionData) ? positionData : []);
        setLoadingSeasonData(false);
      } catch (e) {
        console.error("Failed to fetch OpenF1 season details:", e);
        if (isMounted) {
          timerId = setTimeout(fetchSeasonDetails, 10000);
        }
      }
    };

    fetchSeasonDetails();
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [driverSlug, selectedYear, currentDriverInfo]);

  // Processes race & qualifying stats for the selected year
  const seasonStats = useMemo(() => {
    if (!sessions.length || !positions.length) {
      return { races: [], totalPoles: 0, totalWins: 0, totalPoints: 0 };
    }

    const POINTS_MAP = {
      1: 25,
      2: 18,
      3: 15,
      4: 12,
      5: 10,
      6: 8,
      7: 6,
      8: 4,
      9: 2,
      10: 1,
    };
    let totalPoles = 0;
    let totalWins = 0;
    let totalPoints = 0;

    // Filter and sort race sessions chronologically
    const sortedRaces = [...sessions]
      .filter((s) => s.year === selectedYear)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    const processedRaces = sortedRaces.map((race, idx) => {
      // 1. Race positions
      const raceResult = positions.find(
        (p) => p.session_key === race.session_key,
      );
      const finishPos = raceResult ? raceResult.position : null;

      // 2. Qualifying session matching
      const qualSession = qualSessions.find(
        (q) => q.meeting_key === race.meeting_key,
      );
      const qualResult = qualSession
        ? positions.find((p) => p.session_key === qualSession.session_key)
        : null;
      const qualPos = qualResult ? qualResult.position : null;

      // Aggregates
      if (qualPos === 1) totalPoles++;
      if (finishPos === 1) totalWins++;

      const pointsScored = raceResult
        ? typeof raceResult.points === "number"
          ? raceResult.points
          : POINTS_MAP[finishPos] || 0
        : 0;
      totalPoints += pointsScored;

      return {
        round: idx + 1,
        circuit: race.circuit_short_name || race.location,
        location: race.location,
        country: race.country_name,
        finishPosition: finishPos,
        qualifyingPosition: qualPos,
        isPole: qualPos === 1,
        isWin: finishPos === 1,
        points: pointsScored,
      };
    });

    return {
      races: processedRaces,
      totalPoles,
      totalWins,
      totalPoints,
    };
  }, [sessions, qualSessions, positions, selectedYear]);

  // Graph state for hover tooltip
  const [hoveredRoundIdx, setHoveredRoundIdx] = useState(null);

  // Timeline scroll progress ref
  const timelineRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start center", "end center"],
  });
  const scaleY = useTransform(scrollYProgress, [0, 0.7], [0, 1]);

  if (!currentDriverInfo && loadingProfile) {
    return <LoadingState message={`Opening driver profile ${driverSlug}...`} />;
  }

  if (error || (!currentDriverInfo && !loadingProfile)) {
    return (
      <ErrorState
        message={error || "Driver profile not found."}
        onRetry={() => navigate("/drivers")}
      />
    );
  }

  const teamColor = currentDriverInfo.team_colour
    ? `#${currentDriverInfo.team_colour}`
    : "#e10600";
  const driverFullName =
    currentDriverInfo.full_name ||
    `${currentDriverInfo.first_name || ""} ${currentDriverInfo.last_name || ""}`.trim();

  // Rendering parameters for custom SVG graph
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 60;
  const chartHeight = 350;
  const chartWidth = 900;

  const yPosScale = (pos) => {
    if (!pos || pos > 20) return chartHeight - paddingBottom;
    // Map P1 (top) to P20 (bottom)
    const availableHeight = chartHeight - paddingTop - paddingBottom;
    return paddingTop + ((pos - 1) / 19) * availableHeight;
  };

  const xRoundScale = (idx, total) => {
    if (total <= 1)
      return paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2;
    const availableWidth = chartWidth - paddingLeft - paddingRight;
    return paddingLeft + (idx / (total - 1)) * availableWidth;
  };

  return (
    <div
      style={{
        background: "var(--color-bg-base)",
        minHeight: "100vh",
        paddingBottom: "10vw",
      }}
    >
      {/* 1. HERO HEADER */}
      <section
        style={{
          position: "relative",
          padding: "12vw 5vw 6vw 5vw",
          overflow: "hidden",
          borderBottom: "1px solid var(--color-border)",
          background:
            "radial-gradient(circle at 10% 20%, rgba(20,20,20,0.8) 0%, var(--color-bg-base) 90%)",
        }}
      >
        {/* Ambient Glow */}
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "10%",
            width: "400px",
            height: "400px",
            background: teamColor,
            filter: "blur(160px)",
            opacity: 0.15,
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* Back Button */}
        <button
          onClick={() => navigate("/drivers")}
          style={{
            position: "absolute",
            top: "8vw",
            left: "5vw",
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--color-text-secondary)",
            fontSize: "0.9rem",
            letterSpacing: "0.1em",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
          className="btn"
        >
          <span>← Back to Grid</span>
        </button>

        {/* Huge Background Number */}
        <div
          style={{
            position: "absolute",
            bottom: "-15%",
            right: "5%",
            fontSize: "clamp(10rem, 30vw, 36rem)",
            fontFamily: "var(--font-heading)",
            fontWeight: 900,
            color: "rgba(255, 255, 255, 0.02)",
            zIndex: 1,
            userSelect: "none",
            lineHeight: 0.8,
          }}
        >
          {currentDriverInfo.driver_number}
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            gap: "2.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* Team accent vertical bar (replacing the photo) */}
          <div
            style={{
              width: "8px",
              height: "140px",
              borderRadius: "var(--radius-sm)",
              background: `linear-gradient(to bottom, ${teamColor}, ${teamColor}44)`,
              boxShadow: `0 0 30px ${teamColor}66`,
              display: "block",
            }}
          />

          {/* Driver Title Details */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              flex: 1,
              minWidth: "300px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  color: teamColor,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                {currentDriverInfo.team_name}
              </span>
              <div
                style={{
                  width: "40px",
                  height: "1px",
                  background: "var(--color-border)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.2rem",
                  color: "var(--color-text-muted)",
                  letterSpacing: "0.1em",
                }}
              >
                NO. {currentDriverInfo.driver_number}
              </span>
            </div>

            <h1
              style={{
                fontSize: "clamp(3rem, 6vw, 5.5rem)",
                lineHeight: 0.9,
                margin: 0,
                fontFamily: "var(--font-heading)",
              }}
            >
              {currentDriverInfo.first_name && (
                <span
                  style={{
                    display: "block",
                    fontWeight: 300,
                    fontSize: "0.45em",
                    color: "var(--color-text-secondary)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {currentDriverInfo.first_name}
                </span>
              )}
              <span style={{ fontWeight: 800 }}>
                {currentDriverInfo.last_name
                  ? currentDriverInfo.last_name
                  : driverFullName}
              </span>
            </h1>

            {currentDriverInfo.country_code && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  marginTop: "0.5rem",
                }}
              >
                <span
                  style={{
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    padding: "0.4rem 0.8rem",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    fontFamily: "var(--font-heading)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {currentDriverInfo.country_code}
                </span>
                <span
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.9rem",
                  }}
                >
                  Nationality
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. CURRENT SEASON WRAPPER */}
      <section style={{ padding: "6vw 5vw" }}>
        {/* Section Header with drop-down */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "2rem",
            marginBottom: "4rem",
          }}
        >
          <div>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-accent-primary)",
                fontSize: "0.9rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Season Analytics
            </span>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                margin: "0.5rem 0 0 0",
                fontFamily: "var(--font-heading)",
              }}
            >
              PERFORMANCE{" "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                TRACKER
              </span>
            </h2>
          </div>

          {availableSeasons.length > 0 && selectedYear ? (
            <CustomDropdown
              value={selectedYear}
              onChange={(val) => setSelectedYear(val)}
              options={availableSeasons.map((y) => ({
                value: y,
                label: `${y} SEASON`,
              }))}
            />
          ) : (
            <div
              className="skeleton-pulse"
              style={{
                width: "160px",
                height: "42px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "var(--radius-sm)",
              }}
            />
          )}
        </div>

        {/* Season Statistics Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "2rem",
            marginBottom: "5rem",
          }}
        >
          {[
            {
              label: "Poles",
              value: seasonStats.totalPoles,
              desc: "Qualified P1",
            },
            {
              label: "Wins",
              value: seasonStats.totalWins,
              desc: "Race victories",
            },
            {
              label: "Points Scored",
              value: seasonStats.totalPoints,
              desc: "Estimated season points",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-panel"
              style={{
                padding: "2rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                background: "var(--color-bg-panel)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "24px",
                  background: teamColor,
                  position: "absolute",
                  left: 0,
                  top: "2rem",
                }}
              />
              <span
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: "0.85rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontWeight: 600,
                }}
              >
                {stat.label}
              </span>
              {loadingSeasonData ? (
                <div
                  className="skeleton-pulse"
                  style={{
                    height: "3rem",
                    width: "80px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "var(--radius-sm)",
                    margin: "0.5rem 0",
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: "3rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                    color: "#fff",
                    lineHeight: 1,
                    margin: "0.5rem 0",
                  }}
                >
                  {stat.value}
                </span>
              )}
              <span
                style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}
              >
                {loadingSeasonData ? "Retrieving data..." : stat.desc}
              </span>
            </motion.div>
          ))}
        </div>

        {/* 3. LINEAR POSITION GRAPH */}
        {loadingSeasonData ? (
          <div
            className="glass-panel skeleton-pulse"
            style={{
              height: `${chartHeight}px`,
              background: "var(--color-bg-panel)",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justify: "center",
            }}
          >
            <p
              style={{
                color: "var(--color-text-secondary)",
                fontFamily: "var(--font-heading)",
                fontSize: "1.1rem",
                letterSpacing: "0.1em",
              }}
            >
              Loading telemetry position data...
            </p>
          </div>
        ) : seasonStats.races.length === 0 ? (
          <div
            className="state-container"
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <p
              className="text-muted"
              style={{ fontSize: "1.1rem", fontFamily: "var(--font-heading)" }}
            >
              No telemetry position data available for {selectedYear}.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-panel"
            style={{
              padding: "3rem 2rem",
              background: "var(--color-bg-panel)",
              borderRadius: "var(--radius-lg)",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "1rem",
                marginBottom: "2.5rem",
                paddingBottom: "1.5rem",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.5rem",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Race vs. Qualifying{" "}
                  <span style={{ color: "var(--color-text-secondary)" }}>
                    Positions
                  </span>
                </h3>
                <p
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: "0.85rem",
                    margin: "0.3rem 0 0 0",
                  }}
                >
                  Track finishing positions (solid) overlaying qualifying grids
                  (dashed)
                </p>
              </div>

              {/* Legend */}
              <div
                style={{ display: "flex", gap: "2rem", alignItems: "center" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "3px",
                      background: teamColor,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--color-text-secondary)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Race Finish
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      width: "20px",
                      height: "3px",
                      borderTop: "2px dashed rgba(255,255,255,0.4)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--color-text-secondary)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    Qualifying Grid
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Responsive SVG Chart */}
            <div
              style={{
                width: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <div style={{ minWidth: "850px", position: "relative" }}>
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  width="100%"
                  height={chartHeight}
                  style={{ overflow: "visible" }}
                >
                  <defs>
                    {/* Shadow Glow filter for the primary line */}
                    <filter
                      id="shadowGlow"
                      x="-10%"
                      y="-10%"
                      width="120%"
                      height="120%"
                    >
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feComponentTransfer in="blur" result="glow">
                        <feFuncA type="linear" slope="0.35" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <linearGradient
                      id="lineGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop offset="0%" stopColor={teamColor} />
                      <stop offset="100%" stopColor={`${teamColor}aa`} />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[1, 5, 10, 15, 20].map((pos) => {
                    const y = yPosScale(pos);
                    return (
                      <g key={pos}>
                        <line
                          x1={paddingLeft}
                          y1={y}
                          x2={chartWidth - paddingRight}
                          y2={y}
                          stroke="rgba(255,255,255,0.04)"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 15}
                          y={y + 5}
                          fill="var(--color-text-muted)"
                          fontSize="11"
                          textAnchor="end"
                          fontFamily="var(--font-heading)"
                        >
                          P{pos}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertical Round Guide Columns */}
                  {seasonStats.races.map((race, idx) => {
                    const x = xRoundScale(idx, seasonStats.races.length);
                    return (
                      <g key={race.round}>
                        <line
                          x1={x}
                          y1={paddingTop}
                          x2={x}
                          y2={chartHeight - paddingBottom}
                          stroke={
                            hoveredRoundIdx === idx
                              ? "rgba(255,255,255,0.06)"
                              : "transparent"
                          }
                          strokeWidth={hoveredRoundIdx === idx ? "24" : "1"}
                          strokeLinecap="round"
                        />
                        <text
                          x={x}
                          y={chartHeight - paddingBottom + 25}
                          fill={
                            hoveredRoundIdx === idx
                              ? "var(--color-accent-primary)"
                              : "var(--color-text-muted)"
                          }
                          fontSize="11"
                          textAnchor="middle"
                          fontFamily="var(--font-heading)"
                          fontWeight={hoveredRoundIdx === idx ? 600 : 400}
                        >
                          R{race.round}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Qualifying Path (Dashed Line) */}
                  {(() => {
                    const points = seasonStats.races
                      .map((race, idx) => {
                        if (!race.qualifyingPosition) return null;
                        const x = xRoundScale(idx, seasonStats.races.length);
                        const y = yPosScale(race.qualifyingPosition);
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(" ");

                    return points ? (
                      <polyline
                        fill="none"
                        stroke="rgba(255,255,255,0.22)"
                        strokeWidth="2"
                        strokeDasharray="6,5"
                        points={points}
                      />
                    ) : null;
                  })()}

                  {/* Render Race Finish Path (Solid Glowing Line) */}
                  {(() => {
                    const points = seasonStats.races
                      .map((race, idx) => {
                        if (!race.finishPosition) return null;
                        const x = xRoundScale(idx, seasonStats.races.length);
                        const y = yPosScale(race.finishPosition);
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(" ");

                    return points ? (
                      <polyline
                        fill="none"
                        stroke="url(#lineGrad)"
                        strokeWidth="3.5"
                        points={points}
                        filter="url(#shadowGlow)"
                      />
                    ) : null;
                  })()}

                  {/* Render Node Dots */}
                  {seasonStats.races.map((race, idx) => {
                    const x = xRoundScale(idx, seasonStats.races.length);
                    const yFinish = race.finishPosition
                      ? yPosScale(race.finishPosition)
                      : null;
                    const yQual = race.qualifyingPosition
                      ? yPosScale(race.qualifyingPosition)
                      : null;
                    const isHovered = hoveredRoundIdx === idx;

                    return (
                      <g key={idx}>
                        {/* Qual Dot */}
                        {yQual && (
                          <circle
                            cx={x}
                            cy={yQual}
                            r={isHovered ? "5" : "3.5"}
                            fill="var(--color-bg-base)"
                            stroke="rgba(255,255,255,0.4)"
                            strokeWidth="1.5"
                            style={{ transition: "all 0.2s" }}
                          />
                        )}
                        {/* Finish Dot */}
                        {yFinish && (
                          <g>
                            {isHovered && (
                              <circle
                                cx={x}
                                cy={yFinish}
                                r="9"
                                fill={teamColor}
                                opacity="0.3"
                              />
                            )}
                            <circle
                              cx={x}
                              cy={yFinish}
                              r={isHovered ? "6" : "4.5"}
                              fill={teamColor}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              style={{ transition: "all 0.2s" }}
                            />
                          </g>
                        )}

                        {/* Interactive Invisible Hover Recs */}
                        <rect
                          x={x - 15}
                          y={paddingTop}
                          width={30}
                          height={chartHeight - paddingTop - paddingBottom}
                          fill="transparent"
                          cursor="pointer"
                          onMouseEnter={() => setHoveredRoundIdx(idx)}
                          onMouseLeave={() => setHoveredRoundIdx(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Graph Tooltip Box */}
                {hoveredRoundIdx !== null &&
                  seasonStats.races[hoveredRoundIdx] && (
                    <div
                      style={{
                        position: "absolute",
                        top: "20px",
                        left: `${xRoundScale(hoveredRoundIdx, seasonStats.races.length) + (hoveredRoundIdx > seasonStats.races.length / 2 ? -260 : 30)}px`,
                        width: "230px",
                        background: "rgba(10, 10, 10, 0.95)",
                        border: `1px solid ${teamColor}55`,
                        borderRadius: "var(--radius-md)",
                        padding: "1.2rem",
                        boxShadow: "var(--shadow-panel)",
                        backdropFilter: "blur(10px)",
                        zIndex: 100,
                        pointerEvents: "none",
                        transition: "left 0.2s ease-out",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--color-accent-primary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.15em",
                          fontWeight: 600,
                          display: "block",
                          marginBottom: "0.4rem",
                        }}
                      >
                        Round {seasonStats.races[hoveredRoundIdx].round}
                      </span>
                      <h4
                        style={{
                          fontSize: "1.1rem",
                          margin: "0 0 0.2rem 0",
                          fontFamily: "var(--font-heading)",
                          color: "#fff",
                          textTransform: "uppercase",
                        }}
                      >
                        {seasonStats.races[hoveredRoundIdx].circuit}
                      </h4>
                      <p
                        style={{
                          color: "var(--color-text-muted)",
                          fontSize: "0.8rem",
                          margin: "0 0 1rem 0",
                        }}
                      >
                        {seasonStats.races[hoveredRoundIdx].country}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.5rem",
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          paddingTop: "0.8rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                          }}
                        >
                          <span
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            Qualifying:
                          </span>
                          <span style={{ fontWeight: 600, color: "#fff" }}>
                            {seasonStats.races[hoveredRoundIdx]
                              .qualifyingPosition
                              ? `P${seasonStats.races[hoveredRoundIdx].qualifyingPosition}`
                              : "DNF/DNS"}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: "0.85rem",
                          }}
                        >
                          <span
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            Race Finish:
                          </span>
                          <span style={{ fontWeight: 600, color: teamColor }}>
                            {seasonStats.races[hoveredRoundIdx].finishPosition
                              ? `P${seasonStats.races[hoveredRoundIdx].finishPosition}`
                              : "DNF"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* 4. CAREER SCROLL SECTION */}
      <section
        ref={timelineRef}
        style={{
          padding: "8vw 5vw",
          borderTop: "1px solid var(--color-border)",
          background:
            "linear-gradient(to bottom, var(--color-bg-base), #000 70%)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "4rem",
          }}
        >
          {/* Left Timeline (F1 Teams Driven For) */}
          <div
            style={{
              flex: "1 1 350px",
              position: "relative",
              paddingLeft: "4rem",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-accent-primary)",
                fontSize: "0.9rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Historical Path
            </span>
            <h2
              style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                margin: "0.5rem 0 3rem 0",
                fontFamily: "var(--font-heading)",
              }}
            >
              F1 TEAM{" "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                TIMELINE
              </span>
            </h2>

            {constructorTimeline === null ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3.5rem",
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      paddingLeft: "0.5rem",
                    }}
                  >
                    <div
                      className="skeleton-pulse"
                      style={{
                        height: "0.85rem",
                        width: "70px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                    <div
                      className="skeleton-pulse"
                      style={{
                        height: "1.6rem",
                        width: "220px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                    <div
                      className="skeleton-pulse"
                      style={{
                        height: "0.85rem",
                        width: "130px",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : constructorTimeline.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)" }}>
                No historical timeline team details available.
              </p>
            ) : (
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3.5rem",
                }}
              >
                {/* Connecting Scroll Line */}
                <div
                  style={{
                    position: "absolute",
                    left: "-2.5rem",
                    top: "10px",
                    bottom: "10px",
                    width: "2px",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />

                <motion.div
                  style={{
                    position: "absolute",
                    left: "-2.5rem",
                    top: "10px",
                    bottom: "10px",
                    width: "2px",
                    background: teamColor,
                    scaleY,
                    transformOrigin: "top",
                  }}
                />

                {constructorTimeline.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: idx * 0.1 }}
                    style={{ position: "relative" }}
                  >
                    {/* Ring dot on line */}
                    <div
                      style={{
                        position: "absolute",
                        left: "-3rem",
                        top: "6px",
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "var(--color-bg-base)",
                        border: `2px solid ${idx === constructorTimeline.length - 1 ? teamColor : "rgba(255,255,255,0.2)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 5,
                      }}
                    >
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background:
                            idx === constructorTimeline.length - 1
                              ? teamColor
                              : "rgba(255,255,255,0.2)",
                        }}
                      />
                    </div>

                    {/* Team Details */}
                    <div>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontFamily: "var(--font-heading)",
                          fontWeight: 600,
                          color:
                            idx === constructorTimeline.length - 1
                              ? teamColor
                              : "var(--color-text-muted)",
                          letterSpacing: "0.1em",
                        }}
                      >
                        {item.startYear}{" "}
                        {item.endYear && item.endYear !== item.startYear
                          ? `– ${item.endYear}`
                          : ""}
                      </span>
                      <h4
                        style={{
                          fontSize: "1.6rem",
                          margin: "0.3rem 0 0.2rem 0",
                          fontFamily: "var(--font-heading)",
                          color: "#fff",
                        }}
                      >
                        {item.name}
                      </h4>
                      <p
                        style={{
                          color: "var(--color-text-secondary)",
                          fontSize: "0.85rem",
                          margin: 0,
                        }}
                      >
                        {item.nationality} • {item.seasonsCount} season(s)
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (Career F1 Summary) */}
          <div
            style={{
              flex: "1 1 350px",
              background: "var(--color-bg-panel)",
              padding: "3.5rem",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background: `linear-gradient(to right, ${teamColor}, transparent)`,
              }}
            />

            <span
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--color-text-muted)",
                fontSize: "0.9rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              Historical Archives
            </span>
            <h2
              style={{
                fontSize: "2rem",
                margin: "0.5rem 0 3rem 0",
                fontFamily: "var(--font-heading)",
              }}
            >
              CAREER{" "}
              <span style={{ color: "var(--color-text-secondary)" }}>
                SUMMARY
              </span>
            </h2>

            {!careerStats ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3rem 2rem",
                }}
              >
                {[
                  { label: "Championships", size: "huge" },
                  { label: "Grand Prix Wins", size: "large" },
                  { label: "Pole Positions", size: "large" },
                  { label: "Podiums", size: "large" },
                  { label: "Races Started", size: "large" },
                  { label: "Best Season", size: "huge" },
                ].map((stat, idx) => (
                  <div
                    key={stat.label}
                    style={{
                      gridColumn: idx === 0 || idx === 5 ? "1 / -1" : "auto",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        display: "block",
                        marginBottom: "0.6rem",
                        fontWeight: 600,
                      }}
                    >
                      {stat.label}
                    </span>
                    <div
                      className="skeleton-pulse"
                      style={{
                        height: stat.size === "huge" ? "3.5rem" : "2.5rem",
                        width: stat.size === "huge" ? "70%" : "50%",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3rem 2rem",
                }}
              >
                {[
                  {
                    label: "Championships",
                    value: careerStats.titles,
                    color: "var(--color-accent-tertiary)",
                  },
                  {
                    label: "Grand Prix Wins",
                    value: careerStats.wins,
                    color: "#fff",
                  },
                  {
                    label: "Pole Positions",
                    value: careerStats.poles,
                    color: "#fff",
                  },
                  {
                    label: "Podiums",
                    value: careerStats.podiums,
                    color: "#fff",
                  },
                  {
                    label: "Races Started",
                    value: careerStats.starts,
                    color: "var(--color-text-secondary)",
                  },
                  {
                    label: "Best Season",
                    value: careerStats.bestSeasonPoints
                      ? `${careerStats.bestSeasonYear} (${careerStats.bestSeasonPoints} PTS)`
                      : "N/A",
                    color: "var(--color-accent-secondary)",
                  },
                ].map((stat, idx) => (
                  <div
                    key={stat.label}
                    style={{
                      gridColumn: idx === 0 || idx === 5 ? "1 / -1" : "auto",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        display: "block",
                        marginBottom: "0.4rem",
                        fontWeight: 600,
                      }}
                    >
                      {stat.label}
                    </span>
                    <span
                      style={{
                        fontSize: idx === 0 || idx === 5 ? "4rem" : "2.8rem",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 800,
                        color: stat.color,
                        lineHeight: 0.9,
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

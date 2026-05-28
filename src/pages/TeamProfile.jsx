import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { f1Api } from '../utils/api';
import { jolpicaApi } from '../utils/jolpicaApi';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import CustomDropdown from '../components/ui/CustomDropdown';
import { getTeamSlug } from '../components/team/TeamCard';

const formatDriverName = (driver) => {
  if (!driver) return '';
  if (driver.first_name || driver.last_name) {
    const first = driver.first_name ? driver.first_name[0] : '';
    const last = driver.last_name || '';
    return first ? `${first}. ${last}` : last;
  }
  if (driver.givenName || driver.familyName) {
    const first = driver.givenName ? driver.givenName[0] : '';
    const last = driver.familyName || '';
    return first ? `${first}. ${last}` : last;
  }
  return driver.broadcast_name || driver.full_name || '';
};

export default function TeamProfile() {
  const { teamSlug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTeam = location.state?.team;

  // Available seasons for selector
  const [availableSeasons, setAvailableSeasons] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);

  // Loading and Error States
  const [loadingProfile, setLoadingProfile] = useState(() => !initialTeam);
  const [error, setError] = useState(null);
  const [loadingSeasonData, setLoadingSeasonData] = useState(true);

  // Constructor details & stats
  const [teamInfo, setTeamInfo] = useState(() => initialTeam || null);
  const currentTeamInfo = teamInfo || initialTeam;
  const [careerStats, setCareerStats] = useState(null);
  
  // History archives over the years
  const [historyArchives, setHistoryArchives] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Driver lists & positions for the selected year
  const [sessions, setSessions] = useState([]);
  const [currentDrivers, setCurrentDrivers] = useState([]);
  const [driversPositions, setDriversPositions] = useState([]);

  // Fetch static/career details once per teamSlug
  useEffect(() => {
    // Reset all states for new team slug
    setTeamInfo(initialTeam || null);
    setLoadingProfile(!initialTeam);
    setError(null);
    setAvailableSeasons([]);
    setSelectedYear(null);
    setCareerStats(null);
    setHistoryArchives([]);
    setLoadingHistory(true);
    setSessions([]);
    setCurrentDrivers([]);
    setDriversPositions([]);
    setLoadingSeasonData(true);

    let isMounted = true;
    let bioTimerId = null;
    let statsTimerId = null;

    const loadTeamBio = async () => {
      try {
        // 1. Match team details from OpenF1
        const driverData = await f1Api.getDrivers('latest');
        const match = driverData.find(d => getTeamSlug(d.team_name) === teamSlug);

        // Standardized mock team info from matched driver if available
        const resolvedTeam = match ? {
          team_name: match.team_name,
          team_colour: match.team_colour,
          country_code: match.country_code || '—'
        } : (initialTeam || {
          team_name: teamSlug.replace(/_/g, ' ').toUpperCase(),
          team_colour: 'e10600',
          country_code: '—'
        });

        if (isMounted) {
          setTeamInfo(resolvedTeam);
          setLoadingProfile(false);
        }

        // 2. Load historical constructor stats from Jolpica
        loadConstructorStats(resolvedTeam);
      } catch (err) {
        console.error("Failed to load constructor bio data", err);
        if (isMounted) {
          bioTimerId = setTimeout(loadTeamBio, 10000);
        }
      }
    };

    const loadConstructorStats = async (resolvedTeam) => {
      try {
        const constructorId = await jolpicaApi.getConstructorId(resolvedTeam.team_name);
        
        // Fetch seasons list and career stats
        const [allSeasons, stats] = await Promise.all([
          jolpicaApi.getConstructorSeasons(constructorId),
          jolpicaApi.getConstructorCareerStats(constructorId)
        ]);

        if (!isMounted) return;
        setCareerStats(stats);

        const supportedSeasons = allSeasons.filter(y => [2026, 2025, 2024, 2023].includes(y));
        if (supportedSeasons.length > 0) {
          setAvailableSeasons(supportedSeasons);
          setSelectedYear(supportedSeasons[0]);
        } else {
          setAvailableSeasons([2026, 2025, 2024, 2023]);
          setSelectedYear(2026);
        }

        // Fetch archives historically in background
        loadHistoryArchives(constructorId);
      } catch (err) {
        console.error("Failed to load career/timeline stats", err);
        if (isMounted) {
          statsTimerId = setTimeout(() => loadConstructorStats(resolvedTeam), 10000);
        }
      }
    };

    const loadHistoryArchives = async (constructorId) => {
      try {
        const archives = await Promise.all(
          [2026, 2025, 2024, 2023].map(async (y) => {
            const stats = await jolpicaApi.getConstructorSeasonStats(constructorId, y).catch(() => null);
            const drivers = await jolpicaApi.getConstructorDrivers(constructorId, y).catch(() => []);
            const driverNames = drivers.map(formatDriverName).filter(Boolean).join(' / ');

            return {
              year: y,
              position: stats?.position || '—',
              points: stats?.points || 0,
              wins: stats?.wins || 0,
              driversList: driverNames || 'No drivers listed'
            };
          })
        );

        if (isMounted) {
          setHistoryArchives(archives.filter(a => a.position !== '—'));
          setLoadingHistory(false);
        }
      } catch (err) {
        console.error("Failed to load historical timeline archives", err);
        if (isMounted) {
          setTimeout(() => loadHistoryArchives(constructorId), 15000);
        }
      }
    };

    loadTeamBio();
    return () => {
      isMounted = false;
      if (bioTimerId) clearTimeout(bioTimerId);
      if (statsTimerId) clearTimeout(statsTimerId);
    };
  }, [teamSlug]);

  // Fetch telemetry and session results when year changes
  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchSeasonTelemetry = async () => {
      if (!currentTeamInfo || !selectedYear) return;
      if (isMounted) setLoadingSeasonData(true);

      try {
        const raceData = await f1Api.getSessions(selectedYear, 'Race');
        if (!isMounted) return;

        // Resolve active driver numbers and drivers for this constructor in the selected year
        const cleanStr = (s) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '').trim();
        const targetClean = cleanStr(currentTeamInfo.team_name);

        let resolvedDrivers = [];
        const currentYear = new Date().getFullYear();
        let sessionKey = 'latest';

        if (selectedYear !== currentYear && raceData && raceData.length > 0) {
          const sorted = [...raceData].sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
          // Search sessions chronologically for a valid driver registry
          for (const race of sorted) {
            try {
              const res = await fetch(`https://api.openf1.org/v1/drivers?session_key=${race.session_key}`);
              if (res.ok) {
                const list = await res.json();
                const matches = list.filter(d => {
                  const dClean = cleanStr(d.team_name);
                  return dClean === targetClean || dClean.includes(targetClean) || targetClean.includes(dClean);
                });
                if (matches.length > 0) {
                  resolvedDrivers = matches;
                  sessionKey = race.session_key;
                  break;
                }
              }
            } catch (e) {
              console.warn(e);
            }
          }
        } else {
          // Current year 'latest'
          const activeDrivers = await f1Api.getDrivers('latest').catch(() => []);
          resolvedDrivers = activeDrivers.filter(d => {
            const dClean = cleanStr(d.team_name);
            return dClean === targetClean || dClean.includes(targetClean) || targetClean.includes(dClean);
          });
        }

        // Deduplicate driver records by driver_number
        const seenNumbers = new Set();
        const uniqueDrivers = [];
        resolvedDrivers.forEach(d => {
          if (!seenNumbers.has(d.driver_number)) {
            uniqueDrivers.push(d);
            seenNumbers.add(d.driver_number);
          }
        });

        if (isMounted) setCurrentDrivers(uniqueDrivers);

        // Fetch finish positions for both resolved driver numbers
        const positionsData = await Promise.all(
          uniqueDrivers.map(async (driver) => {
            try {
              const res = await fetch(`https://api.openf1.org/v1/session_result?driver_number=${driver.driver_number}`);
              if (!res.ok) throw new Error("Positions API error");
              const data = await res.json();
              return {
                driver_number: driver.driver_number,
                results: Array.isArray(data) ? data : []
              };
            } catch (err) {
              console.warn(`Telemetry failed for driver ${driver.driver_number}`, err);
              return { driver_number: driver.driver_number, results: [] };
            }
          })
        );

        if (!isMounted) return;

        setSessions(raceData || []);
        setDriversPositions(positionsData);
        setLoadingSeasonData(false);
      } catch (e) {
        console.error("Failed to load constructor season telemetry", e);
        if (isMounted) {
          timerId = setTimeout(fetchSeasonTelemetry, 10000);
        }
      }
    };

    fetchSeasonTelemetry();
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [teamSlug, selectedYear, currentTeamInfo]);

  // Processes race stats for the selected year
  const seasonStats = useMemo(() => {
    if (!sessions.length) {
      return { races: [], totalWins: 0, totalPoints: 0, position: '—' };
    }

    const POINTS_MAP = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
    let totalWins = 0;
    let totalPoints = 0;

    const sortedRaces = [...sessions]
      .filter(s => s.year === selectedYear)
      .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    const processedRaces = sortedRaces.map((race, idx) => {
      const roundResults = currentDrivers.map((driver) => {
        const dPositions = driversPositions.find(p => p.driver_number === driver.driver_number);
        const matchResult = dPositions ? dPositions.results.find(res => res.session_key === race.session_key) : null;
        const finishPos = matchResult ? matchResult.position : null;

        const pts = matchResult
          ? (typeof matchResult.points === 'number' ? matchResult.points : (POINTS_MAP[finishPos] || 0))
          : 0;

        if (finishPos === 1) totalWins++;
        totalPoints += pts;

        return {
          driver,
          position: finishPos,
          points: pts
        };
      });

      return {
        round: idx + 1,
        circuit: race.circuit_short_name || race.location,
        location: race.location,
        country: race.country_name,
        results: roundResults
      };
    });

    // Lookup final standings position/points from the history timeline if loaded
    const archiveMatch = historyArchives.find(a => a.year === selectedYear);
    const activePosition = archiveMatch ? `P${archiveMatch.position}` : '—';
    const activePoints = archiveMatch ? archiveMatch.points : totalPoints;

    return {
      races: processedRaces,
      totalWins,
      totalPoints: activePoints,
      position: activePosition
    };
  }, [sessions, currentDrivers, driversPositions, selectedYear, historyArchives]);

  const [hoveredRoundIdx, setHoveredRoundIdx] = useState(null);

  const timelineRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start center", "end center"]
  });
  const scaleY = useTransform(scrollYProgress, [0, 0.7], [0, 1]);

  if (!currentTeamInfo && loadingProfile) {
    return <LoadingState message={`Opening constructor profile ${teamSlug}...`} />;
  }

  if (error || (!currentTeamInfo && !loadingProfile)) {
    return <ErrorState message={error || "Constructor profile not found."} onRetry={() => navigate('/teams')} />;
  }

  const teamColor = currentTeamInfo.team_colour ? `#${currentTeamInfo.team_colour}` : "#e10600";
  const teamName = currentTeamInfo.team_name;

  // Chart coordinate parameters
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 60;
  const chartHeight = 350;
  const chartWidth = 900;

  const yPosScale = (pos) => {
    if (!pos || pos > 20) return chartHeight - paddingBottom;
    const availableHeight = chartHeight - paddingTop - paddingBottom;
    return paddingTop + ((pos - 1) / 19) * availableHeight;
  };

  const xRoundScale = (idx, total) => {
    if (total <= 1) return paddingLeft + (chartWidth - paddingLeft - paddingRight) / 2;
    const availableWidth = chartWidth - paddingLeft - paddingRight;
    return paddingLeft + (idx / (total - 1)) * availableWidth;
  };

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* 1. HERO HEADER */}
      <section style={{
        position: 'relative',
        padding: '12vw 5vw 6vw 5vw',
        overflow: 'hidden',
        borderBottom: '1px solid var(--color-border)',
        background: 'radial-gradient(circle at 10% 20%, rgba(20,20,20,0.8) 0%, var(--color-bg-base) 90%)'
      }}>
        {/* Accent Glow */}
        <div style={{
          position: 'absolute', top: '10%', right: '10%', width: '400px', height: '400px',
          background: teamColor, filter: 'blur(160px)', opacity: 0.15, zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Back Button */}
        <button
          onClick={() => navigate('/teams')}
          style={{
            position: 'absolute', top: '8vw', left: '5vw', zIndex: 30,
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            color: 'var(--color-text-secondary)', fontSize: '0.9rem',
            letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase'
          }}
          className="btn"
        >
          <span>← Back to Strategy</span>
        </button>

        {/* Huge Watermark */}
        <div style={{
          position: 'absolute', bottom: '-15%', right: '5%',
          fontSize: 'clamp(5rem, 15vw, 15rem)', fontFamily: 'var(--font-heading)',
          fontWeight: 900, color: 'rgba(255, 255, 255, 0.02)',
          zIndex: 1, userSelect: 'none', lineHeight: 0.8
        }}>
          {teamName.split(' ')[0]}
        </div>

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Team accent vertical color bar */}
          <div style={{
            width: '8px',
            height: '140px',
            borderRadius: 'var(--radius-sm)',
            background: `linear-gradient(to bottom, ${teamColor}, ${teamColor}44)`,
            boxShadow: `0 0 30px ${teamColor}66`,
            display: 'block'
          }} />

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.2rem',
                fontWeight: 600,
                color: teamColor,
                letterSpacing: '0.15em',
                textTransform: 'uppercase'
              }}>
                CONSTRUCTOR
              </span>
              {currentDrivers.length > 0 && (
                <>
                  <div style={{ width: '40px', height: '1px', background: 'var(--color-border)' }} />
                  <span style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '1.1rem',
                    color: 'var(--color-text-muted)',
                    letterSpacing: '0.05em'
                  }}>
                    DRIVERS: {currentDrivers.map(d => d.last_name).join(' / ')}
                  </span>
                </>
              )}
            </div>

            <h1 style={{ fontSize: 'clamp(3rem, 6vw, 5.5rem)', lineHeight: 0.9, margin: 0, fontFamily: 'var(--font-heading)' }}>
              <span style={{ fontWeight: 800 }}>{teamName}</span>
            </h1>

            {currentTeamInfo.country_code && currentTeamInfo.country_code !== '—' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                <span style={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-text-secondary)'
                }}>
                  {currentTeamInfo.country_code}
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Base Country</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. SEASON TRACKER */}
      <section style={{ padding: '6vw 5vw' }}>
        
        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', marginBottom: '4rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', fontSize: '0.9rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Season Analytics
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '0.5rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
              PERFORMANCE <span style={{ color: 'var(--color-text-secondary)' }}>TRACKER</span>
            </h2>
          </div>

          {availableSeasons.length > 0 && selectedYear ? (
            <CustomDropdown
              value={selectedYear}
              onChange={(val) => setSelectedYear(val)}
              options={availableSeasons.map(y => ({ value: y, label: `${y} SEASON` }))}
            />
          ) : (
            <div className="skeleton-pulse" style={{ width: '160px', height: '42px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)' }} />
          )}
        </div>

        {/* Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem', marginBottom: '5rem' }}>
          {[
            { label: 'Championship Position', value: seasonStats.position, desc: 'Final season standing' },
            { label: 'Wins', value: seasonStats.totalWins, desc: 'Constructor victories' },
            { label: 'Points Scored', value: Math.round(seasonStats.totalPoints), desc: 'Season points' }
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-panel"
              style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--color-bg-panel)', position: 'relative', overflow: 'hidden' }}
            >
              <div style={{ width: '4px', height: '24px', background: teamColor, position: 'absolute', left: 0, top: '2rem' }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                {stat.label}
              </span>
              {loadingSeasonData ? (
                <div
                  className="skeleton-pulse"
                  style={{
                    height: '3rem',
                    width: '80px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 'var(--radius-sm)',
                    margin: '0.5rem 0'
                  }}
                />
              ) : (
                <span style={{ fontSize: '3rem', fontFamily: 'var(--font-heading)', fontWeight: 700, color: '#fff', lineHeight: 1, margin: '0.5rem 0' }}>
                  {stat.value}
                </span>
              )}
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                {loadingSeasonData ? 'Retrieving standings...' : stat.desc}
              </span>
            </motion.div>
          ))}
        </div>

        {/* SVG GRAPH */}
        {loadingSeasonData ? (
          <div
            className="glass-panel skeleton-pulse"
            style={{
              height: `${chartHeight}px`,
              background: 'var(--color-bg-panel)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)', fontSize: '1.1rem', letterSpacing: '0.1em' }}>
              Syncing constructor telemetry datasets...
            </p>
          </div>
        ) : seasonStats.races.length === 0 ? (
          <div className="state-container" style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <p className="text-muted" style={{ fontSize: '1.1rem', fontFamily: 'var(--font-heading)' }}>No telemetry performance datasets available for {selectedYear}.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="glass-panel"
            style={{ padding: '3rem 2rem', background: 'var(--color-bg-panel)', borderRadius: 'var(--radius-lg)', position: 'relative' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontFamily: 'var(--font-heading)' }}>
                  Driver Telemetry <span style={{ color: 'var(--color-text-secondary)' }}>Finish History</span>
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
                  Overlaying rounds performance for constructor driver lineup
                </p>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                {currentDrivers.map((driver, dIdx) => (
                  <div key={driver.driver_number} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ 
                      width: '20px', 
                      height: '3px', 
                      background: teamColor,
                      opacity: dIdx === 1 ? 0.6 : 1
                    }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {formatDriverName(driver)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Responsive SVG Chart */}
            <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: '850px', position: 'relative' }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height={chartHeight} style={{ overflow: 'visible' }}>
                  <defs>
                    <filter id="shadowGlow" x="-10%" y="-10%" width="120%" height="120%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feComponentTransfer in="blur" result="glow">
                        <feFuncA type="linear" slope="0.35" />
                      </feComponentTransfer>
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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
                          stroke={hoveredRoundIdx === idx ? "rgba(255,255,255,0.06)" : "transparent"}
                          strokeWidth={hoveredRoundIdx === idx ? "24" : "1"}
                          strokeLinecap="round"
                        />
                        <text
                          x={x}
                          y={chartHeight - paddingBottom + 25}
                          fill={hoveredRoundIdx === idx ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
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

                  {/* Render Polyline Path for both drivers */}
                  {currentDrivers.map((driver, dIdx) => {
                    const points = seasonStats.races
                      .map((race, idx) => {
                        const driverResult = race.results[dIdx];
                        if (!driverResult || !driverResult.position) return null;
                        const x = xRoundScale(idx, seasonStats.races.length);
                        const y = yPosScale(driverResult.position);
                        return `${x},${y}`;
                      })
                      .filter(Boolean)
                      .join(' ');

                    return points ? (
                      <polyline
                        key={driver.driver_number}
                        fill="none"
                        stroke={teamColor}
                        strokeWidth="3"
                        points={points}
                        filter="url(#shadowGlow)"
                        opacity={dIdx === 1 ? 0.6 : 0.9}
                      />
                    ) : null;
                  })}

                  {/* Render Node Dots */}
                  {seasonStats.races.map((race, idx) => {
                    const x = xRoundScale(idx, seasonStats.races.length);
                    const isHovered = hoveredRoundIdx === idx;

                    return (
                      <g key={idx}>
                        {race.results.map((res, dIdx) => {
                          const y = res.position ? yPosScale(res.position) : null;
                          if (!y) return null;

                          return (
                            <g key={dIdx}>
                              {isHovered && (
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="8"
                                  fill={teamColor}
                                  opacity="0.25"
                                />
                              )}
                              <circle
                                cx={x}
                                cy={y}
                                r={isHovered ? "5" : "3.5"}
                                fill={teamColor}
                                stroke="#ffffff"
                                strokeWidth="1"
                                opacity={dIdx === 1 ? 0.6 : 1}
                              />
                            </g>
                          );
                        })}

                        {/* Interactive Invisible Hover Areas */}
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
                {hoveredRoundIdx !== null && seasonStats.races[hoveredRoundIdx] && (
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    left: `${xRoundScale(hoveredRoundIdx, seasonStats.races.length) + (hoveredRoundIdx > seasonStats.races.length / 2 ? -260 : 30)}px`,
                    width: '230px',
                    background: 'rgba(10, 10, 10, 0.95)',
                    border: `1px solid ${teamColor}55`,
                    borderRadius: 'var(--radius-md)',
                    padding: '1.2rem',
                    boxShadow: 'var(--shadow-panel)',
                    backdropFilter: 'blur(10px)',
                    zIndex: 100,
                    pointerEvents: 'none',
                    transition: 'left 0.2s ease-out'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                      Round {seasonStats.races[hoveredRoundIdx].round}
                    </span>
                    <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.2rem 0', fontFamily: 'var(--font-heading)', color: '#fff', textTransform: 'uppercase' }}>
                      {seasonStats.races[hoveredRoundIdx].circuit}
                    </h4>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '0 0 1rem 0' }}>
                      {seasonStats.races[hoveredRoundIdx].country}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.8rem' }}>
                      {seasonStats.races[hoveredRoundIdx].results.map((res, dIdx) => (
                        <div key={dIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>
                            {formatDriverName(res.driver)}:
                          </span>
                          <span style={{ fontWeight: 600, color: '#fff' }}>
                            {res.position ? `P${res.position} (+${res.points} pts)` : 'DNF/DNS'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* 3. HISTORICAL STANDINGS TIMELINE */}
      <section ref={timelineRef} style={{ padding: '6vw 5vw', position: 'relative' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '2rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', fontSize: '0.9rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Historical Archives
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: '0.5rem 0 0 0', fontFamily: 'var(--font-heading)' }}>
              CAREER <span style={{ color: 'var(--color-text-secondary)' }}>TIMELINE</span>
            </h2>
          </div>
          {careerStats && (
            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Championships</span>
                <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600 }}>{careerStats.titles}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Wins</span>
                <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600 }}>{careerStats.wins}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Best Season</span>
                <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                  {careerStats.bestSeasonYear ? `${careerStats.bestSeasonYear}` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pulsing Loading Timeline */}
        {loadingHistory ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', paddingLeft: '2rem' }}>
            {[1, 2, 3].map((val) => (
              <div key={val} className="skeleton-pulse" style={{ height: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : historyArchives.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>No historical season records found for this team.</p>
        ) : (
          <div style={{ position: 'relative' }}>
            
            {/* Running line along the timeline */}
            <div style={{ position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0 }} />
            
            {/* Progress/glowing vertical line */}
            <motion.div 
              style={{ 
                position: 'absolute', left: '15px', top: '10px', bottom: '10px', width: '2px', 
                background: `linear-gradient(to bottom, ${teamColor}, transparent)`, 
                scaleY, transformOrigin: 'top', zIndex: 1 
              }} 
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
              {historyArchives.map((item, idx) => (
                <motion.div 
                  key={item.year}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  style={{ display: 'flex', gap: '3rem', position: 'relative', zIndex: 2 }}
                >
                  
                  {/* Timeline Node dot */}
                  <div style={{ flex: '0 0 32px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '0.4rem' }}>
                    <div style={{ 
                      width: '12px', height: '12px', borderRadius: '50%', 
                      background: item.position === "1" ? 'var(--color-accent-tertiary)' : 'var(--color-bg-elevated)', 
                      border: `2px solid ${item.position === "1" ? 'var(--color-accent-tertiary)' : teamColor}`, 
                      boxShadow: item.position === "1" ? '0 0 10px var(--color-accent-tertiary)' : 'none',
                      zIndex: 3 
                    }} />
                  </div>

                  {/* Details Card */}
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '2.5rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600, lineHeight: 1 }}>
                        {item.year} SEASON
                      </span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                        DRIVERS: <span style={{ color: '#fff' }}>{item.driversList}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Position</span>
                        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: item.position === "1" ? 'var(--color-accent-tertiary)' : '#fff', fontWeight: 600 }}>
                          P{item.position}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Wins</span>
                        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600 }}>
                          {item.wins}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Points</span>
                        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', color: teamColor, fontWeight: 600 }}>
                          {Math.round(item.points)}
                        </span>
                      </div>
                    </div>

                  </div>

                </motion.div>
              ))}
            </div>

          </div>
        )}
      </section>

    </div>
  );
}

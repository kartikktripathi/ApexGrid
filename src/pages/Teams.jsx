import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrivers, useChampionshipDrivers } from '../hooks/useF1Data';
import { f1Api } from '../utils/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import TeamCard from '../components/team/TeamCard';

export default function Teams() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [sessionKey, setSessionKey] = useState('latest');
  const [loadingSession, setLoadingSession] = useState(false);
  const [completedRaces, setCompletedRaces] = useState(0);

  // Fetch sessions to determine completed races and session key
  useEffect(() => {
    const fetchSessionForYear = async () => {
      setLoadingSession(true);
      try {
        const sessions = await f1Api.getSessions(selectedYear);
        let count = 0;
        
        if (sessions && sessions.length > 0) {
          const now = new Date();
          for (const s of sessions) {
            // Count races that have already started/completed
            if (s.date_start && new Date(s.date_start) < now) {
              count++;
            }
          }
          // Fallback to all sessions if date_start is missing
          if (count === 0) count = sessions.length;
          
          setCompletedRaces(count);
          
          const currentYear = new Date().getFullYear();
          if (selectedYear === currentYear) {
            setSessionKey('latest');
          } else {
            // Select the last completed session for past years
            const lastSession = sessions[count - 1];
            setSessionKey(lastSession.session_key);
          }
        } else {
          setCompletedRaces(0);
          setSessionKey('invalid'); // No sessions found
        }
      } catch (error) {
        console.error("Failed to fetch sessions for year", error);
        setCompletedRaces(0);
        setSessionKey('invalid');
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSessionForYear();
  }, [selectedYear]);

  const { data: driversData, loading: loadingDrivers, error: errorDrivers, refetch: refetchDrivers } = useDrivers(sessionKey);
  const { data: champData, loading: loadingChamp, error: errorChamp, refetch: refetchChamp } = useChampionshipDrivers(sessionKey);

  const { allTeams, totalChampionshipPoints } = useMemo(() => {
    if (!driversData || sessionKey === 'invalid') return { allTeams: [], totalChampionshipPoints: 0 };
    
    // Create points map from championship data for drivers
    const pointsMap = {};
    if (champData) {
      champData.forEach(d => {
        pointsMap[d.driver_number] = d.points_current || 0;
      });
    }

    const teamsMap = {};
    let totalPts = 0;
    
    // Process drivers to build teams
    driversData.forEach(d => {
      if (d.team_name) {
        if (!teamsMap[d.team_name]) {
          teamsMap[d.team_name] = {
            team_name: d.team_name,
            team_colour: d.team_colour,
            drivers: [],
            points: 0,
            driverNumbers: []
          };
        }
        
        const driverName = d.full_name || `${d.first_name} ${d.last_name}`;
        if (!teamsMap[d.team_name].drivers.includes(driverName)) {
          teamsMap[d.team_name].drivers.push(driverName);
        }
        
        if (!teamsMap[d.team_name].driverNumbers.includes(d.driver_number)) {
          teamsMap[d.team_name].driverNumbers.push(d.driver_number);
          // Add driver's points to team's total points
          const driverPts = pointsMap[d.driver_number] || 0;
          teamsMap[d.team_name].points += driverPts;
          totalPts += driverPts;
        }
      }
    });

    const uniqueTeams = Object.values(teamsMap);

    // Sort descending by points
    uniqueTeams.sort((a, b) => b.points - a.points);
    
    return { 
      allTeams: uniqueTeams
    };
  }, [driversData, champData, sessionKey]);

  // Loading/Error states
  const isLoading = loadingSession || loadingDrivers || loadingChamp;
  
  // Calculate simulated P1/P2 dominance for the top team
  // Maximum points a team can score per race is 43 (25 for P1 + 18 for P2)
  const topTeam = allTeams.length > 0 ? allTeams[0] : null;
  const maxScorablePoints = completedRaces > 0 ? completedRaces * 43 : 43;
  const dominancePercentage = topTeam ? Math.min(100, Math.round((topTeam.points / maxScorablePoints) * 100)) : 0;

  const years = [2026, 2025, 2024, 2023];

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* PAGE HEADER - Strategic/Technical Vibe */}
      <div style={{ padding: '6vw 5vw 3vw 5vw', position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        
        {/* Subtle grid background for the header */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
          zIndex: 0
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '2rem', position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <p style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text-muted)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.8rem' }}>
              SYS_REQ: CONSTRUCTOR_ANALYSIS
            </p>
            <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
              TEAM <br/>
              <span style={{ color: 'var(--color-accent-primary)' }}>STRATEGY</span>
            </h1>
          </motion.div>
          
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Select Season Data
              </div>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  style={{
                    appearance: 'none',
                    background: 'var(--color-bg-panel)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    padding: '0.5rem 2.5rem 0.5rem 1rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-heading)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: 'var(--shadow-panel)',
                    transition: 'border-color var(--transition-fast)'
                  }}
                  onMouseOver={(e) => e.target.style.borderColor = 'var(--color-border-hover)'}
                  onMouseOut={(e) => e.target.style.borderColor = 'var(--color-border)'}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y} SEASON</option>
                  ))}
                </select>
                <div style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', color: 'var(--color-accent-primary)', fontSize: '0.7rem'
                }}>
                  ▼
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div style={{ padding: '0 5vw' }}>
        {isLoading ? (
          <div style={{ padding: '5rem 0' }}>
            <LoadingState message={`Syncing ${selectedYear} telemetry & constructor data...`} />
          </div>
        ) : errorDrivers || errorChamp ? (
          <div style={{ padding: '5rem 0' }}>
             <ErrorState message={errorDrivers || errorChamp} onRetry={() => { refetchDrivers(); refetchChamp(); }} />
          </div>
        ) : sessionKey === 'invalid' || allTeams.length === 0 ? (
          <div className="state-container" style={{ padding: '5rem 0' }}>
            <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono, monospace)' }}>ERR: NO_DATA_FOUND_FOR_SEASON_{selectedYear}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '4rem', marginTop: '4rem' }}
            >
              {/* HERO SECTION - Top Constructor */}
              {allTeams.length > 0 && (
                <section>
                  <TeamCard team={allTeams[0]} rank={1} variant="hero" dominancePercentage={dominancePercentage} />
                </section>
              )}

              {/* SPLIT SECTION: PERFORMANCE RAILS */}
              <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <h3 style={{ margin: 0, fontSize: '2rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                    Grid <span style={{ color: 'var(--color-text-secondary)' }}>Performance</span>
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {allTeams.slice(1).map((team, index) => (
                    <TeamCard 
                      key={team.team_name} 
                      team={team} 
                      rank={index + 2} // Starting from P2
                      variant="performance" 
                    />
                  ))}
                </div>
              </section>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

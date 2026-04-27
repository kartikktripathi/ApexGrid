import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useDrivers, useChampionshipDrivers } from '../hooks/useF1Data';
import { f1Api } from '../utils/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import DriverCard from '../components/driver/DriverCard';

export default function Drivers() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [sessionKey, setSessionKey] = useState('latest');
  const [loadingSession, setLoadingSession] = useState(false);

  // Fetch the correct session key for past years
  useEffect(() => {
    const fetchSessionForYear = async () => {
      const currentYear = new Date().getFullYear();
      if (selectedYear === currentYear) {
        setSessionKey('latest');
        return;
      }
      
      setLoadingSession(true);
      try {
        const sessions = await f1Api.getSessions(selectedYear);
        if (sessions && sessions.length > 0) {
          // Select the last session of that year
          const lastSession = sessions[sessions.length - 1];
          setSessionKey(lastSession.session_key);
        } else {
          setSessionKey('invalid'); // No sessions found
        }
      } catch (error) {
        console.error("Failed to fetch sessions for year", error);
        setSessionKey('invalid');
      } finally {
        setLoadingSession(false);
      }
    };

    fetchSessionForYear();
  }, [selectedYear]);

  const { data: driversData, loading: loadingDrivers, error: errorDrivers, refetch: refetchDrivers } = useDrivers(sessionKey);
  const { data: champData, loading: loadingChamp, error: errorChamp, refetch: refetchChamp } = useChampionshipDrivers(sessionKey);

  const { allDrivers, top3 } = useMemo(() => {
    if (!driversData || sessionKey === 'invalid') return { allDrivers: [], top3: [] };
    
    // Create points map from championship data
    const pointsMap = {};
    if (champData) {
      champData.forEach(d => {
        pointsMap[d.driver_number] = d.points_current || 0;
      });
    }

    const unique = [];
    const seen = new Set();
    
    // Deduplicate drivers and attach points
    driversData.forEach(d => {
      if (!seen.has(d.driver_number)) {
        unique.push({
          ...d,
          points: pointsMap[d.driver_number] || 0
        });
        seen.add(d.driver_number);
      }
    });

    // Sort descending by points
    unique.sort((a, b) => b.points - a.points);
    
    return { 
      allDrivers: unique, 
      top3: unique.slice(0, 3)
    };
  }, [driversData, champData, sessionKey]);

  // Loading/Error states
  const isLoading = loadingSession || loadingDrivers || loadingChamp;
  
  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* PAGE HEADER */}
      <div style={{ padding: '8vw 5vw 4vw 5vw', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '2rem' }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 600 }}>
              World Championship
            </p>
            <h1 style={{ fontSize: 'clamp(4rem, 10vw, 8rem)', lineHeight: 0.85, margin: 0, fontFamily: 'var(--font-heading)' }}>
              THE <span style={{ color: 'transparent', WebkitTextStroke: '2px var(--color-border-hover)' }}>GRID</span>
            </h1>
          </motion.div>
          
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  appearance: 'none',
                  background: 'var(--color-bg-panel)',
                  color: 'var(--color-text-primary)',
                  border: '2px solid var(--color-border)',
                  padding: '1rem 3rem 1rem 1.5rem',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-heading)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'var(--shadow-panel)',
                  transition: 'border-color var(--transition-fast)'
                }}
                onMouseOver={(e) => e.target.style.borderColor = 'var(--color-border-hover)'}
                onMouseOut={(e) => e.target.style.borderColor = 'var(--color-border)'}
              >
                {[2026, 2025, 2024, 2023].map(y => (
                  <option key={y} value={y}>{y} SEASON</option>
                ))}
              </select>
              <div style={{
                position: 'absolute', right: '1.2rem', top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', color: 'var(--color-accent-primary)', fontSize: '0.8rem'
              }}>
                ▼
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message={`Loading ${selectedYear} grid data...`} />
      ) : errorDrivers || errorChamp ? (
        <ErrorState message={errorDrivers || errorChamp} onRetry={() => { refetchDrivers(); refetchChamp(); }} />
      ) : sessionKey === 'invalid' || allDrivers.length === 0 ? (
        <div className="state-container">
          <p className="text-muted" style={{ fontSize: '1.2rem' }}>No grid data available for the {selectedYear} season.</p>
        </div>
      ) : (
        <>
          {/* FEATURED DRIVERS (TOP 3) */}
          {top3.length > 0 && (
            <section style={{ padding: '0 5vw 8vw 5vw' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'flex-start' }}>
                 {top3.map((driver, index) => (
                   <DriverCard key={driver.driver_number} driver={driver} rank={index + 1} variant="featured" />
                 ))}
              </div>
            </section>
          )}

          {/* FULL STANDINGS LEADERBOARD */}
          <section style={{ padding: '0 5vw', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '2rem' }}>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0, fontFamily: 'var(--font-heading)' }}>
                Full <span style={{ color: 'var(--color-text-secondary)' }}>Standings</span>
              </h2>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {allDrivers.map((d, i) => (
                <DriverCard key={d.driver_number} driver={d} rank={i + 1} variant="leaderboard" />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

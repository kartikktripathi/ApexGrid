import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { f1Api } from '../utils/api';
import LoadingState from '../components/common/LoadingState';
import ErrorState from '../components/common/ErrorState';
import MeetingCard from '../components/calendar/MeetingCard';

export default function Seasons() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [meetings, setMeetings] = useState([]);
  const [raceSessions, setRaceSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const years = [2026, 2025, 2024, 2023];

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError(null);
      try {
        const [meetingsData, sessionsData] = await Promise.all([
          f1Api.getMeetings(selectedYear),
          f1Api.getSessions(selectedYear, 'Race')
        ]);
        
        // Filter out testing
        const validMeetings = meetingsData.filter(m => m.meeting_name !== 'Pre-Season Testing');
        
        setMeetings(validMeetings);
        setRaceSessions(sessionsData);
      } catch (err) {
        setError("Failed to load race calendar. Please check your connection.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, [selectedYear]);

  // Determine next race
  const { nextRaceIndex, nextRace } = useMemo(() => {
    if (!meetings.length) return { nextRaceIndex: -1, nextRace: null };
    const now = new Date();
    const index = meetings.findIndex(m => new Date(m.date_end) > now);
    return {
      nextRaceIndex: index,
      nextRace: index !== -1 ? meetings[index] : null
    };
  }, [meetings]);

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* PAGE HEADER - Cinematic World Tour */}
      <div style={{ padding: '8vw 5vw 4vw 5vw', position: 'relative', overflow: 'hidden' }}>
        
        {/* Subtle Map/Globe overlay graphic could go here. For now using gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at right top, rgba(225,6,0,0.1), transparent 50%)',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-muted)', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.9rem' }}>
              The Global Journey
            </p>
            <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
              WORLD <span style={{ color: 'transparent', WebkitTextStroke: '2px var(--color-border-hover)' }}>TOUR</span>
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.4 }}
            style={{ marginTop: '3rem', display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem' }}
          >
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{
                  appearance: 'none',
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  padding: '0.8rem 3rem 0.8rem 1.5rem',
                  fontSize: '1.2rem',
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
                  <option key={y} value={y}>{y} WORLD TOUR</option>
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

      <div style={{ padding: '0 5vw' }}>
        {loading ? (
          <div style={{ padding: '10vh 0' }}>
            <LoadingState message={`Plotting the ${selectedYear} calendar...`} />
          </div>
        ) : error ? (
          <div style={{ padding: '10vh 0' }}>
            <ErrorState message={error} onRetry={() => setSelectedYear(selectedYear)} />
          </div>
        ) : meetings.length === 0 ? (
          <div className="state-container" style={{ padding: '10vh 0' }}>
            <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>CALENDAR NOT YET PUBLISHED FOR {selectedYear}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '4rem', marginTop: '2rem' }}
            >
              
              {/* HERO FEATURE - Next Race */}
              {nextRace && (
                <section style={{ marginBottom: '4rem' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '1.5rem', fontFamily: 'var(--font-heading)' }}>
                    Next Destination
                  </div>
                  <MeetingCard 
                    meeting={nextRace} 
                    isNextRace={true} 
                    index={nextRaceIndex} 
                    raceSession={raceSessions.find(s => s.meeting_key === nextRace.meeting_key)} 
                  />
                </section>
              )}

              {/* FULL SCHEDULE */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                    Full <span style={{ color: 'var(--color-text-secondary)' }}>Schedule</span>
                  </h2>
                  <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {meetings.length} ROUNDS
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {meetings.map((meeting, index) => {
                    const isNext = index === nextRaceIndex;
                    // Don't duplicate the next race if we already showed it as hero, unless we want the full list.
                    // We'll show the full list to serve as the archive/history.
                    return (
                      <MeetingCard 
                        key={meeting.meeting_key} 
                        meeting={meeting} 
                        index={index} 
                        isNextRace={isNext}
                        raceSession={raceSessions.find(s => s.meeting_key === meeting.meeting_key)}
                      />
                    );
                  })}
                </div>
              </section>

            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

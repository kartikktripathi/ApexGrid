import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { f1Api } from '../utils/api';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import MeetingCard from '../components/calendar/MeetingCard';
import CustomDropdown from '../components/ui/CustomDropdown';

export default function Sprint() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [meetings, setMeetings] = useState([]);
  const [sprintSessions, setSprintSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const years = [2026, 2025, 2024, 2023];

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchCalendar = async () => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        const [meetingsData, sessionsData] = await Promise.all([
          f1Api.getMeetings(selectedYear),
          f1Api.getSessions(selectedYear, 'Sprint')
        ]);
        
        if (!isMounted) return;

        // Filter out testing and keep only meetings with a sprint session
        const validMeetings = meetingsData.filter(m => 
          m.meeting_name !== 'Pre-Season Testing' && 
          sessionsData.some(s => s.meeting_key === m.meeting_key)
        );
        
        setMeetings(validMeetings);
        setSprintSessions(sessionsData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load sprint calendar:", err);
        if (isMounted) {
          timerId = setTimeout(fetchCalendar, 10000);
        }
      }
    };

    fetchCalendar();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [selectedYear]);

  // Determine next sprint race
  const { nextRaceIndex, nextRace } = useMemo(() => {
    if (!meetings.length) return { nextRaceIndex: -1, nextRace: null };
    const now = new Date();
    const index = meetings.findIndex(m => {
      const session = sprintSessions.find(s => s.meeting_key === m.meeting_key);
      return session ? new Date(session.date_start) > now : false;
    });
    // Fallback if we only use meeting date_end
    const fallbackIndex = index === -1 ? meetings.findIndex(m => new Date(m.date_end) > now) : index;
    return {
      nextRaceIndex: fallbackIndex !== -1 ? fallbackIndex : -1,
      nextRace: fallbackIndex !== -1 ? meetings[fallbackIndex] : null
    };
  }, [meetings, sprintSessions]);

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* PAGE HEADER - Cinematic World Tour */}
      <div style={{ padding: '8vw 5vw 4vw 5vw', position: 'relative', zIndex: 20 }}>
        
        {/* Subtle Map/Globe overlay graphic could go here. For now using gradient */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at right top, rgba(255, 128, 0, 0.15), transparent 60%)',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-muted)', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.9rem' }}>
              The Sprint Format
            </p>
            <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
              SPRINT <span style={{ color: 'transparent', WebkitTextStroke: '2px var(--color-border-hover)' }}>RACES</span>
            </h1>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            transition={{ delay: 0.4 }}
            style={{ marginTop: '3rem', display: 'flex', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem' }}
          >
            <CustomDropdown 
              value={selectedYear}
              onChange={(val) => setSelectedYear(val)}
              options={years.map(y => ({ value: y, label: `${y} SPRINT CALENDAR` }))}
              style={{ minWidth: '220px' }}
            />
          </motion.div>
        </div>
      </div>

      <div style={{ padding: '0 5vw' }}>
        {loading ? (
          <div style={{ padding: '10vh 0' }}>
            <LoadingState message={`Plotting the ${selectedYear} sprint calendar...`} />
          </div>
        ) : error ? (
          <div style={{ padding: '10vh 0' }}>
            <ErrorState message={error} onRetry={() => setSelectedYear(selectedYear)} />
          </div>
        ) : meetings.length === 0 ? (
          <div className="state-container" style={{ padding: '10vh 0' }}>
            <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>NO SPRINT RACES SCHEDULED FOR {selectedYear}</p>
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
                    Next Sprint Destination
                  </div>
                  <MeetingCard 
                    meeting={nextRace} 
                    isNextRace={true} 
                    index={nextRaceIndex} 
                    raceSession={sprintSessions.find(s => s.meeting_key === nextRace.meeting_key)} 
                  />
                </section>
              )}

              {/* FULL SCHEDULE */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 style={{ fontSize: '2.5rem', margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                    Sprint <span style={{ color: 'var(--color-text-secondary)' }}>Schedule</span>
                  </h2>
                  <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {meetings.length} SPRINT ROUNDS
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {meetings.map((meeting, index) => {
                    const isNext = index === nextRaceIndex;
                    return (
                      <MeetingCard 
                        key={meeting.meeting_key} 
                        meeting={meeting} 
                        index={index} 
                        isNextRace={isNext}
                        raceSession={sprintSessions.find(s => s.meeting_key === meeting.meeting_key)}
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

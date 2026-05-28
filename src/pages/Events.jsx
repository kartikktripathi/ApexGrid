import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { f1Api } from '../utils/api';
import { jolpicaApi } from '../utils/jolpicaApi';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import MeetingCard from '../components/calendar/MeetingCard';
import CustomDropdown from '../components/ui/CustomDropdown';

export default function Events() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [meetings, setMeetings] = useState([]);
  const [raceSessions, setRaceSessions] = useState([]);
  const [sprintSessions, setSprintSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for Leaderboard Overlay
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('race'); // 'race' | 'qualifying'
  const [leaderboardData, setLeaderboardData] = useState({
    raceResults: [],
    qualifyingResults: [],
    sprintResults: [],
    loading: false,
    error: null
  });

  const years = [2026, 2025, 2024, 2023];

  const getActualRound = (meeting) => {
    const index = meetings.findIndex(m => m.meeting_key === meeting.meeting_key);
    if (index === -1) return 1;
    return meetings.slice(0, index + 1).filter(m => !m.is_cancelled).length;
  };

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchCalendar = async () => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        const fetchMeetings = f1Api.getMeetings(selectedYear).catch(err => {
          console.warn("Failed to fetch meetings:", err);
          return [];
        });
        const fetchRaces = f1Api.getSessions(selectedYear, 'Race').catch(err => {
          console.warn("Failed to fetch races:", err);
          return [];
        });
        const fetchSprints = f1Api.getSessions(selectedYear, 'Sprint').catch(err => {
          console.warn("Failed to fetch sprints:", err);
          return [];
        });

        let [meetingsData, racesData, sprintsData] = await Promise.all([
          fetchMeetings,
          fetchRaces,
          fetchSprints
        ]);
        
        if (!isMounted) return;

        // Filter out testing
        let validMeetings = meetingsData.filter(m => m.meeting_name !== 'Pre-Season Testing');
        
        // Fallback to 2024 if no data is found for the current year, to prevent empty states
        if (validMeetings.length === 0 && selectedYear === new Date().getFullYear()) {
          console.log("No events found for current year, falling back to 2024...");
          meetingsData = await f1Api.getMeetings(2024).catch(() => []);
          racesData = await f1Api.getSessions(2024, 'Race').catch(() => []);
          sprintsData = await f1Api.getSessions(2024, 'Sprint').catch(() => []);
          validMeetings = meetingsData.filter(m => m.meeting_name !== 'Pre-Season Testing');
          setSelectedYear(2024);
        }

        setMeetings(validMeetings);
        setRaceSessions(racesData);
        setSprintSessions(sprintsData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load events calendar:", err);
        if (isMounted) {
          setError("Failed to load events data. Retrying...");
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

  // Filter meetings that have a sprint session
  const sprintMeetings = useMemo(() => {
    return meetings.filter(m => sprintSessions.some(s => s.meeting_key === m.meeting_key));
  }, [meetings, sprintSessions]);

  // Determine the next upcoming event chronologically (either a GP race or a Sprint session)
  const nextEventData = useMemo(() => {
    if (!meetings.length) return null;
    const now = new Date();
    // Allow sessions that started up to 2 hours ago
    const thresholdTime = now.getTime() - 2 * 60 * 60 * 1000;
    const futureSessions = [];

    // Check race sessions
    raceSessions.forEach(session => {
      const sessionStart = new Date(session.date_start).getTime();
      if (sessionStart > thresholdTime) {
        const meeting = meetings.find(m => m.meeting_key === session.meeting_key);
        if (meeting) {
          futureSessions.push({
            type: 'Grand Prix',
            date: new Date(session.date_start),
            session,
            meeting,
            index: meetings.findIndex(m => m.meeting_key === session.meeting_key)
          });
        }
      }
    });

    // Check sprint sessions
    sprintSessions.forEach(session => {
      const sessionStart = new Date(session.date_start).getTime();
      if (sessionStart > thresholdTime) {
        const meeting = meetings.find(m => m.meeting_key === session.meeting_key);
        if (meeting) {
          futureSessions.push({
            type: 'Sprint Race',
            date: new Date(session.date_start),
            session,
            meeting,
            index: sprintMeetings.findIndex(m => m.meeting_key === session.meeting_key)
          });
        }
      }
    });

    // Sort future sessions chronologically to get the next one
    futureSessions.sort((a, b) => a.date - b.date);

    if (futureSessions.length > 0) {
      return futureSessions[0];
    }

    // Fallback: If no future events, try to find the next GP meeting based on meeting end date
    const fallbackGpIndex = meetings.findIndex(m => new Date(m.date_end) > now);
    if (fallbackGpIndex !== -1) {
      const meeting = meetings[fallbackGpIndex];
      const session = raceSessions.find(s => s.meeting_key === meeting.meeting_key);
      return {
        type: 'Grand Prix',
        date: new Date(meeting.date_start),
        session,
        meeting,
        index: fallbackGpIndex
      };
    }

    return null;
  }, [meetings, raceSessions, sprintSessions, sprintMeetings]);

  // Lock body scrolling when modal is open
  useEffect(() => {
    if (selectedEvent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedEvent]);

  // Fetch results when selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) return;

    let isMounted = true;
    const fetchResults = async () => {
      setLeaderboardData(prev => ({ ...prev, loading: true, error: null }));
      try {
        const round = selectedEvent.round;
        const year = selectedYear;

        let raceResults = [];
        let qualifyingResults = [];
        let sprintResults = [];

        if (selectedEvent.type === 'Sprint') {
          sprintResults = await jolpicaApi.getSprintResults(year, round);
        } else {
          const [rData, qData] = await Promise.all([
            jolpicaApi.getRaceResults(year, round),
            jolpicaApi.getQualifyingResults(year, round)
          ]);
          raceResults = rData;
          qualifyingResults = qData;
        }

        if (!isMounted) return;

        const hasAnyResults = raceResults.length > 0 || qualifyingResults.length > 0 || sprintResults.length > 0;

        setLeaderboardData({
          raceResults,
          qualifyingResults,
          sprintResults,
          loading: false,
          error: !hasAnyResults
            ? `Classification telemetry results are not yet recorded for this event. Try selecting a completed season (such as 2024 or 2023) from the dropdown.`
            : null
        });
      } catch (err) {
        console.error("Failed to fetch leaderboard details:", err);
        if (isMounted) {
          setLeaderboardData({
            raceResults: [],
            qualifyingResults: [],
            sprintResults: [],
            loading: false,
            error: "Failed to connect to F1 telemetry server. Please try again."
          });
        }
      }
    };

    fetchResults();
    return () => {
      isMounted = false;
    };
  }, [selectedEvent, selectedYear]);

  // Set default tab to race when switching events
  useEffect(() => {
    if (selectedEvent) {
      setActiveTab('race');
    }
  }, [selectedEvent]);

  return (
    <div style={{ background: 'var(--color-bg-base)', minHeight: '100vh', paddingBottom: '10vw' }}>
      
      {/* PAGE HEADER */}
      <div style={{ padding: '8vw 5vw 4vw 5vw', position: 'relative', zIndex: 20 }}>
        
        {/* Cinematic gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at right top, rgba(225,6,0,0.12), transparent 50%)',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-muted)', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: '1rem', fontSize: '0.9rem' }}>
              The Official Calendar
            </p>
            <h1 style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 0.9, margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
              RACES & <span style={{ color: 'transparent', WebkitTextStroke: '2px var(--color-border-hover)' }}>SPRINTS</span>
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
              options={years.map(y => ({ value: y, label: `${y} EVENTS CALENDAR` }))}
              style={{ minWidth: '220px' }}
            />
          </motion.div>
        </div>
      </div>

      <div style={{ padding: '0 5vw' }}>
        {loading ? (
          <div style={{ padding: '10vh 0' }}>
            <LoadingState message={`Plotting the ${selectedYear} events calendar...`} />
          </div>
        ) : error && meetings.length === 0 ? (
          <div style={{ padding: '10vh 0' }}>
            <ErrorState message={error} onRetry={() => setSelectedYear(selectedYear)} />
          </div>
        ) : meetings.length === 0 ? (
          <div className="state-container" style={{ padding: '10vh 0' }}>
            <p className="text-muted" style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>EVENTS NOT YET SCHEDULED FOR {selectedYear}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedYear}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '5rem', marginTop: '2rem' }}
            >
              
              {/* HERO FEATURE - Next Event */}
              {nextEventData && (
                <section style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.5rem' }}>
                    <span style={{ fontSize: '0.9rem', color: 'var(--color-accent-primary)', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-heading)' }}>
                      Next Destination
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      background: nextEventData.type === 'Sprint Race' ? 'linear-gradient(90deg, #ff8000, #ff4000)' : 'var(--color-accent-primary)',
                      color: '#fff',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '3px',
                      fontFamily: 'var(--font-heading)',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}>
                      {nextEventData.type}
                    </span>
                  </div>
                  <MeetingCard 
                    meeting={nextEventData.meeting} 
                    isNextRace={true} 
                    index={nextEventData.index} 
                    raceSession={nextEventData.session}
                    variant="large"
                    showCountdown={true}
                    onClick={nextEventData.meeting.is_cancelled ? null : () => setSelectedEvent({
                      meeting: nextEventData.meeting,
                      round: getActualRound(nextEventData.meeting),
                      type: nextEventData.type === 'Sprint Race' ? 'Sprint' : 'Grand Prix'
                    })}
                  />
                </section>
              )}

              {/* SPRINT CALENDAR - Shown in a smaller grid */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                    Sprint <span style={{ color: 'var(--color-text-secondary)' }}>Schedule</span>
                  </h2>
                  <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9rem' }}>
                    {sprintMeetings.length} SPRINT ROUNDS
                  </div>
                </div>

                {sprintMeetings.length === 0 ? (
                  <div style={{ padding: '2rem 0' }}>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>No sprint events scheduled for the {selectedYear} season.</p>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
                    gap: '1.5rem'
                  }}>
                    {sprintMeetings.map((meeting, index) => {
                      const isNext = nextEventData && nextEventData.type === 'Sprint Race' && nextEventData.meeting.meeting_key === meeting.meeting_key;
                      const session = sprintSessions.find(s => s.meeting_key === meeting.meeting_key);
                      const isCancelled = meeting.is_cancelled === true;
                      return (
                        <MeetingCard 
                          key={`sprint-${meeting.meeting_key}`} 
                          meeting={meeting} 
                          index={index} 
                          isNextRace={isNext}
                          raceSession={session}
                          variant="small"
                          onClick={isCancelled ? null : () => setSelectedEvent({
                            meeting,
                            round: getActualRound(meeting),
                            type: 'Sprint'
                          })}
                        />
                      );
                    })}
                  </div>
                )}
              </section>

              {/* GRAND PRIX CALENDAR - Full schedule list */}
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h2 style={{ fontSize: '2rem', margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase' }}>
                    Grand Prix <span style={{ color: 'var(--color-text-secondary)' }}>Calendar</span>
                  </h2>
                  <div style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.9rem' }}>
                    {meetings.length} ROUNDS
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {meetings.map((meeting, index) => {
                    const isNext = nextEventData && nextEventData.type === 'Grand Prix' && nextEventData.meeting.meeting_key === meeting.meeting_key;
                    const session = raceSessions.find(s => s.meeting_key === meeting.meeting_key);
                    const isCancelled = meeting.is_cancelled === true;
                    return (
                      <MeetingCard 
                        key={`gp-${meeting.meeting_key}`} 
                        meeting={meeting} 
                        index={index} 
                        isNextRace={isNext}
                        raceSession={session}
                        variant="large"
                        onClick={isCancelled ? null : () => setSelectedEvent({
                          meeting,
                          round: getActualRound(meeting),
                          type: 'Grand Prix'
                        })}
                      />
                    );
                  })}
                </div>
              </section>

            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* LEADERBOARD OVERLAY MODAL */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem'
            }}
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                width: '100%',
                maxWidth: '900px',
                maxHeight: '85vh',
                background: 'var(--color-bg-elevated)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-panel)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  color: 'var(--color-text-secondary)',
                  fontSize: '2rem',
                  lineHeight: 1,
                  zIndex: 10,
                  transition: 'color 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.color = '#fff'}
                onMouseLeave={(e) => e.target.style.color = 'var(--color-text-secondary)'}
              >
                &times;
              </button>

              {/* Modal Header */}
              <div style={{
                padding: '2.5rem 2.5rem 1.5rem 2.5rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(0,0,0,0.2)',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'center'
              }}>
                <img
                  src={selectedEvent.meeting.country_flag}
                  alt={selectedEvent.meeting.country_name}
                  style={{ width: '50px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', letterSpacing: '0.2em' }}>
                      ROUND {selectedEvent.round} • {selectedEvent.type.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.8rem', margin: 0, fontFamily: 'var(--font-heading)', textTransform: 'uppercase', color: '#fff', lineHeight: 1.1 }}>
                    {selectedEvent.meeting.meeting_name}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>
                    {selectedEvent.meeting.circuit_short_name} • {selectedEvent.meeting.location}, {selectedEvent.meeting.country_name}
                  </div>
                </div>
              </div>

              {/* Modal Content / Leaderboard */}
              <div style={{ padding: '2rem 2.5rem', flex: 1, overflowY: 'auto' }}>
                {leaderboardData.loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1.5rem' }}>
                    <div className="spinner" />
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', letterSpacing: '0.05em' }}>
                      Retrieving paddock classification telemetry...
                    </p>
                  </div>
                ) : leaderboardData.error ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', textAlign: 'center', gap: '1rem' }}>
                    <div style={{ fontSize: '3rem' }}>🏁</div>
                    <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-heading)', color: '#fff' }}>DATA UNPUBLISHED</h3>
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', maxWidth: '500px', lineHeight: 1.4 }}>
                      {leaderboardData.error}
                    </p>
                  </div>
                ) : (
                  <div>
                    {/* Tabs for Grand Prix (Qualifying & Race) */}
                    {selectedEvent.type === 'Grand Prix' && (
                      <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem', paddingBottom: '0.2rem' }}>
                        <button
                          onClick={() => setActiveTab('race')}
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            textTransform: 'uppercase',
                            color: activeTab === 'race' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                            borderBottom: activeTab === 'race' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                            paddingBottom: '0.8rem',
                            paddingLeft: 0,
                            paddingRight: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Race Classification
                        </button>
                        <button
                          onClick={() => setActiveTab('qualifying')}
                          style={{
                            fontFamily: 'var(--font-heading)',
                            fontSize: '1rem',
                            textTransform: 'uppercase',
                            color: activeTab === 'qualifying' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                            borderBottom: activeTab === 'qualifying' ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
                            paddingBottom: '0.8rem',
                            paddingLeft: 0,
                            paddingRight: '1rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          Qualifying Classification
                        </button>
                      </div>
                    )}

                    {/* Leaderboard Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <th style={{ padding: '0.8rem 1rem' }}>Pos</th>
                            <th style={{ padding: '0.8rem 1rem' }}>Driver</th>
                            <th style={{ padding: '0.8rem 1rem' }}>Team</th>
                            {selectedEvent.type !== 'Sprint' && activeTab === 'qualifying' ? (
                              <>
                                <th style={{ padding: '0.8rem 1rem' }}>Q1</th>
                                <th style={{ padding: '0.8rem 1rem' }}>Q2</th>
                                <th style={{ padding: '0.8rem 1rem' }}>Q3</th>
                              </>
                            ) : (
                              <>
                                <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>Grid</th>
                                <th style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>Points</th>
                                <th style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>Time/Status</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedEvent.type === 'Sprint' ? leaderboardData.sprintResults : (activeTab === 'race' ? leaderboardData.raceResults : leaderboardData.qualifyingResults)).map((row, idx) => {
                            const driver = row.Driver;
                            const constructor = row.Constructor;
                            const isPoints = parseFloat(row.points) > 0;
                            
                            return (
                              <tr
                                key={driver.driverId}
                                style={{
                                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                                  fontSize: '0.9rem',
                                  background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'}
                              >
                                {/* Position */}
                                <td style={{ padding: '1rem', fontWeight: 600, width: '60px' }}>
                                  <span style={{
                                    color: row.position === "1" ? 'var(--color-accent-tertiary)' : row.position === "2" ? '#C0C0C0' : row.position === "3" ? '#CD7F32' : 'var(--color-text-secondary)'
                                  }}>
                                    P{row.position}
                                  </span>
                                </td>

                                {/* Driver Name */}
                                <td style={{ padding: '1rem', color: '#fff' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600 }}>{driver.givenName} {driver.familyName}</span>
                                    {driver.code && (
                                      <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)', padding: '0.1rem 0.4rem', borderRadius: '3px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                                        {driver.code}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Team Name */}
                                <td style={{ padding: '1rem', color: 'var(--color-text-secondary)' }}>
                                  <span>{constructor.name}</span>
                                </td>

                                {/* Qualifying Times vs Race Stats */}
                                {selectedEvent.type !== 'Sprint' && activeTab === 'qualifying' ? (
                                  <>
                                    <td style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{row.Q1 || '—'}</td>
                                    <td style={{ padding: '1rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{row.Q2 || '—'}</td>
                                    <td style={{ padding: '1rem', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>{row.Q3 || '—'}</td>
                                  </>
                                ) : (
                                  <>
                                    {/* Starting Grid */}
                                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                                      {row.grid === "0" ? 'Pit Lane' : row.grid}
                                    </td>

                                    {/* Points */}
                                    <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>
                                      {isPoints ? (
                                        <span style={{
                                          color: 'var(--color-accent-primary)',
                                          background: 'rgba(225,6,0,0.1)',
                                          padding: '0.2rem 0.6rem',
                                          borderRadius: '4px',
                                          border: '1px solid rgba(225,6,0,0.2)'
                                        }}>
                                          +{row.points} PTS
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--color-text-muted)' }}>0</span>
                                      )}
                                    </td>

                                    {/* Time/Status */}
                                    <td style={{ padding: '1rem', textAlign: 'right', color: row.status === 'Finished' ? 'var(--color-accent-secondary)' : 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                                      {row.Time?.time || row.status}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

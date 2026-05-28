import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { f1Api } from '../../utils/api';

export default function MeetingCard({ meeting, raceSession, isNextRace, index, variant = 'large', onClick }) {
  const [podium, setPodium] = useState(null);
  const [loadingWinner, setLoadingWinner] = useState(false);
  const [inView, setInView] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  const isCancelled = meeting.is_cancelled === true;
  const isCompleted = !isCancelled && raceSession && new Date(raceSession.date_start) < new Date();

  useEffect(() => {
    let isMounted = true;
    let timerId = null;
    let retryCount = 0;

    const fetchPodium = async () => {
      if (!isMounted || !inView) return;
      setLoadingWinner(true);
      try {
        const positions = await f1Api.getPositions(raceSession.session_key, 3);
        // Reverse to get the latest (final) positions instead of starting grid
        const finalPositions = [...positions].reverse();

        const p1 = finalPositions.find(p => p.position === 1);
        const p2 = finalPositions.find(p => p.position === 2);
        const p3 = finalPositions.find(p => p.position === 3);

        if (p1) {
          const drivers = await f1Api.getDrivers(raceSession.session_key);
          const getDriver = (p) => p ? drivers.find(d => d.driver_number === p.driver_number) : null;

          const podiumDrivers = [getDriver(p1), getDriver(p2), getDriver(p3)].filter(Boolean);

          if (podiumDrivers.length > 0) {
            if (isMounted) {
              setPodium(podiumDrivers);
              setLoadingWinner(false);
            }
            return; // Success!
          }
        }
      } catch (error) {
        console.error("Failed to fetch podium for", meeting.meeting_name);
      }

      // If failed, retry with backoff to prevent API spam (max 3 retries)
      if (isMounted && retryCount < 3) {
        retryCount++;
        timerId = setTimeout(fetchPodium, 10000 * retryCount);
      } else if (isMounted) {
        setLoadingWinner(false); // Give up after 3 retries
      }
    };

    if (isCompleted && raceSession && inView && !podium) {
      timerId = setTimeout(fetchPodium, index * 100);
    }

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isCompleted, raceSession, index, meeting.meeting_name, inView, podium]);

  useEffect(() => {
    if (!isNextRace || !raceSession?.date_start) return;

    const parseUtcDate = (dateStr) => {
      if (!dateStr) return null;
      let formatted = dateStr;
      if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
        formatted = dateStr + 'Z';
      }
      return new Date(formatted);
    };

    const targetDate = parseUtcDate(raceSession.date_start);
    if (!targetDate || isNaN(targetDate.getTime())) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate - now;

      if (difference <= 0) {
        return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true };
      }

      return {
        total: difference,
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isLive: false
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [isNextRace, raceSession]);

  const startDate = new Date(meeting.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endDate = new Date(meeting.date_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const statusColor = isCancelled ? 'var(--color-accent-tertiary)' : isNextRace ? 'var(--color-accent-primary)' : isCompleted ? 'var(--color-text-secondary)' : '#666';
  const statusText = isCancelled ? 'CANCELLED' : isNextRace ? 'UPCOMING' : isCompleted ? 'COMPLETED' : 'SCHEDULED';

  const isSmall = variant === 'small';

  const parseUtcDate = (dateStr) => {
    if (!dateStr) return null;
    let formatted = dateStr;
    if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
      formatted = dateStr + 'Z';
    }
    return new Date(formatted);
  };

  const localSessionData = useMemo(() => {
    if (isNextRace || !raceSession?.date_start) return null;
    const localDate = parseUtcDate(raceSession.date_start);
    if (!localDate || isNaN(localDate.getTime())) return null;

    const dateString = localDate.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    const timeString = localDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    const tzString = localDate.toLocaleDateString(undefined, { timeZoneName: 'short' }).split(', ').pop();
    
    return { dateString, timeString, tzString };
  }, [isNextRace, raceSession]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      onViewportEnter={() => setInView(true)}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={onClick ? { scale: 1.015, y: -2 } : {}}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-bg-elevated)',
        border: `1px solid ${isNextRace ? 'var(--color-border-hover)' : 'rgba(255,255,255,0.05)'}`,
        minHeight: isSmall ? 'auto' : '280px',
        boxShadow: isNextRace ? '0 0 40px rgba(225, 6, 0, 0.15)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)'
      }}
    >
      {/* Background Circuit Graphic */}
      <div style={{
        position: 'absolute',
        right: '-10%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: isSmall ? '45%' : '60%',
        height: '150%',
        opacity: isSmall ? 0.03 : (isNextRace ? 0.15 : 0.05),
        backgroundImage: `url(${meeting.circuit_image})`,
        backgroundSize: 'contain',
        backgroundPosition: 'right center',
        backgroundRepeat: 'no-repeat',
        filter: 'invert(1)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Top Banner / Timeline Indicator */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: isSmall ? '1rem 1.5rem' : '1.5rem 2.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.3)',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            fontSize: isSmall ? '0.7rem' : '0.8rem',
            fontFamily: 'var(--font-heading)',
            color: statusColor,
            letterSpacing: '0.2em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {isNextRace && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent-primary)', boxShadow: '0 0 10px var(--color-accent-primary)' }} />}
            {statusText}
          </div>
        </div>
        <div style={{ fontSize: isSmall ? '0.75rem' : '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {isSmall ? `Sprint Rd ${index + 1}` : `Round ${index + 1}`}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        padding: isSmall ? '1.5rem' : '2.5rem',
        display: 'flex',
        flexDirection: isSmall ? 'column' : 'row',
        gap: isSmall ? '1.2rem' : '2rem',
        flex: 1,
        zIndex: 1,
        alignItems: isSmall ? 'stretch' : 'center'
      }}>

        {isSmall ? (
          /* Small Variant Date & Flag Row */
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={meeting.country_flag}
              alt={meeting.country_name}
              style={{ width: '36px', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', color: '#fff' }}>
              {startDate} - {endDate}
            </div>
          </div>
        ) : (
          /* Large Variant Flag & Date Col */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: '0 0 120px' }}>
            <img
              src={meeting.country_flag}
              alt={meeting.country_name}
              style={{ width: '60px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#fff', lineHeight: 1 }}>{startDate.split(' ')[0]}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{startDate.split(' ')[1]}</div>
            </div>
            <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)', marginLeft: '10px' }} />
            <div>
              <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: '#fff', lineHeight: 1 }}>{endDate.split(' ')[0]}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{endDate.split(' ')[1]}</div>
            </div>
          </div>
        )}

        {/* Meeting Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {localSessionData && (
            <div style={{
              fontSize: isSmall ? '0.7rem' : '0.8rem',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-body)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexWrap: 'wrap'
            }}>
              <svg width={isSmall ? "10" : "12"} height={isSmall ? "10" : "12"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span style={{ color: 'var(--color-text-muted)' }}>{isSmall ? 'Sprint Start:' : 'GP Start:'}</span>
              <span>{localSessionData.dateString}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>•</span>
              <span style={{ color: '#ffffff', fontFamily: 'var(--font-heading)', fontWeight: 600, letterSpacing: '0.02em' }}>
                {localSessionData.timeString} <span style={{ fontSize: '80%', opacity: 0.5, fontWeight: 500 }}>{localSessionData.tzString}</span>
              </span>
            </div>
          )}
          <h2 style={{
            fontSize: isSmall ? '1.3rem' : 'clamp(1.8rem, 4vw, 2.5rem)',
            fontFamily: 'var(--font-heading)',
            margin: '0 0 0.4rem 0',
            textTransform: 'uppercase',
            lineHeight: 1.2
          }}>
            {(meeting.meeting_official_name || meeting.meeting_name || '').replace(/formula 1/ig, '').replace(/\s{2,}/g, ' ').trim()}
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: isSmall ? 'column' : 'row',
            alignItems: isSmall ? 'flex-start' : 'center',
            gap: isSmall ? '0.2rem' : '1rem',
            color: 'var(--color-text-secondary)',
            fontSize: isSmall ? '0.75rem' : '1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}>
            <span>{meeting.circuit_short_name}</span>
            {!isSmall && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-text-muted)' }} />}
            <span style={{ color: isSmall ? 'var(--color-text-muted)' : 'inherit' }}>{meeting.location}, {meeting.country_name}</span>
          </div>

          {/* Countdown timer for the Next/Upcoming Race */}
          {isNextRace && timeLeft && (
            <div style={{
              marginTop: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
              zIndex: 2,
              position: 'relative'
            }}>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-accent-primary)', display: 'inline-block' }} />
                Race Countdown
              </div>

              {timeLeft.isLive ? (
                <div style={{
                  fontSize: '1.4rem',
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-accent-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>
                  🏎️ RACE IS LIVE
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {/* Days */}
                  <span style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600, lineHeight: 1 }}>
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-body)', marginRight: '1.5rem', letterSpacing: '0.05em' }}>
                    d
                  </span>

                  {/* Hours */}
                  <span style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600, lineHeight: 1 }}>
                    {String(timeLeft.hours).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-body)', marginRight: '1.5rem', letterSpacing: '0.05em' }}>
                    h
                  </span>

                  {/* Minutes */}
                  <span style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)', fontFamily: 'var(--font-heading)', color: '#fff', fontWeight: 600, lineHeight: 1 }}>
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-body)', marginRight: '1.5rem', letterSpacing: '0.05em' }}>
                    m
                  </span>

                  {/* Seconds */}
                  <span style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)', fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', fontWeight: 600, lineHeight: 1 }}>
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--color-accent-primary)', textTransform: 'uppercase', fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}>
                    s
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Podium Section for Completed Races */}
          {isCompleted && (
            <div style={{ marginTop: isSmall ? '1rem' : '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Podium Results
              </div>

              {loadingWinner ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    style={{ width: '10px', height: '10px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--color-accent-primary)', borderRadius: '50%' }}
                  />
                  Syncing telemetry...
                </div>
              ) : podium ? (
                isSmall ? (
                  /* Compact Podium list */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%', maxWidth: '280px' }}>
                    {podium.map((driver, idx) => (
                      <div key={driver.driver_number} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: idx < 2 ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingBottom: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontFamily: 'var(--font-heading)', color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32', fontSize: '0.8rem', width: '18px', display: 'inline-block' }}>P{idx + 1}</span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase' }}>{driver.last_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: `#${driver.team_colour || 'ccc'}` }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{driver.team_name.split(' ')[0]}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Large Podium list */
                  <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
                    {podium.map((driver, idx) => (
                      <div key={driver.driver_number} style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontFamily: 'var(--font-heading)', color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : '#CD7F32', fontSize: '1.2rem', lineHeight: 1 }}>P{idx + 1}</span>
                          <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{driver.last_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: `#${driver.team_colour || 'ccc'}` }} />
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{driver.team_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Results pending</div>
              )}
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { f1Api } from '../../utils/api';

export default function MeetingCard({ meeting, raceSession, isNextRace, index }) {
  const [podium, setPodium] = useState(null);
  const [loadingWinner, setLoadingWinner] = useState(false);

  const isCancelled = meeting.is_cancelled === true;
  const isCompleted = !isCancelled && raceSession && new Date(raceSession.date_start) < new Date();
  
  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const fetchPodium = async () => {
      if (!isMounted) return;
      setLoadingWinner(true);
      try {
        const positions = await f1Api.getPositions(raceSession.session_key, 3);
        const p1 = positions.find(p => p.position === 1);
        const p2 = positions.find(p => p.position === 2);
        const p3 = positions.find(p => p.position === 3);
        
        if (p1) {
          const drivers = await f1Api.getDrivers(raceSession.session_key);
          const getDriver = (p) => p ? drivers.find(d => d.driver_number === p.driver_number) : null;
          
          const podiumDrivers = [getDriver(p1), getDriver(p2), getDriver(p3)].filter(Boolean);
          
          if (podiumDrivers.length > 0) {
            if (isMounted) {
              setPodium(podiumDrivers);
              setLoadingWinner(false); 
            }
            return; // Success! Exit function.
          }
        }
      } catch (error) {
        console.error("Failed to fetch podium for", meeting.meeting_name);
      }
      
      // If we failed or didn't find the winner, retry in 10 seconds
      if (isMounted) {
        timerId = setTimeout(fetchPodium, 10000);
      }
    };

    if (isCompleted && raceSession) {
      // Short initial delay based on index to prevent 20 requests hitting immediately
      timerId = setTimeout(fetchPodium, index * 200);
    }
    
    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [isCompleted, raceSession, index, meeting.meeting_name]);

  const startDate = new Date(meeting.date_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endDate = new Date(meeting.date_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const statusColor = isCancelled ? 'var(--color-accent-tertiary)' : isNextRace ? 'var(--color-accent-primary)' : isCompleted ? 'var(--color-text-secondary)' : '#666';
  const statusText = isCancelled ? 'CANCELLED' : isNextRace ? 'UPCOMING' : isCompleted ? 'COMPLETED' : 'SCHEDULED';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'var(--color-bg-elevated)',
        border: `1px solid ${isNextRace ? 'var(--color-border-hover)' : 'rgba(255,255,255,0.05)'}`,
        minHeight: '280px',
        boxShadow: isNextRace ? '0 0 40px rgba(225, 6, 0, 0.15)' : 'none'
      }}
    >
      {/* Background Circuit Graphic */}
      <div style={{
        position: 'absolute',
        right: '-10%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '60%',
        height: '150%',
        opacity: isNextRace ? 0.15 : 0.05,
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
        padding: '1.5rem 2.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(0,0,0,0.3)',
        zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            fontSize: '0.8rem',
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
        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Round {index + 1}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: '2.5rem', display: 'flex', gap: '2rem', flex: 1, zIndex: 1, alignItems: 'center' }}>
        
        {/* Flag & Date Col */}
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

        {/* Meeting Info */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontFamily: 'var(--font-heading)', margin: '0 0 0.5rem 0', textTransform: 'uppercase', lineHeight: 1.1 }}>
            {meeting.meeting_official_name || meeting.meeting_name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--color-text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <span>{meeting.circuit_short_name}</span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--color-text-muted)' }} />
            <span>{meeting.location}, {meeting.country_name}</span>
          </div>

          {/* Podium Section for Completed Races */}
          {isCompleted && (
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Podium Results
              </div>
              
              {loadingWinner ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                   <motion.div
                     animate={{ rotate: 360 }}
                     transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                     style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--color-accent-primary)', borderRadius: '50%' }}
                   />
                   Syncing telemetry results...
                </div>
              ) : podium ? (
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
              ) : (
                <div style={{ color: 'var(--color-text-muted)' }}>Results pending</div>
              )}
            </div>
          )}
        </div>
        
      </div>
    </motion.div>
  );
}

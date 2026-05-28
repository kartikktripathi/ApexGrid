import React, { useEffect, useState, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { f1Api } from '../utils/api';

const HERO_IMG = './frontBG.png';

// Using real data from the API, starting with empty states
export default function Home() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const loadData = async () => {
      let hasError = false;

      // 1. Fetch Drivers
      try {
        const [d, allDrivers] = await Promise.all([
          f1Api.getChampionshipDrivers('latest'),
          f1Api.getDrivers('latest')
        ]);

        if (d && d.length > 0 && allDrivers && allDrivers.length > 0) {
          const sorted = d.sort((a, b) => b.points_current - a.points_current).slice(0, 5).map(driver => {
            const driverInfo = allDrivers.find(x => x.driver_number === driver.driver_number) || {};
            return {
              driver_number: driver.driver_number,
              full_name: driverInfo.full_name || 'Unknown Driver',
              team_name: driverInfo.team_name || 'Unknown Team',
              points: driver.points_current,
              color: driverInfo.team_colour ? `#${driverInfo.team_colour}` : '#ffffff'
            };
          });
          if (isMounted) setDrivers(sorted);
        }
      } catch (err) {
        console.error("Failed to load driver API data:", err);
        hasError = true;
      }

      // 2. Fetch Calendar
      try {
        let currentYear = new Date().getFullYear();
        let meetings = await f1Api.getMeetings(currentYear);

        if (!meetings || meetings.length === 0) {
          meetings = await f1Api.getMeetings(2024);
        }

        if (meetings && meetings.length > 0) {
          const sortedM = meetings.sort((a, b) => new Date(a.date_start) - new Date(b.date_start)).map((m, i) => ({
            round: i + 1,
            country: m.country_name,
            circuit: m.circuit_short_name || m.location,
            date: new Date(m.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rawDate: new Date(m.date_start),
            image: m.circuit_image // Fetched dynamically from the API
          }));

          const now = new Date();
          let upcoming = sortedM.filter(m => {
            const virtualDate = new Date(m.rawDate);
            virtualDate.setFullYear(now.getFullYear());
            return virtualDate >= now;
          });

          if (upcoming.length === 0) upcoming = sortedM.slice(-5);
          else upcoming = upcoming.slice(0, 5);

          if (isMounted) setRaces(upcoming);
        }
      } catch (err) {
        console.error("Failed to load calendar API data:", err);
        hasError = true;
      }

      if (isMounted) {
        setLoading(false);
        if (hasError) {
          timerId = setTimeout(loadData, 10000);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ background: 'var(--color-bg-base)', minHeight: '100vh', width: '100vw', left: '50%', right: '50%', marginLeft: '-50vw', marginRight: '-50vw', position: 'relative' }}>

      {/* 1. HERO SECTION */}
      <HeroSection scrollYProgress={scrollYProgress} onExplore={() => navigate('/events')} />

      {/* 2. DRIVER STANDINGS */}
      <StandingsSection drivers={drivers} loading={loading} />

      {/* 3. RACE CALENDAR TIMELINE */}
      <CalendarSection races={races} loading={loading} />

      {/* 4. FOOTER */}
      <Footer />
    </div>
  );
}

function HeroSection({ scrollYProgress, onExplore }) {
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  return (
    <div style={{ height: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <motion.div
        style={{
          position: 'absolute', top: '-10%', left: 0, right: 0, bottom: '-10%',
          backgroundImage: `url(${HERO_IMG})`, backgroundSize: 'cover', backgroundPosition: 'center',
          y, zIndex: 0, filter: 'brightness(0.6) contrast(1.1)'
        }}
      />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50vh', background: 'linear-gradient(to top, var(--color-bg-base), transparent)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, padding: '0 5vw', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <motion.p
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent-primary)', fontSize: '1rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}
        >
          World Championship
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ fontSize: 'clamp(3.5rem, 8vw, 9rem)', lineHeight: 0.85, margin: 0, maxWidth: '1200px' }}
        >
          THE APEX <br />
          <span style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}>OF MOTORSPORT</span>
        </motion.h1>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ marginTop: '2rem' }}>
          <button onClick={onExplore} className="btn" style={{ fontSize: '0.9rem', padding: '1rem 2.5rem' }}>Explore Season</button>
        </motion.div>
      </div>

      <motion.div style={{ opacity, position: 'absolute', bottom: '4rem', right: '5vw', zIndex: 2, display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '1px', height: '60px', background: 'rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
          <motion.div
            animate={{ y: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            style={{ width: '100%', height: '50%', background: 'var(--color-accent-primary)' }}
          />
        </div>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.8rem', letterSpacing: '0.1em', writingMode: 'vertical-rl' }}>SCROLL</span>
      </motion.div>
    </div>
  );
}

function StandingsSection({ drivers, loading }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <section style={{ padding: '10vw 5vw', position: 'relative', zIndex: 2, background: 'var(--color-bg-base)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '2rem' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', margin: 0 }}>Driver<br /><span style={{ color: 'var(--color-text-secondary)' }}>Standings</span></h2>
      </div>

      {(loading || drivers.length === 0) ? (
        <StandingsSkeleton />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {drivers.map((d, i) => (
          <motion.div
            key={i}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              display: 'flex', alignItems: 'center', padding: '1.5rem 2rem',
              background: hoveredIndex === i ? 'var(--color-bg-panel)' : 'transparent',
              border: '1px solid',
              borderColor: hoveredIndex === i ? 'var(--color-border-hover)' : 'transparent',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Team Color Bar */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: d.color, transform: hoveredIndex === i ? 'scaleY(1)' : 'scaleY(0)', transition: 'transform var(--transition-fast)', transformOrigin: 'center' }} />

            <div style={{ flex: '0 0 60px', fontFamily: 'var(--font-heading)', fontSize: '2rem', color: hoveredIndex === i ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: 600 }}>
              0{i + 1}
            </div>

            <div style={{ flex: '1', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', fontWeight: 600 }}>{d.full_name}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.team_name}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', fontWeight: 600, color: hoveredIndex === i ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{d.points}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', paddingBottom: '0.4rem' }}>PTS</span>
            </div>
          </motion.div>
        ))}
        </div>
      )}
    </section>
  );
}

function CalendarSection({ races, loading }) {
  return (
    <section style={{ padding: '10vw 5vw', background: 'var(--color-bg-base)' }}>
      <div style={{ maxWidth: '800px' }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '4rem' }}>Race <span style={{ color: 'var(--color-text-secondary)' }}>Calendar</span></h2>

        {(loading || races.length === 0) ? (
          <CalendarSkeleton />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
          {races.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '2rem 0', gap: '3rem', position: 'relative' }}
            >
              <div style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Round {r.round}</span>
                <span style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)', fontWeight: 600, marginTop: '0.5rem' }}>{r.date}</span>
              </div>

              <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '3rem', zIndex: 1 }}>
                <h4 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0' }}>{r.country}</h4>
                <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '0.9rem' }}>{r.circuit}</p>
              </div>

              {/* Dynamic Circuit Figure fetched from API */}
              {r.image && (
                <div style={{
                  position: 'absolute',
                  right: '0',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '150px',
                  height: '100%',
                  backgroundImage: `url(${r.image})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'right center',
                  backgroundRepeat: 'no-repeat',
                  filter: 'invert(1) opacity(0.2)',
                  pointerEvents: 'none',
                  zIndex: 0
                }} />
              )}
            </motion.div>
          ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StandingsSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} style={{
          display: 'flex', alignItems: 'center', padding: '1.5rem 2rem',
          border: '1px solid transparent',
          borderRadius: 'var(--radius-md)',
          position: 'relative',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '50%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
              zIndex: 1
            }}
          />
          <div style={{ flex: '0 0 60px' }}>
            <div style={{ width: '40px', height: '30px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          </div>
          <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ width: '150px', height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
            <div style={{ width: '100px', height: '14px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <div style={{ width: '50px', height: '30px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} style={{
          display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '2rem 0', gap: '3rem', position: 'relative', overflow: 'hidden'
        }}>
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '50%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)',
              zIndex: 1
            }}
          />
          <div style={{ flex: '0 0 100px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ width: '60px', height: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
            <div style={{ width: '80px', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '3rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ width: '200px', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
            <div style={{ width: '150px', height: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '4rem 5vw', background: '#000', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', margin: 0, fontFamily: 'var(--font-heading)' }}><span style={{ color: 'var(--color-accent-primary)' }}>APEX</span>GRID</h2>
      </div>
      <div style={{ display: 'flex', gap: '2rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <span>Non-commercial conceptual design</span>
      </div>
    </footer>
  );
}

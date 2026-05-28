import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const getTeamSlug = (teamName) => {
  return (teamName || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export function ConstructorHero({ team, dominancePercentage }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const teamColor = team?.team_colour ? `#${team.team_colour}` : "#e10600";

  return (
    <motion.div 
      onClick={() => navigate(`/teams/${getTeamSlug(team.team_name)}`, { state: { team } })}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.005, y: -2 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'var(--color-bg-elevated)',
        border: '1px solid',
        borderColor: isHovered ? 'var(--color-border-hover)' : 'var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        minHeight: '400px',
        padding: '3rem',
        boxShadow: isHovered ? `0 0 40px ${teamColor}15` : 'inset 0 0 100px rgba(0,0,0,0.8)',
        cursor: 'pointer',
        transition: 'border-color 0.3s, box-shadow 0.3s'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: teamColor }} />
      
      {/* Background Grid Pattern for Technical Feel */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        zIndex: 0,
        opacity: 0.5
      }} />

      {/* Top Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', zIndex: 1, position: 'relative' }}>
        <div>
          <span style={{ color: 'var(--color-accent-tertiary)', fontFamily: 'var(--font-heading)', letterSpacing: '0.2em', fontSize: '0.9rem', textTransform: 'uppercase' }}>
            Current Leader // P1
          </span>
          <h2 style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', fontFamily: 'var(--font-heading)', margin: '0.5rem 0 0 0', lineHeight: 1, color: '#fff' }}>
            {team?.team_name || 'Constructor'}
          </h2>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {team?.drivers?.map((d, i) => (
              <span key={i} style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {d} {i < team.drivers.length - 1 && ' | '}
              </span>
            ))}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'clamp(4rem, 8vw, 6rem)', fontFamily: 'var(--font-heading)', color: teamColor, lineHeight: 0.9, fontWeight: 700 }}>
            {team?.points || 0}
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem', fontFamily: 'var(--font-heading)' }}>TOTAL PTS</div>
        </div>
      </div>

      {/* Bottom Section - Telemetry & Stats */}
      <div style={{ marginTop: 'auto', display: 'flex', gap: '3rem', zIndex: 1, position: 'relative', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Team Dominance
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-heading)', color: '#fff' }}>
              {dominancePercentage}%
            </div>
            <div style={{ height: '8px', flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${dominancePercentage}%` }} 
                transition={{ duration: 1.5, delay: 0.5 }}
                style={{ height: '100%', background: teamColor }} 
              />
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export function PerformanceBarRow({ team, rank }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const teamColor = team.team_colour ? `#${team.team_colour}` : "#e10600";

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/teams/${getTeamSlug(team.team_name)}`, { state: { team } })}
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: rank * 0.05 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '1.5rem',
        background: isHovered ? 'var(--color-bg-elevated)' : 'transparent',
        border: '1px solid',
        borderColor: isHovered ? 'var(--color-border-hover)' : 'rgba(255,255,255,0.05)',
        borderRadius: 'var(--radius-sm)',
        position: 'relative',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
    >
      <div style={{ 
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', 
        background: teamColor, 
        transform: isHovered ? 'scaleY(1)' : 'scaleY(0)', 
        transition: 'transform var(--transition-fast)', 
        transformOrigin: 'center' 
      }} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--color-text-muted)', width: '30px' }}>
            P{rank}
          </div>
          <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', color: isHovered ? '#fff' : 'var(--color-text-primary)' }}>
            {team.team_name}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', gap: '0.5rem' }}>
            {team.drivers?.map((d, i) => (
              <span key={i} style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{d}</span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '2rem', fontFamily: 'var(--font-heading)', color: teamColor, fontWeight: 700 }}>
            {team.points}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>PTS</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function TeamCard({ team, rank, variant = 'performance', dominancePercentage = 0 }) {
  if (variant === 'hero') {
    return <ConstructorHero team={team} dominancePercentage={dominancePercentage} />;
  }
  return <PerformanceBarRow team={team} rank={rank} />;
}

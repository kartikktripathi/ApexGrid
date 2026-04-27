import React, { useState } from 'react';
import { motion } from 'framer-motion';

export function FeaturedDriverCard({ driver, rank }) {
  const [isHovered, setIsHovered] = useState(false);
  const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#e10600";
  const driverName = driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim();
  
  // Asymmetrical sizing: 1st place gets more visual weight
  const isFirst = rank === 1;
  const height = isFirst ? '400px' : '300px';

  return (
    <motion.div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: rank * 0.1 }}
      style={{ 
        height, 
        position: 'relative', 
        borderRadius: 'var(--radius-lg)', 
        overflow: 'hidden',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        cursor: 'pointer',
        gridColumn: isFirst ? '1 / -1' : 'auto',
      }}
    >
      {/* Background Ambient Glow */}
      <motion.div 
        animate={{ opacity: isHovered ? 0.4 : 0.1 }}
        style={{
          position: 'absolute', top: '10%', left: '10%', right: '10%', bottom: '10%',
          background: teamColor, filter: 'blur(100px)', zIndex: 0,
          transition: 'opacity 0.4s ease'
        }}
      />

      {/* Massive Background Number */}
      <div style={{
        position: 'absolute', top: isFirst ? '-20%' : '-10%', right: isFirst ? '5%' : '-10%', 
        fontSize: isFirst ? '30rem' : '16rem', fontFamily: 'var(--font-heading)',
        fontWeight: 800, color: 'rgba(255,255,255,0.03)',
        zIndex: 1, lineHeight: 1, userSelect: 'none',
        transition: 'transform 0.5s ease',
        transform: isHovered ? 'scale(1.05)' : 'scale(1)'
      }}>
        {driver.driver_number}
      </div>

      {/* Gradient Overlay for Text */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, var(--color-bg-panel) 0%, transparent 100%)',
        zIndex: 3
      }} />

      {/* Rank Badge */}
      <div style={{
        position: 'absolute', top: '2rem', left: '2rem', zIndex: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '48px', height: '48px', borderRadius: '50%',
        background: isFirst ? 'var(--color-accent-tertiary)' : 'var(--color-bg-base)',
        color: isFirst ? '#000' : '#fff',
        fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '1.2rem',
        border: isFirst ? 'none' : '1px solid var(--color-border)',
        boxShadow: isFirst ? '0 0 20px rgba(255, 215, 0, 0.4)' : 'none'
      }}>
        P{rank}
      </div>

      {/* Typography & Content */}
      <div style={{
        position: 'absolute', 
        bottom: 0, left: 0, 
        right: 0, 
        padding: '2.5rem', zIndex: 4,
        display: 'flex', flexDirection: 'column', gap: '0.8rem',
        justifyContent: 'flex-end',
        height: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '4px', height: '24px', background: teamColor }} />
          <span style={{ color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.85rem', fontWeight: 600 }}>
            {driver.team_name || 'Unknown Team'}
          </span>
        </div>
        
        <h3 style={{ margin: 0, fontSize: isFirst ? '4rem' : '2.5rem', fontFamily: 'var(--font-heading)', lineHeight: 0.9 }}>
          {driver.first_name && <span style={{ display: 'block', fontWeight: 400, fontSize: '0.5em', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{driver.first_name}</span>}
          <span style={{ color: isHovered ? '#fff' : 'var(--color-text-primary)', transition: 'color 0.3s' }}>
            {driver.last_name ? driver.last_name : driverName}
          </span>
        </h3>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isFirst ? '2rem' : '1rem' }}>
          <div>
            <span style={{ fontSize: isFirst ? '3rem' : '2rem', fontFamily: 'var(--font-heading)', fontWeight: 600, color: teamColor }}>{driver.points}</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', marginLeft: '0.4rem', fontWeight: 600 }}>PTS</span>
          </div>
          
          <motion.div 
            animate={{ x: isHovered ? 0 : -10, opacity: isHovered ? 1 : 0 }}
            style={{ color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}
          >
            Profile <span style={{ color: 'var(--color-accent-primary)' }}>→</span>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export function LeaderboardRow({ driver, rank }) {
  const [isHovered, setIsHovered] = useState(false);
  const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#e10600";
  const driverName = driver.full_name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim();

  return (
    <motion.div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: Math.min(rank * 0.05, 0.5) }}
      style={{
        display: 'flex', alignItems: 'center', padding: '1.2rem 2rem', 
        background: isHovered ? 'var(--color-bg-elevated)' : 'transparent',
        border: '1px solid',
        borderColor: isHovered ? 'var(--color-border-hover)' : 'var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ 
        position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', 
        background: teamColor, 
        transform: isHovered ? 'scaleY(1)' : 'scaleY(0)', 
        transition: 'transform var(--transition-fast)', 
        transformOrigin: 'center' 
      }} />
      
      <div style={{ 
        flex: '0 0 60px', fontFamily: 'var(--font-heading)', fontSize: '1.5rem', 
        color: isHovered ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: 600 
      }}>
        {rank.toString().padStart(2, '0')}
      </div>
      
      <div style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ flex: '1' }}>
          <span style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)', fontWeight: 600, display: 'block' }}>{driverName}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{driver.team_name}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', flex: '0 0 100px', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '1.8rem', fontFamily: 'var(--font-heading)', fontWeight: 600, color: isHovered ? teamColor : 'var(--color-text-primary)' }}>
          {driver.points}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', paddingBottom: '0.3rem' }}>PTS</span>
      </div>
    </motion.div>
  );
}

export default function DriverCard({ driver, rank, variant = 'leaderboard' }) {
  if (variant === 'featured') {
    return <FeaturedDriverCard driver={driver} rank={rank} />;
  }
  return <LeaderboardRow driver={driver} rank={rank} />;
}

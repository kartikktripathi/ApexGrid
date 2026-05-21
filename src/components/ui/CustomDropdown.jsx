import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomDropdown({ value, options, onChange, style }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div 
      ref={dropdownRef} 
      style={{ position: 'relative', display: 'inline-block', zIndex: isOpen ? 50 : 1, ...style }}
    >
      <div 
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          background: 'var(--color-bg-panel, var(--color-bg-elevated, #1a1a1a))',
          color: 'var(--color-text-primary, #ffffff)',
          border: '2px solid',
          borderColor: (isOpen || isHovered) ? 'var(--color-border-hover, #555)' : 'var(--color-border, #333)',
          padding: '1rem 3rem 1rem 1.5rem',
          fontSize: '1.2rem',
          fontWeight: 600,
          fontFamily: 'var(--font-heading)',
          borderRadius: 'var(--radius-md, 4px)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-panel)',
          transition: 'border-color var(--transition-fast, 0.2s ease)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none',
          minWidth: '200px'
        }}
      >
        <span>{selectedOption?.label}</span>
        <div style={{
          position: 'absolute', right: '1.2rem', top: '50%',
          pointerEvents: 'none', color: 'var(--color-accent-primary, #e10600)', fontSize: '0.8rem',
          transition: 'transform 0.2s ease',
          transform: isOpen ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)'
        }}>
          ▼
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '0.5rem',
              background: 'var(--color-bg-panel, #1a1a1a)',
              border: '1px solid var(--color-border-hover, #555)',
              borderRadius: 'var(--radius-md, 4px)',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          >
            {options.map((opt, idx) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.color = 'var(--color-accent-primary, #e10600)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = opt.value === value ? 'rgba(255,255,255,0.02)' : 'transparent';
                  e.target.style.color = 'var(--color-text-primary, #ffffff)';
                }}
                style={{
                  padding: '1rem 1.5rem',
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  fontFamily: 'var(--font-heading)',
                  cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s',
                  color: 'var(--color-text-primary, #ffffff)',
                  borderBottom: idx === options.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)',
                  backgroundColor: opt.value === value ? 'rgba(255,255,255,0.02)' : 'transparent'
                }}
              >
                {opt.label}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    if (latest > previous && latest > 150) {
      setHidden(true);
    } else {
      setHidden(false);
    }
    setScrolled(latest > 50);
  });

  return (
    <div className={styles.navbarWrapper}>
      <motion.nav
        className={styles.navbar}
        variants={{
          visible: { y: 0, opacity: 1, scale: scrolled ? 0.95 : 1 },
          hidden: { y: -100, opacity: 0 }
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        style={{
          background: scrolled ? 'rgba(10,10,10,0.85)' : 'transparent',
          borderColor: scrolled ? 'rgba(255,255,255,0.05)' : 'transparent',
          boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
        }}
      >
        <div className={styles.container}>
          <NavLink to="/" className={styles.logo}>
            <span className="highlight" style={{ color: 'var(--color-accent-primary)' }}>Apex</span>Grid
          </NavLink>
          <div className={styles.links}>
            <NavLink to="/drivers" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>Drivers</NavLink>
            <NavLink to="/teams" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>Teams</NavLink>
            <NavLink to="/events" className={({ isActive }) => isActive ? styles.activeLink : styles.link}>Events</NavLink>
          </div>
        </div>
      </motion.nav>
    </div>
  );
}

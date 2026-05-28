import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    if (latest > previous && latest > 150) {
      setHidden(true);
      setMobileOpen(false); // Auto close mobile menu if scrolling down
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
          hidden: { y: -100, opacity: 0 },
        }}
        animate={hidden ? "hidden" : "visible"}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        style={{
          background: scrolled ? "rgba(10,10,10,0.85)" : "transparent",
          borderColor: scrolled ? "rgba(255,255,255,0.05)" : "transparent",
          boxShadow: scrolled ? "0 10px 30px rgba(0,0,0,0.5)" : "none",
        }}
      >
        <div className={styles.container}>
          <NavLink to="/" className={styles.logo}>
            <span
              className="highlight"
              style={{ color: "var(--color-accent-primary)" }}
            >
              Apex
            </span>
            Grid
          </NavLink>
          <div className={styles.links}>
            <NavLink
              to="/drivers"
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              Drivers
            </NavLink>
            <NavLink
              to="/teams"
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              Teams
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                isActive ? styles.activeLink : styles.link
              }
            >
              Events
            </NavLink>
          </div>
          <button
            className={styles.menuButton}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            )}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              className={styles.mobileMenu}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <div className={styles.mobileLinks}>
                <NavLink
                  to="/drivers"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    isActive ? styles.activeMobileLink : styles.mobileLink
                  }
                >
                  Drivers
                </NavLink>
                <NavLink
                  to="/teams"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    isActive ? styles.activeMobileLink : styles.mobileLink
                  }
                >
                  Teams
                </NavLink>
                <NavLink
                  to="/events"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    isActive ? styles.activeMobileLink : styles.mobileLink
                  }
                >
                  Events
                </NavLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}


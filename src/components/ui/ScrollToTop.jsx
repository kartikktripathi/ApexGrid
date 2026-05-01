import React, { useState } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import styles from './ScrollToTop.module.css';

export default function ScrollToTop() {
  const { scrollY } = useScroll();
  const [isVisible, setIsVisible] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const previous = scrollY.getPrevious();
    // Show when scrolling down and passed 150px (matching navbar disappearance)
    if (latest > previous && latest > 150) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  });

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <motion.button
      className={styles.scrollToTop}
      onClick={scrollToTop}
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ 
        opacity: isVisible ? 1 : 0, 
        y: isVisible ? 0 : 20,
        scale: isVisible ? 1 : 0.8,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      aria-label="Scroll to top"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </motion.button>
  );
}

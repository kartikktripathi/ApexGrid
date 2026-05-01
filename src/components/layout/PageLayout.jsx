import React from 'react';
import Navbar from './Navbar';
import ScrollToTop from '../ui/ScrollToTop';
import { motion } from 'framer-motion';

export default function PageLayout({ children }) {
  return (
    <>
      <Navbar />
      <motion.main
        className="page-container"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.main>
      <ScrollToTop />
    </>
  );
}

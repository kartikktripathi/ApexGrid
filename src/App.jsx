import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import PageLayout from './components/layout/PageLayout'

// Pages
import Home from './pages/Home'
import Drivers from './pages/Drivers'
import Teams from './pages/Teams'
import Seasons from './pages/Seasons'
import Sprint from './pages/Sprint'
import DriverProfile from './pages/DriverProfile'

function App() {
  return (
    <Router>
      <PageLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:driverNumber" element={<DriverProfile />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/sprint" element={<Sprint />} />
        </Routes>
      </PageLayout>
    </Router>
  )
}

export default App

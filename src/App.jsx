import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import PageLayout from "./components/layout/PageLayout";

// Pages
import Home from "./pages/Home";
import Drivers from "./pages/Drivers";
import Teams from "./pages/Teams";
import TeamProfile from "./pages/TeamProfile";
import Events from "./pages/Events";
import DriverProfile from "./pages/DriverProfile";

function App() {
  return (
    <Router>
      <PageLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:driverSlug" element={<DriverProfile />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/teams/:teamSlug" element={<TeamProfile />} />
          <Route path="/events" element={<Events />} />
          <Route path="/seasons" element={<Navigate to="/events" replace />} />
          <Route path="/sprint" element={<Navigate to="/events" replace />} />
        </Routes>
      </PageLayout>
    </Router>
  );
}

export default App;

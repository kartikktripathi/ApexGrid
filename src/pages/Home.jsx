import React, { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { f1Api } from "../utils/api";

const HERO_IMG = "./frontBG.png";

// Using real data from the API, starting with empty states
export default function Home() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [races, setRaces] = useState([]);
  const [nextEvent, setNextEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    let isMounted = true;
    let timerId = null;

    const loadData = async () => {
      let hasError = false;

      // 1. Fetch Drivers
      try {
        const [d, allDrivers] = await Promise.all([
          f1Api.getChampionshipDrivers("latest"),
          f1Api.getDrivers("latest"),
        ]);

        if (d && d.length > 0 && allDrivers && allDrivers.length > 0) {
          const sorted = d
            .sort((a, b) => b.points_current - a.points_current)
            .slice(0, 5)
            .map((driver) => {
              const driverInfo =
                allDrivers.find(
                  (x) => x.driver_number === driver.driver_number,
                ) || {};
              return {
                driver_number: driver.driver_number,
                full_name: driverInfo.full_name || "Unknown Driver",
                team_name: driverInfo.team_name || "Unknown Team",
                points: driver.points_current,
                color: driverInfo.team_colour
                  ? `#${driverInfo.team_colour}`
                  : "#ffffff",
              };
            });
          if (isMounted) setDrivers(sorted);
        } else {
          hasError = true;
        }
      } catch (err) {
        console.error("Failed to load driver API data:", err);
        hasError = true;
      }

      // 2. Fetch Calendar & Next Race
      try {
        const now = new Date();
        let currentYear = now.getFullYear();
        let meetingsData = await f1Api.getMeetings(currentYear).catch(() => []);
        let activeYear = currentYear;

        if (!meetingsData || meetingsData.length === 0) {
          meetingsData = await f1Api.getMeetings(2024).catch(() => []);
          activeYear = 2024;
        }

        if (meetingsData && meetingsData.length > 0) {
          // Fetch races and sprints for active year to determine the next upcoming event
          const racesData = await f1Api
            .getSessions(activeYear, "Race")
            .catch(() => []);
          const sprintsData = await f1Api
            .getSessions(activeYear, "Sprint")
            .catch(() => []);

          const validMeetings = meetingsData.filter(
            (m) => m.meeting_name !== "Pre-Season Testing",
          );
          const sprintMeetings = validMeetings.filter((m) =>
            sprintsData.some((s) => s.meeting_key === m.meeting_key),
          );

          const sortedM = [...validMeetings]
            .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
            .map((m, i) => ({
              round: i + 1,
              country: m.country_name,
              circuit: m.circuit_short_name || m.location,
              date: new Date(m.date_start).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              rawDate: new Date(m.date_start),
              image: m.circuit_image,
            }));

          let upcoming = sortedM.filter((m) => {
            const virtualDate = new Date(m.rawDate);
            virtualDate.setFullYear(now.getFullYear());
            return virtualDate >= now;
          });

          if (upcoming.length === 0) upcoming = sortedM.slice(-5);
          else upcoming = upcoming.slice(0, 5);

          if (isMounted) setRaces(upcoming);

          // Calculate Next Event
          const thresholdTime = now.getTime() - 2 * 60 * 60 * 1000;
          const futureSessions = [];

          // Race sessions
          racesData.forEach((session) => {
            const sessionStart = new Date(session.date_start).getTime();
            if (sessionStart > thresholdTime) {
              const meeting = validMeetings.find(
                (m) => m.meeting_key === session.meeting_key,
              );
              if (meeting) {
                futureSessions.push({
                  type: "Grand Prix",
                  date: new Date(session.date_start),
                  session,
                  meeting,
                  index: validMeetings.findIndex(
                    (m) => m.meeting_key === session.meeting_key,
                  ),
                });
              }
            }
          });

          // Sprint sessions
          sprintsData.forEach((session) => {
            const sessionStart = new Date(session.date_start).getTime();
            if (sessionStart > thresholdTime) {
              const meeting = validMeetings.find(
                (m) => m.meeting_key === session.meeting_key,
              );
              if (meeting) {
                futureSessions.push({
                  type: "Sprint Race",
                  date: new Date(session.date_start),
                  session,
                  meeting,
                  index: sprintMeetings.findIndex(
                    (m) => m.meeting_key === session.meeting_key,
                  ),
                });
              }
            }
          });

          futureSessions.sort((a, b) => a.date - b.date);

          let resolvedNextEvent = null;
          if (futureSessions.length > 0) {
            resolvedNextEvent = futureSessions[0];
          } else {
            const fallbackGpIndex = validMeetings.findIndex(
              (m) => new Date(m.date_end) > now,
            );
            if (fallbackGpIndex !== -1) {
              const meeting = validMeetings[fallbackGpIndex];
              const session = racesData.find(
                (s) => s.meeting_key === meeting.meeting_key,
              );
              resolvedNextEvent = {
                type: "Grand Prix",
                date: new Date(meeting.date_start),
                session,
                meeting,
                index: fallbackGpIndex,
              };
            }
          }

          if (isMounted) setNextEvent(resolvedNextEvent);
        } else {
          hasError = true;
        }
      } catch (err) {
        console.error("Failed to load calendar API data:", err);
        hasError = true;
      }

      if (isMounted) {
        if (hasError) {
          timerId = setTimeout(loadData, 10000);
        } else {
          setLoading(false);
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
    <div
      ref={containerRef}
      style={{
        background: "var(--color-bg-base)",
        minHeight: "100vh",
        width: "100vw",
        left: "50%",
        right: "50%",
        marginLeft: "-50vw",
        marginRight: "-50vw",
        position: "relative",
      }}
    >
      {/* 1. HERO SECTION */}
      <HeroSection
        scrollYProgress={scrollYProgress}
        onExplore={() => navigate("/events")}
      />

      {/* NEXT DESTINATION SECTION */}
      {loading ? (
        <NextRaceSkeleton />
      ) : (
        nextEvent && (
          <NextRaceSection nextEvent={nextEvent} navigate={navigate} />
        )
      )}

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
    <div
      style={{
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          top: "-10%",
          left: 0,
          right: 0,
          bottom: "-10%",
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          y,
          zIndex: 0,
          filter: "brightness(0.6) contrast(1.1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50vh",
          background:
            "linear-gradient(to top, var(--color-bg-base), transparent)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "0 5vw",
          display: "flex",
          flexDirection: "column",
          gap: "2rem",
        }}
      >
        <motion.p
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-accent-primary)",
            fontSize: "1rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          World Championship
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontSize: "clamp(3.5rem, 8vw, 9rem)",
            lineHeight: 0.85,
            margin: 0,
            maxWidth: "1200px",
          }}
        >
          THE APEX <br />
          <span
            style={{
              color: "transparent",
              WebkitTextStroke: "1px rgba(255,255,255,0.3)",
            }}
          >
            OF MOTORSPORT
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ marginTop: "2rem" }}
        >
          <button
            onClick={onExplore}
            className="btn"
            style={{ fontSize: "0.9rem", padding: "1rem 2.5rem" }}
          >
            Explore Season
          </button>
        </motion.div>
      </div>

      <motion.div
        style={{
          opacity,
          position: "absolute",
          bottom: "4rem",
          right: "5vw",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div
          style={{
            width: "1px",
            height: "60px",
            background: "rgba(255,255,255,0.2)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ y: ["-100%", "100%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            style={{
              width: "100%",
              height: "50%",
              background: "var(--color-accent-primary)",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "0.8rem",
            letterSpacing: "0.1em",
            writingMode: "vertical-rl",
          }}
        >
          SCROLL
        </span>
      </motion.div>
    </div>
  );
}

function StandingsSection({ drivers, loading }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <section
      style={{
        padding: "10vw 5vw",
        position: "relative",
        zIndex: 2,
        background: "var(--color-bg-base)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "5rem",
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: "2rem",
        }}
      >
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: 0 }}>
          Driver
          <br />
          <span style={{ color: "var(--color-text-secondary)" }}>
            Standings
          </span>
        </h2>
      </div>

      {loading || drivers.length === 0 ? (
        <StandingsSkeleton />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                display: "flex",
                alignItems: "center",
                padding: "1.5rem 2rem",
                background:
                  hoveredIndex === i ? "var(--color-bg-panel)" : "transparent",
                border: "1px solid",
                borderColor:
                  hoveredIndex === i
                    ? "var(--color-border-hover)"
                    : "transparent",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                transition: "all var(--transition-fast)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Team Color Bar */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  background: d.color,
                  transform: hoveredIndex === i ? "scaleY(1)" : "scaleY(0)",
                  transition: "transform var(--transition-fast)",
                  transformOrigin: "center",
                }}
              />

              <div
                style={{
                  flex: "0 0 60px",
                  fontFamily: "var(--font-heading)",
                  fontSize: "2rem",
                  color:
                    hoveredIndex === i
                      ? "var(--color-text-primary)"
                      : "var(--color-text-muted)",
                  fontWeight: 600,
                }}
              >
                0{i + 1}
              </div>

              <div
                style={{ flex: "1", display: "flex", flexDirection: "column" }}
              >
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                  }}
                >
                  {d.full_name}
                </span>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {d.team_name}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "2rem",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 600,
                    color:
                      hoveredIndex === i
                        ? "var(--color-accent-primary)"
                        : "var(--color-text-primary)",
                  }}
                >
                  {d.points}
                </span>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--color-text-muted)",
                    paddingBottom: "0.4rem",
                  }}
                >
                  PTS
                </span>
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
    <section
      style={{ padding: "10vw 5vw", background: "var(--color-bg-base)" }}
    >
      <div style={{ maxWidth: "800px" }}>
        <h2
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginBottom: "4rem" }}
        >
          Race{" "}
          <span style={{ color: "var(--color-text-secondary)" }}>Calendar</span>
        </h2>

        {loading || races.length === 0 ? (
          <CalendarSkeleton />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {races.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--color-border)",
                  padding: "2rem 0",
                  gap: "3rem",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    flex: "0 0 100px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--color-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Round {r.round}
                  </span>
                  <span
                    style={{
                      fontSize: "1.2rem",
                      color: "var(--color-text-primary)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 600,
                      marginTop: "0.5rem",
                    }}
                  >
                    {r.date}
                  </span>
                </div>

                <div
                  style={{
                    flex: 1,
                    borderLeft: "1px solid rgba(255,255,255,0.05)",
                    paddingLeft: "3rem",
                    zIndex: 1,
                  }}
                >
                  <h4 style={{ fontSize: "1.8rem", margin: "0 0 0.5rem 0" }}>
                    {r.country}
                  </h4>
                  <p
                    style={{
                      color: "var(--color-text-secondary)",
                      margin: 0,
                      fontSize: "0.9rem",
                    }}
                  >
                    {r.circuit}
                  </p>
                </div>

                {/* Dynamic Circuit Figure fetched from API */}
                {r.image && (
                  <div
                    style={{
                      position: "absolute",
                      right: "0",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "150px",
                      height: "100%",
                      backgroundImage: `url(${r.image})`,
                      backgroundSize: "contain",
                      backgroundPosition: "right center",
                      backgroundRepeat: "no-repeat",
                      filter: "invert(1) opacity(0.2)",
                      pointerEvents: "none",
                      zIndex: 0,
                    }}
                  />
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
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "1.5rem 2rem",
            border: "1px solid transparent",
            borderRadius: "var(--radius-md)",
            position: "relative",
            overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "50%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              zIndex: 1,
            }}
          />
          <div style={{ flex: "0 0 60px" }}>
            <div
              style={{
                width: "40px",
                height: "30px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
          </div>
          <div
            style={{
              flex: "1",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "150px",
                height: "24px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
            <div
              style={{
                width: "100px",
                height: "14px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
          </div>
          <div
            style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}
          >
            <div
              style={{
                width: "50px",
                height: "30px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          key={item}
          style={{
            display: "flex",
            borderBottom: "1px solid var(--color-border)",
            padding: "2rem 0",
            gap: "3rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ x: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "50%",
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent)",
              zIndex: 1,
            }}
          />
          <div
            style={{
              flex: "0 0 100px",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "60px",
                height: "12px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
            <div
              style={{
                width: "80px",
                height: "20px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
          </div>
          <div
            style={{
              flex: 1,
              borderLeft: "1px solid rgba(255,255,255,0.05)",
              paddingLeft: "3rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                width: "200px",
                height: "28px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
            <div
              style={{
                width: "150px",
                height: "16px",
                background: "rgba(255,255,255,0.1)",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        padding: "4rem 5vw",
        background: "#000",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "2rem",
      }}
    >
      <div>
        <h2
          style={{
            fontSize: "1.5rem",
            margin: 0,
            fontFamily: "var(--font-heading)",
          }}
        >
          <span style={{ color: "var(--color-accent-primary)" }}>APEX</span>GRID
        </h2>
      </div>
      <div
        style={{
          display: "flex",
          gap: "2rem",
          fontSize: "0.8rem",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-heading)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        <span>Non-commercial conceptual design</span>
      </div>
    </footer>
  );
}

function NextRaceSection({ nextEvent, navigate }) {
  const [timeLeft, setTimeLeft] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!nextEvent?.session?.date_start) return;

    const parseUtcDate = (dateStr) => {
      if (!dateStr) return null;
      let formatted = dateStr;
      if (
        !dateStr.endsWith("Z") &&
        !dateStr.includes("+") &&
        !dateStr.match(/-\d{2}:\d{2}$/)
      ) {
        formatted = dateStr + "Z";
      }
      return new Date(formatted);
    };

    const targetDate = parseUtcDate(nextEvent.session.date_start);
    if (!targetDate || isNaN(targetDate.getTime())) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate - now;

      // 2 hours in ms = 2 * 60 * 60 * 1000 = 7,200,000
      if (difference <= 0) {
        if (difference >= -7200000) {
          return {
            total: difference,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isLive: true,
            isOver: false,
          };
        } else {
          return {
            total: difference,
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isLive: false,
            isOver: true,
          };
        }
      }

      return {
        total: difference,
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isLive: false,
        isOver: false,
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [nextEvent]);

  if (!nextEvent) return null;

  const meeting = nextEvent.meeting;

  const startDate = new Date(meeting.date_start).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
  const endDate = new Date(meeting.date_end).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section
      onClick={() => navigate("/events")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: "10vw 5vw",
        position: "relative",
        zIndex: 2,
        background: "var(--color-bg-base)",
        borderBottom: "1px solid var(--color-border)",
        cursor: "pointer",
      }}
    >
      {/* Background Ambient Glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "10%",
          width: "300px",
          height: "300px",
          background: "var(--color-accent-primary)",
          filter: "blur(160px)",
          opacity: 0.08,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "3rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left column: Title */}
        <div style={{ flex: "0 0 250px" }}>
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              margin: 0,
              fontFamily: "var(--font-heading)",
              textTransform: "uppercase",
              lineHeight: 0.9,
            }}
          >
            Next
            <br />
            <span style={{ color: "var(--color-accent-primary)" }}>
              Destination
            </span>
          </h2>
          <div
            style={{
              marginTop: "2rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background:
                nextEvent.type === "Sprint Race"
                  ? "linear-gradient(90deg, #ff8000, #ff4000)"
                  : "var(--color-accent-primary)",
              color: "#fff",
              padding: "0.3rem 0.8rem",
              borderRadius: "4px",
              fontFamily: "var(--font-heading)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              fontSize: "0.75rem",
              textTransform: "uppercase",
            }}
          >
            {nextEvent.type}
          </div>
        </div>

        {/* Center/Right column: Event info & countdown */}
        <div
          style={{
            flex: "1",
            minWidth: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "2.5rem",
          }}
        >
          {/* Circuit details */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "1rem",
              }}
            >
              <img
                src={meeting.country_flag}
                alt={meeting.country_name}
                style={{
                  width: "45px",
                  borderRadius: "3px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "1.1rem",
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.05em",
                }}
              >
                {startDate} - {endDate}
              </span>
            </div>

            <h3
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4.5rem)",
                fontFamily: "var(--font-heading)",
                margin: 0,
                lineHeight: 1,
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              {(meeting.meeting_official_name || meeting.meeting_name || "")
                .replace(/formula 1/gi, "")
                .replace(/\s{2,}/g, " ")
                .trim()}
            </h3>

            <p
              style={{
                color: "var(--color-text-secondary)",
                margin: "0.8rem 0 0 0",
                fontSize: "1.2rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {meeting.circuit_short_name} •{" "}
              <span style={{ color: "var(--color-text-muted)" }}>
                {meeting.location}, {meeting.country_name}
              </span>
            </p>
          </div>

          {/* Countdown Clock */}
          {timeLeft && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.2em",
                  fontWeight: 600,
                }}
              >
                RACE COUNTDOWN
              </div>

              {timeLeft.isLive ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "2rem",
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-accent-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    🏎️ RACE IS LIVE
                  </div>
                  <div
                    style={{
                      fontSize: "1.5rem",
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-accent-primary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 600,
                    }}
                  >
                    LIGHTS OUT! RACING ON!
                  </div>
                </div>
              ) : timeLeft.isOver ? (
                <div
                  style={{
                    fontSize: "1.8rem",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Session Completed
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                  }}
                >
                  {/* Days */}
                  <span
                    style={{
                      fontSize: "clamp(3.5rem, 8vw, 6rem)",
                      fontFamily: "var(--font-heading)",
                      color: "#fff",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {String(timeLeft.days).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "1.2rem",
                      color: "var(--color-text-secondary)",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-body)",
                      marginRight: "2rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    d
                  </span>

                  {/* Hours */}
                  <span
                    style={{
                      fontSize: "clamp(3.5rem, 8vw, 6rem)",
                      fontFamily: "var(--font-heading)",
                      color: "#fff",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "1.2rem",
                      color: "var(--color-text-secondary)",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-body)",
                      marginRight: "2rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    h
                  </span>

                  {/* Minutes */}
                  <span
                    style={{
                      fontSize: "clamp(3.5rem, 8vw, 6rem)",
                      fontFamily: "var(--font-heading)",
                      color: "#fff",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "1.2rem",
                      color: "var(--color-text-secondary)",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-body)",
                      marginRight: "2rem",
                      letterSpacing: "0.05em",
                    }}
                  >
                    m
                  </span>

                  {/* Seconds */}
                  <span
                    style={{
                      fontSize: "clamp(3.5rem, 8vw, 6rem)",
                      fontFamily: "var(--font-heading)",
                      color: "var(--color-accent-primary)",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: "1.2rem",
                      color: "var(--color-accent-primary)",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-body)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    s
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Interactive Arrow CTA Link */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "0.9rem",
              color: isHovered ? "#fff" : "var(--color-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              fontFamily: "var(--font-heading)",
              marginTop: "1rem",
              transition: "color 0.2s ease-out",
            }}
          >
            <span>View Full Weekend Schedule & Classification</span>
            <span
              style={{
                color: "var(--color-accent-primary)",
                transform: isHovered ? "translateX(6px)" : "translateX(0)",
                transition: "transform 0.2s ease-out",
              }}
            >
              →
            </span>
          </div>
        </div>
      </div>

      {/* Styled circuit background watermark */}
      {meeting.circuit_image && (
        <div
          style={{
            position: "absolute",
            right: "5%",
            bottom: "5%",
            width: "350px",
            height: "250px",
            backgroundImage: `url(${meeting.circuit_image})`,
            backgroundSize: "contain",
            backgroundPosition: "right bottom",
            backgroundRepeat: "no-repeat",
            filter: "invert(1) opacity(0.04)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}
    </section>
  );
}

function NextRaceSkeleton() {
  return (
    <section
      style={{
        padding: "10vw 5vw",
        position: "relative",
        zIndex: 2,
        background: "var(--color-bg-base)",
        borderBottom: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "3rem",
        }}
      >
        {/* Left column: Title Skeleton */}
        <div
          style={{
            flex: "0 0 250px",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              width: "150px",
              height: "40px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "4px",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              }}
            />
          </div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              width: "90px",
              height: "24px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "4px",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              }}
            />
          </div>
        </div>

        {/* Right column: Event Details & Countdown Skeleton */}
        <div
          style={{
            flex: "1",
            minWidth: "320px",
            display: "flex",
            flexDirection: "column",
            gap: "2.5rem",
          }}
        >
          {/* Circuit Details Skeleton */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {/* flag & date */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  width: "45px",
                  height: "30px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "3px",
                }}
              >
                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                  }}
                />
              </div>
              <div
                style={{
                  position: "relative",
                  overflow: "hidden",
                  width: "180px",
                  height: "20px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: "4px",
                }}
              >
                <motion.div
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                  }}
                />
              </div>
            </div>
            {/* main title */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                width: "80%",
                height: "50px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "4px",
              }}
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                }}
              />
            </div>
            {/* circuit details line */}
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                width: "60%",
                height: "20px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "4px",
              }}
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                }}
              />
            </div>
          </div>

          {/* Countdown Clock Skeleton */}
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                width: "120px",
                height: "14px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "4px",
              }}
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                }}
              />
            </div>

            <div
              style={{ display: "flex", gap: "2rem", alignItems: "baseline" }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "baseline",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      width: "80px",
                      height: "70px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "6px",
                    }}
                  >
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "linear",
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      position: "relative",
                      overflow: "hidden",
                      width: "15px",
                      height: "18px",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "3px",
                    }}
                  >
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                        ease: "linear",
                      }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

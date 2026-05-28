import React from "react";
import { motion } from "framer-motion";

export default function LoadingState({ message = "Loading..." }) {
  return (
    <div style={{ padding: "2rem 0", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            style={{
              background: "var(--color-bg-elevated)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(255,255,255,0.05)",
              minHeight: "280px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <motion.div
              animate={{
                x: ["-100%", "200%"],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "linear",
              }}
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
            {/* Header skeleton */}
            <div
              style={{
                height: "80px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: "rgba(0,0,0,0.2)",
                padding: "1.5rem 2.5rem",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "150px",
                  height: "20px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                }}
              />
            </div>
            {/* Body skeleton */}
            <div style={{ padding: "2.5rem", display: "flex", gap: "2rem" }}>
              <div
                style={{
                  flex: "0 0 120px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "40px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                />
                <div
                  style={{
                    width: "80px",
                    height: "30px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                />
                <div
                  style={{
                    width: "80px",
                    height: "30px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div
                  style={{
                    width: "70%",
                    height: "40px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                />
                <div
                  style={{
                    width: "40%",
                    height: "20px",
                    background: "rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          textAlign: "center",
          marginTop: "2rem",
          color: "var(--color-text-muted)",
        }}
      >
        <p
          className="text-muted"
          style={{
            fontFamily: "var(--font-heading)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}

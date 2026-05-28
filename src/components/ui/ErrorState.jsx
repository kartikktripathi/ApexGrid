import React from "react";

export default function ErrorState({
  message = "An error occurred.",
  onRetry,
}) {
  return (
    <div className="state-container">
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
      <p style={{ color: "#e10600", marginBottom: "1.5rem", fontWeight: 500 }}>
        {message}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="btn">
          Retry Connection
        </button>
      )}
    </div>
  );
}

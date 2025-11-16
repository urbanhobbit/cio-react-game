import React from "react";
import FullGame from "./components/FullGame.jsx";

const styles = {
  appRoot: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#111827",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  gameContainer: {
    width: 1120,
    maxWidth: "100%",
    minHeight: 620,
    border: "2px solid #374151",
    boxShadow: "0 0 20px rgba(0, 255, 255, 0.3)",
    background: "#020617",
    color: "#f9fafb",
    padding: "16px 24px",
    boxSizing: "border-box",
  },
};

function App() {
  return (
    <div style={styles.appRoot}>
      <div style={styles.gameContainer}>
        <FullGame />
      </div>
    </div>
  );
}

export default App;

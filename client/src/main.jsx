// Whispr client entry.
window.__whispr = { version: 3.1 }; // version stamp — check in console: window.__whispr.version

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WhisprProvider } from "./store";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WhisprProvider>
      <App />
    </WhisprProvider>
  </React.StrictMode>
);

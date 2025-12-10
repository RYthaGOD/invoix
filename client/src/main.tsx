// Polyfills for browser environment
import { Buffer } from "buffer";
// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = window.process || { env: {} };

// Remote Error Logging (Temporary Debugging)
window.onerror = function (msg, url, line, col, error) {
    const errorDetails = `${msg} at ${line}:${col}`;
    // Send error to server via URL path for visibility in server logs
    fetch(`/api/log-client-error/${encodeURIComponent(errorDetails.substring(0, 200))}`);
    return false;
};

// Log unhandled promise rejections too
window.onunhandledrejection = function (event) {
    const msg = event.reason ? event.reason.message || event.reason : 'Unknown Promise Error';
    fetch(`/api/log-client-error/Promise:${encodeURIComponent(String(msg).substring(0, 200))}`);
};

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Polyfills for browser environment
import { Buffer } from "buffer";
// @ts-ignore
window.Buffer = Buffer;
// @ts-ignore
window.process = window.process || { env: {} };

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

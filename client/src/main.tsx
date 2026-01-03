import "./polyfills";
import { createRoot } from "react-dom/client";
import { initFrontendSentry } from "@/lib/sentry";
import App from "./App";
import "./index.css";

// Initialize Monitoring
initFrontendSentry();

createRoot(document.getElementById("root")!).render(<App />);

console.log("🚀 App initializing - v1.0.1");
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

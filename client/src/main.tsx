
import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/shiny-button.css";

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { Overlay } from "./Overlay";
import "./overlay.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Overlay root is missing");
}

createRoot(root).render(<Overlay />);

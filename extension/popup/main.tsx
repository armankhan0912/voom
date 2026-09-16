import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "./popup.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Popup root is missing");
}

createRoot(root).render(<Popup />);

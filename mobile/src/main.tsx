import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installDynamicType } from "./dynamic-type";

// Honour the iOS system text size (no-op elsewhere); see dynamic-type.ts.
installDynamicType();

createRoot(document.getElementById("root")!).render(<App />);

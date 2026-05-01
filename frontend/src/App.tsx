import { useCallback, useState } from "react";

import { SplashScreen } from "./screens/SplashScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { SpotVisualizationScreen } from "./screens/SpotVisualizationScreen";
import { INITIAL_SCREEN, type Screen } from "./lib/navigation";

/**
 * Top-level screen router.
 *
 * Phase 4 will grow into:
 *   splash → home → garage_overview → spot_visualization → navigation → parked
 *
 * Step 2 wires Splash → Home → SpotVisualization. Garage Overview, Navigation,
 * and Parked are not yet built; their Screen kinds short-circuit to the
 * spot visualization screen so the demo never lands on a blank page.
 */
function App() {
  const [screen, setScreen] = useState<Screen>(INITIAL_SCREEN);

  const handleSplashDone = useCallback(() => {
    setScreen({ kind: "home" });
  }, []);

  const handleSelectGarage = useCallback(() => {
    setScreen({ kind: "spot_visualization" });
  }, []);

  return (
    <div className="app-shell">
      {screen.kind === "splash" && <SplashScreen onDone={handleSplashDone} />}
      {screen.kind === "home" && (
        <HomeScreen onSelectGarage={handleSelectGarage} />
      )}
      {screen.kind !== "splash" && screen.kind !== "home" && (
        <SpotVisualizationScreen />
      )}
    </div>
  );
}

export default App;

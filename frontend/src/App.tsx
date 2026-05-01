import { useCallback, useState } from "react";

import { SplashScreen } from "./screens/SplashScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { GarageOverviewScreen } from "./screens/GarageOverviewScreen";
import { NavigationScreen } from "./screens/NavigationScreen";
import { ParkedConfirmationScreen } from "./screens/ParkedConfirmationScreen";
import { SpotVisualizationScreen } from "./screens/SpotVisualizationScreen";
import { INITIAL_SCREEN, type Screen } from "./lib/navigation";

/**
 * Top-level screen router.
 *
 * Phase 4 flow:
 *   splash → home → garage_overview → spot_visualization → navigation → parked
 *
 * Step 5 wires Splash → Home → GarageOverview → Navigation → ParkedConfirmation,
 * with Garage Overview's "View Spot Map" still routing to Spot Visualization.
 */
function App() {
  const [screen, setScreen] = useState<Screen>(INITIAL_SCREEN);

  const goHome = useCallback(() => setScreen({ kind: "home" }), []);
  const goOverview = useCallback(
    () => setScreen({ kind: "garage_overview" }),
    [],
  );
  const goSpotViz = useCallback(
    () => setScreen({ kind: "spot_visualization" }),
    [],
  );
  const goNavigation = useCallback(() => {
    // Navigation kind requires a spotId in the union; we use a placeholder
    // until SpotVisualization → Navigation hand-off lands. NavigationScreen
    // independently picks the first available spot via /demo/occupancy.
    setScreen({ kind: "navigation", spotId: "" });
  }, []);
  const goParked = useCallback(() => {
    setScreen({ kind: "parked", spotId: "" });
  }, []);

  return (
    <div className="app-shell">
      {screen.kind === "splash" && <SplashScreen onDone={goHome} />}
      {screen.kind === "home" && <HomeScreen onSelectGarage={goOverview} />}
      {screen.kind === "garage_overview" && (
        <GarageOverviewScreen
          onBack={goHome}
          onViewSpotMap={goSpotViz}
          onNavigate={goNavigation}
        />
      )}
      {screen.kind === "navigation" && (
        <NavigationScreen
          onBack={goOverview}
          onCancel={goHome}
          onParked={goParked}
        />
      )}
      {screen.kind === "parked" && (
        <ParkedConfirmationScreen onBackToMap={goHome} />
      )}
      {screen.kind === "spot_visualization" && <SpotVisualizationScreen />}
    </div>
  );
}

export default App;

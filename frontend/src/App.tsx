import { useCallback, useState } from "react";

import { SplashScreen } from "./screens/SplashScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { GarageOverviewScreen } from "./screens/GarageOverviewScreen";
import { NavigationScreen } from "./screens/NavigationScreen";
import { ParkedConfirmationScreen } from "./screens/ParkedConfirmationScreen";
import { SpotVisualizationScreen } from "./screens/SpotVisualizationScreen";
import { INITIAL_SCREEN, type Screen } from "./lib/navigation";
import type { SelectedSpot } from "./lib/occupancyCache";
import type { Spot } from "./lib/types";

/**
 * Top-level screen router + selected-spot hand-off.
 *
 * Flow:
 *   splash → home → garage_overview ─┬─ view_spot_map → spot_visualization
 *                                    └─ navigate ─────→ navigation
 *                                                       │   ↑ back
 *                                                       │   └── garage_overview
 *                                                       │
 *   spot_visualization ── confirm spot ──→ navigation (with preselected spot)
 *   navigation ──── i've parked ────────→ parked (with preselected spot)
 *
 * `selectedSpot` lives in App state and is threaded into NavigationScreen
 * and ParkedConfirmationScreen as `preselectedSpot`. It is set when the
 * user confirms a spot in Spot Visualization, preserved across the
 * Navigation → Parked transition, and cleared whenever the user backs
 * out of the flow (Home / Overview / fresh entries to Spot Viz or the
 * generic "Navigate" from Overview).
 */
function App() {
  const [screen, setScreen] = useState<Screen>(INITIAL_SCREEN);
  const [selectedSpot, setSelectedSpot] = useState<SelectedSpot | null>(null);

  const goHome = useCallback(() => {
    setSelectedSpot(null);
    setScreen({ kind: "home" });
  }, []);

  const goOverview = useCallback(() => {
    setSelectedSpot(null);
    setScreen({ kind: "garage_overview" });
  }, []);

  const goSpotViz = useCallback(() => {
    // Fresh visit to Spot Viz — clear any prior selection so back-out
    // and re-entry behaves like a clean session.
    setSelectedSpot(null);
    setScreen({ kind: "spot_visualization" });
  }, []);

  const goNavigation = useCallback(() => {
    // Generic "Navigate" from Garage Overview — no specific spot selected.
    setSelectedSpot(null);
    setScreen({ kind: "navigation" });
  }, []);

  /** Hand-off from SpotVisualization → Navigation with a chosen spot. */
  const goNavigationWithSpot = useCallback((spot: Spot) => {
    setSelectedSpot({ label: spot.label, level: spot.level });
    setScreen({ kind: "navigation" });
  }, []);

  /** Navigation → Parked. Preserve `selectedSpot` so Parked can show
   *  the same spot the user was navigating to. */
  const goParked = useCallback(() => {
    setScreen({ kind: "parked" });
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

      {screen.kind === "spot_visualization" && (
        <SpotVisualizationScreen
          onBack={goOverview}
          onStartNavigation={goNavigationWithSpot}
        />
      )}

      {screen.kind === "navigation" && (
        <NavigationScreen
          onBack={goOverview}
          onCancel={goHome}
          onParked={goParked}
          preselectedSpot={selectedSpot ?? undefined}
        />
      )}

      {screen.kind === "parked" && (
        <ParkedConfirmationScreen
          onBackToMap={goHome}
          preselectedSpot={selectedSpot ?? undefined}
        />
      )}
    </div>
  );
}

export default App;

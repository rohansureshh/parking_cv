/**
 * Screen-level routing for the SwiftPark demo flow.
 *
 * The full target flow is:
 *   splash → home → garage_overview → spot_visualization → navigation → parked
 *
 * Screens not yet implemented are still part of the union so call sites can
 * be added incrementally without re-typing the router. Until those screens
 * exist, the router falls through to spot_visualization.
 */
export type Screen =
  | { kind: "splash" }
  | { kind: "home" }
  | { kind: "garage_overview" }
  | { kind: "spot_visualization" }
  | { kind: "navigation"; spotId: string }
  | { kind: "parked"; spotId: string };

export const INITIAL_SCREEN: Screen = { kind: "splash" };

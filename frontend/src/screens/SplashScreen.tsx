import { useEffect } from "react";

interface SplashScreenProps {
  onDone: () => void;
  /** Auto-advance delay (ms). Defaults to 2000. */
  durationMs?: number;
}

/**
 * SwiftPark splash.
 *
 * Composition (top → bottom):
 *   1. Logo mark — three blue motion lines + the SwiftPark P-pin.
 *   2. "SwiftPark" wordmark with brand split (Swift dark, Park blue).
 *   3. "Stress less. Park better." tagline.
 *   4. Scene illustration — soft city silhouette, perspective road with
 *      dashed center line, and a sleek blue sedan in rear-view.
 *   5. Loader — circular spinner + "Detecting your location…" + a thin
 *      progress bar pinned to the bottom of the splash that fills over
 *      the splash duration.
 *
 * The scene is one SVG so the road naturally clips the city behind it,
 * which mirrors the brand mockup (buildings visible on the sides of the
 * road only).
 */
export function SplashScreen({ onDone, durationMs = 2000 }: SplashScreenProps) {
  useEffect(() => {
    const id = window.setTimeout(onDone, durationMs);
    return () => window.clearTimeout(id);
  }, [onDone, durationMs]);

  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash__inner">
        <SwiftParkLogoMark />

        <div className="splash__wordmark">
          <span className="swift">Swift</span>
          <span className="park">Park</span>
        </div>
        <div className="splash__tagline">Stress less. Park better.</div>

        <div className="splash__scene" aria-hidden="true">
          <SplashScene />
        </div>

        <div className="splash__loader" aria-label="Detecting your location">
          <div className="splash__spinner" />
          <div className="splash__loader-text">Detecting your location…</div>
        </div>
      </div>

      <div className="splash__progress" aria-hidden="true">
        <div
          className="splash__progress-bar"
          style={{ animationDuration: `${durationMs}ms` }}
        />
      </div>
    </div>
  );
}

function SwiftParkLogoMark() {
  return (
    <svg
      className="splash__logo"
      viewBox="0 0 130 70"
      aria-hidden="true"
    >
      {/* Motion lines — gentle stagger, brand blue, rounded ends. */}
      <path
        d="M 10 22 L 46 22"
        stroke="#2563eb"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 6 35 L 46 35"
        stroke="#2563eb"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 10 48 L 46 48"
        stroke="#2563eb"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Pin */}
      <g transform="translate(54, 4)">
        <path
          d="M 26 0 C 16 0 8 8 8 18 c 0 13.5 18 38 18 38 s 18 -24.5 18 -38 C 44 8 36 0 26 0 z"
          fill="#2563eb"
        />
        <circle cx="26" cy="18" r="11" fill="white" />
        <text
          x="26"
          y="22.6"
          textAnchor="middle"
          fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
          fontWeight="900"
          fontSize="13.5"
          fill="#2563eb"
        >
          P
        </text>
      </g>
    </svg>
  );
}

function SplashScene() {
  return (
    <svg
      className="splash__scene-svg"
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <defs>
        {/* Road — top-to-bottom: lifts toward horizon (atmospheric perspective),
            settles slightly cooler near the viewer for depth. */}
        <linearGradient id="splash-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="55%" stopColor="#e1e7ef" />
          <stop offset="100%" stopColor="#cdd6e3" />
        </linearGradient>

        {/* Three-stop body gradient: light sky-tint at the roof, brand blue
            mid, deep navy under the bumper — reads as paint, not flat fill. */}
        <linearGradient id="splash-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="38%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>

        {/* Glass — slight gradient so it reads as tinted glass, not black hole. */}
        <linearGradient id="splash-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>

        {/* Warm horizon glow — soft golden-hour wash behind the city.
            Provides the welcoming, "city at sunrise" mood. */}
        <linearGradient id="splash-horizon-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdba74" stopOpacity="0" />
          <stop offset="55%" stopColor="#fbbf24" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </linearGradient>

        {/* Atmospheric haze around the horizon line — softens building bases
            into the road, suggesting morning haze / depth. */}
        <linearGradient id="splash-horizon-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Road haze — lighter near the horizon end of the trapezoid only,
            so the road feels like it recedes into atmosphere. */}
        <linearGradient id="splash-road-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.55" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Warm horizon glow band — peach hint behind the skyline. */}
      <rect x="0" y="40" width="400" height="80" fill="url(#splash-horizon-warm)" />

      {/* Far hills — gentle silhouette ridges in the deep distance. */}
      <path
        d="M 0 100 Q 60 92 130 96 T 270 94 T 400 96 L 400 116 L 0 116 Z"
        fill="#dde4ed"
        opacity="0.65"
      />
      <path
        d="M 0 104 Q 80 100 160 102 T 320 102 T 400 102 L 400 116 L 0 116 Z"
        fill="#cbd5e1"
        opacity="0.4"
      />

      {/* Cityscape — varied silhouettes: rectangles, stepped, sloped, peaked,
          with subtle warm "lit window" specks for life. */}
      <g className="splash__city">
        {/* LEFT CLUSTER */}
        {/* Standard tall with antenna */}
        <rect x="14" y="70" width="20" height="38" fill="#b8c5d6" opacity="0.85" />
        <rect x="22" y="62" width="3" height="8" fill="#b8c5d6" opacity="0.85" />

        {/* Stepped Art Deco */}
        <path
          d="M 38 108 L 38 76 L 42 76 L 42 70 L 56 70 L 56 76 L 60 76 L 60 108 Z"
          fill="#b8c5d6"
          opacity="0.88"
        />

        {/* Tall slim skyscraper with thin antenna */}
        <rect x="64" y="50" width="14" height="58" fill="#b8c5d6" opacity="0.88" />
        <line x1="71" y1="50" x2="71" y2="42" stroke="#b8c5d6" strokeWidth="0.8" opacity="0.7" />

        {/* Modern slanted-roof building */}
        <path
          d="M 84 108 L 84 78 L 100 70 L 100 108 Z"
          fill="#b8c5d6"
          opacity="0.78"
        />

        {/* Pointed-top tower */}
        <path
          d="M 106 108 L 106 70 L 116 60 L 126 70 L 126 108 Z"
          fill="#b8c5d6"
          opacity="0.84"
        />

        {/* Small mid-rise */}
        <rect x="132" y="82" width="14" height="26" fill="#b8c5d6" opacity="0.7" />

        {/* RIGHT CLUSTER */}
        {/* Rounded-top building */}
        <path
          d="M 254 108 L 254 70 Q 254 64 260 64 L 270 64 Q 276 64 276 70 L 276 108 Z"
          fill="#b8c5d6"
          opacity="0.84"
        />

        {/* Tall slim with antenna */}
        <rect x="282" y="56" width="12" height="52" fill="#b8c5d6" opacity="0.88" />
        <line x1="288" y1="56" x2="288" y2="48" stroke="#b8c5d6" strokeWidth="0.8" opacity="0.7" />

        {/* Wide stepped tower */}
        <path
          d="M 300 108 L 300 78 L 308 78 L 308 70 L 322 70 L 322 78 L 330 78 L 330 108 Z"
          fill="#b8c5d6"
          opacity="0.88"
        />

        {/* Pyramid-topped */}
        <path
          d="M 336 108 L 336 76 L 350 60 L 364 76 L 364 108 Z"
          fill="#b8c5d6"
          opacity="0.84"
        />

        {/* Small mid-rise */}
        <rect x="370" y="82" width="18" height="26" fill="#b8c5d6" opacity="0.7" />

        {/* Lit windows — warm dots scattered across a few buildings to give
            the skyline life. Kept low-opacity so they read as glow, not pixels. */}
        <g fill="#fbbf24" opacity="0.55">
          {/* Skyscraper */}
          <rect x="68" y="60" width="2" height="2.5" rx="0.4" />
          <rect x="72.5" y="60" width="2" height="2.5" rx="0.4" />
          <rect x="68" y="68" width="2" height="2.5" rx="0.4" />
          <rect x="72.5" y="76" width="2" height="2.5" rx="0.4" />
          <rect x="68" y="84" width="2" height="2.5" rx="0.4" />
          <rect x="72.5" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="68" y="100" width="2" height="2.5" rx="0.4" />

          {/* Stepped art deco */}
          <rect x="46" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="50" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="46" y="94" width="2" height="2.5" rx="0.4" />
          <rect x="50" y="94" width="2" height="2.5" rx="0.4" />

          {/* Right slim tower */}
          <rect x="285" y="68" width="2" height="2.5" rx="0.4" />
          <rect x="289.5" y="68" width="2" height="2.5" rx="0.4" />
          <rect x="285" y="80" width="2" height="2.5" rx="0.4" />
          <rect x="289.5" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="285" y="100" width="2" height="2.5" rx="0.4" />

          {/* Right wide stepped */}
          <rect x="312" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="317" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="312" y="94" width="2" height="2.5" rx="0.4" />
        </g>
      </g>

      {/* Atmospheric horizon haze — softens the bases of the buildings. */}
      <rect x="0" y="92" width="400" height="22" fill="url(#splash-horizon-haze)" />

      {/* Subtle horizon hairline. */}
      <path d="M 0 108 L 400 108" stroke="#dbe2ec" strokeWidth="0.8" opacity="0.85" />

      {/* Road — perspective trapezoid. */}
      <path d="M 160 108 L 240 108 L 380 240 L 20 240 Z" fill="url(#splash-road)" />

      {/* Road atmospheric haze — lighter near the horizon end only. */}
      <path d="M 160 108 L 240 108 L 380 240 L 20 240 Z" fill="url(#splash-road-haze)" />

      {/* Soft white edge highlights. */}
      <path
        d="M 160 108 L 20 240"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 240 108 L 380 240"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Center dashed line. */}
      <path
        d="M 200 108 L 200 240"
        stroke="white"
        strokeWidth="2.4"
        strokeDasharray="6 12"
        opacity="0.92"
      />

      {/* Car — sleek modern sedan, rear view. */}
      <g transform="translate(160, 158)">
        {/* Soft red brake-light wash on the road behind the car. */}
        <ellipse cx="40" cy="48" rx="30" ry="2.8" fill="#ef4444" opacity="0.10" />

        {/* Layered ground shadow with falloff. */}
        <ellipse cx="40" cy="50" rx="40" ry="3.2" fill="#0f172a" opacity="0.14" />
        <ellipse cx="40" cy="49" rx="32" ry="2.4" fill="#0f172a" opacity="0.22" />

        {/* Wheels with rim hint. */}
        <ellipse cx="16" cy="46" rx="7" ry="4" fill="#0b1220" />
        <ellipse cx="16" cy="46" rx="2.5" ry="1.6" fill="#1e293b" />
        <ellipse cx="64" cy="46" rx="7" ry="4" fill="#0b1220" />
        <ellipse cx="64" cy="46" rx="2.5" ry="1.6" fill="#1e293b" />

        {/* Body — sleek sedan profile: wide bottom, tapered roof, smooth
            shoulder transitions via cubic bezier curves. */}
        <path
          d="M 4 38
             L 4 26
             C 4 16 14 13 22 11
             L 26 11
             C 30 8 50 8 54 11
             L 58 11
             C 66 13 76 16 76 26
             L 76 38
             Z"
          fill="url(#splash-body)"
        />

        {/* Subtle horizontal panel break — suggests trunk/rear-quarter seam. */}
        <path
          d="M 6 32 Q 40 33 74 32"
          stroke="rgba(0,0,0,0.12)"
          strokeWidth="0.5"
          fill="none"
        />

        {/* Roof sheen — bright highlight along the top of the roof curve. */}
        <path
          d="M 28 13 Q 32 11 40 11 Q 48 11 52 13"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Rear window — gradient glass. */}
        <path
          d="M 22 22 C 24 14 30 12 32 12 L 48 12 C 50 12 56 14 58 22 Z"
          fill="url(#splash-window)"
        />

        {/* Window reflections — bright streak + faint secondary. */}
        <path
          d="M 28 17 L 38 14"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <path
          d="M 44 14 L 52 17"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="0.6"
          strokeLinecap="round"
        />

        {/* Tail lights — wider, sleeker, with inner highlight. */}
        <rect x="6" y="26" width="13" height="4" rx="1.2" fill="#dc2626" />
        <rect x="7.5" y="27" width="10" height="2" rx="0.8" fill="#fca5a5" opacity="0.85" />
        <rect x="61" y="26" width="13" height="4" rx="1.2" fill="#dc2626" />
        <rect x="62.5" y="27" width="10" height="2" rx="0.8" fill="#fca5a5" opacity="0.85" />

        {/* License plate with subtle SwiftPark blue dot. */}
        <rect
          x="32"
          y="33"
          width="16"
          height="5"
          rx="0.8"
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth="0.4"
        />
        <circle cx="40" cy="35.5" r="0.8" fill="#2563eb" opacity="0.6" />

        {/* Bumper baseline. */}
        <path d="M 4 38 L 76 38" stroke="rgba(0,0,0,0.18)" strokeWidth="0.6" />
      </g>
    </svg>
  );
}

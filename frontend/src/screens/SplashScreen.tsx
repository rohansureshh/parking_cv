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

        {/* Five-stop metallic body gradient — sky-tint at roof, true brand
            blue at the shoulder, dark navy in the lower panels for that
            "wet paint" feel. Extra mid-stops give the body subtle banding
            that reads as a curved metal panel rather than a flat fill. */}
        <linearGradient id="splash-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7eb1fa" />
          <stop offset="22%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="80%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0f1f4d" />
        </linearGradient>

        {/* Lower-body shadow gradient — darkens the underside / skirt for
            depth. */}
        <linearGradient id="splash-body-skirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
        </linearGradient>

        {/* Glass — slight gradient so it reads as tinted glass, not black hole. */}
        <linearGradient id="splash-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#243046" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>

        {/* Tail-light lens gradient — bright at top, deep at bottom. */}
        <linearGradient id="splash-tail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fda4a4" />
          <stop offset="55%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>

        {/* Headlight halo — soft white-blue glow off the front of the car. */}
        <radialGradient id="splash-headlight" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#dbeafe" stopOpacity="0" />
        </radialGradient>

        {/* Drop shadow filter — gives the car real depth on the road
            without resorting to manual shadow ellipses or stacked layers. */}
        <filter
          id="splash-car-shadow"
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" />
          <feOffset dx="0" dy="2.5" result="offsetblur" />
          <feFlood floodColor="#0f172a" floodOpacity="0.42" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

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

      {/* Background skyline — darker silhouettes far behind the main row,
          adding depth and density to the city. */}
      <g opacity="0.45">
        <rect x="4" y="80" width="14" height="28" fill="#94a3b8" />
        <rect x="20" y="74" width="10" height="34" fill="#94a3b8" />
        <rect x="32" y="84" width="12" height="24" fill="#94a3b8" />
        <rect x="148" y="78" width="14" height="30" fill="#94a3b8" />
        <rect x="164" y="72" width="10" height="36" fill="#94a3b8" />
        <rect x="178" y="84" width="14" height="24" fill="#94a3b8" />
        <rect x="222" y="80" width="12" height="28" fill="#94a3b8" />
        <rect x="236" y="76" width="10" height="32" fill="#94a3b8" />
        <rect x="382" y="78" width="14" height="30" fill="#94a3b8" />
      </g>

      {/* Cityscape — varied silhouettes with subtle window grids and a
          mix of warm + cool lit windows for visual variety. */}
      <g className="splash__city">
        {/* LEFT CLUSTER */}
        {/* Standard tall with antenna */}
        <rect x="14" y="70" width="20" height="38" fill="#a9b8cd" opacity="0.92" />
        <rect x="22" y="62" width="3" height="8" fill="#a9b8cd" opacity="0.92" />

        {/* Stepped Art Deco */}
        <path
          d="M 38 108 L 38 76 L 42 76 L 42 70 L 56 70 L 56 76 L 60 76 L 60 108 Z"
          fill="#b1c0d4"
          opacity="0.92"
        />

        {/* Tall slim skyscraper — visible window grid */}
        <rect x="64" y="50" width="14" height="58" fill="#9eaec5" opacity="0.95" />
        <line x1="71" y1="50" x2="71" y2="42" stroke="#9eaec5" strokeWidth="0.9" opacity="0.85" />
        {/* Vertical window column lines */}
        <g stroke="rgba(15,23,42,0.18)" strokeWidth="0.4">
          <line x1="67" y1="54" x2="67" y2="106" />
          <line x1="71" y1="54" x2="71" y2="106" />
          <line x1="75" y1="54" x2="75" y2="106" />
        </g>

        {/* Modern slanted-roof building */}
        <path
          d="M 84 108 L 84 78 L 100 70 L 100 108 Z"
          fill="#b6c4d6"
          opacity="0.86"
        />

        {/* Pointed-top tower with subtle window grid */}
        <path
          d="M 106 108 L 106 70 L 116 60 L 126 70 L 126 108 Z"
          fill="#a9b8cd"
          opacity="0.92"
        />
        <g stroke="rgba(15,23,42,0.16)" strokeWidth="0.4">
          <line x1="110" y1="74" x2="110" y2="106" />
          <line x1="116" y1="64" x2="116" y2="106" />
          <line x1="122" y1="74" x2="122" y2="106" />
        </g>

        {/* Mid-rise */}
        <rect x="132" y="82" width="14" height="26" fill="#b6c4d6" opacity="0.78" />

        {/* SwiftPark-flavored landmark — twin-spire bank tower in the gap
            between the road's shoulder and the right cluster */}
        <path
          d="M 196 108 L 196 64 L 204 56 L 212 64 L 212 108 Z"
          fill="#9eaec5"
          opacity="0.94"
        />
        <line x1="200" y1="56" x2="200" y2="48" stroke="#9eaec5" strokeWidth="0.8" opacity="0.7" />
        <line x1="208" y1="56" x2="208" y2="48" stroke="#9eaec5" strokeWidth="0.8" opacity="0.7" />

        {/* RIGHT CLUSTER */}
        {/* Rounded-top building */}
        <path
          d="M 254 108 L 254 70 Q 254 64 260 64 L 270 64 Q 276 64 276 70 L 276 108 Z"
          fill="#a9b8cd"
          opacity="0.92"
        />

        {/* Tall slim with antenna + window grid */}
        <rect x="282" y="56" width="12" height="52" fill="#9eaec5" opacity="0.95" />
        <line x1="288" y1="56" x2="288" y2="48" stroke="#9eaec5" strokeWidth="0.9" opacity="0.85" />
        <g stroke="rgba(15,23,42,0.16)" strokeWidth="0.4">
          <line x1="285" y1="60" x2="285" y2="106" />
          <line x1="291" y1="60" x2="291" y2="106" />
        </g>

        {/* Wide stepped tower */}
        <path
          d="M 300 108 L 300 78 L 308 78 L 308 70 L 322 70 L 322 78 L 330 78 L 330 108 Z"
          fill="#b1c0d4"
          opacity="0.92"
        />

        {/* Pyramid-topped */}
        <path
          d="M 336 108 L 336 76 L 350 60 L 364 76 L 364 108 Z"
          fill="#a9b8cd"
          opacity="0.92"
        />

        {/* Small mid-rise */}
        <rect x="370" y="82" width="18" height="26" fill="#b6c4d6" opacity="0.78" />

        {/* Faint horizontal floor lines on the bigger buildings — reads as
            window rows from a distance. */}
        <g stroke="rgba(15,23,42,0.10)" strokeWidth="0.35">
          <line x1="64" y1="64" x2="78" y2="64" />
          <line x1="64" y1="74" x2="78" y2="74" />
          <line x1="64" y1="84" x2="78" y2="84" />
          <line x1="64" y1="94" x2="78" y2="94" />

          <line x1="282" y1="68" x2="294" y2="68" />
          <line x1="282" y1="78" x2="294" y2="78" />
          <line x1="282" y1="88" x2="294" y2="88" />
          <line x1="282" y1="98" x2="294" y2="98" />

          <line x1="106" y1="78" x2="126" y2="78" />
          <line x1="106" y1="88" x2="126" y2="88" />
          <line x1="106" y1="98" x2="126" y2="98" />
        </g>

        {/* Lit windows — warm yellow majority, with a few cool-white
            highlights mixed in for visual variety. Low opacity so they
            still read as ambient glow, not pixels. */}
        <g fill="#fbbf24" opacity="0.62">
          {/* Skyscraper */}
          <rect x="68" y="60" width="2" height="2.5" rx="0.4" />
          <rect x="73" y="60" width="2" height="2.5" rx="0.4" />
          <rect x="68" y="76" width="2" height="2.5" rx="0.4" />
          <rect x="73" y="84" width="2" height="2.5" rx="0.4" />
          <rect x="68" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="73" y="100" width="2" height="2.5" rx="0.4" />

          {/* Stepped art deco */}
          <rect x="46" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="50" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="46" y="98" width="2" height="2.5" rx="0.4" />

          {/* Right slim tower */}
          <rect x="285" y="68" width="2" height="2.5" rx="0.4" />
          <rect x="290" y="76" width="2" height="2.5" rx="0.4" />
          <rect x="285" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="290" y="100" width="2" height="2.5" rx="0.4" />

          {/* Right wide stepped */}
          <rect x="312" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="317" y="86" width="2" height="2.5" rx="0.4" />
          <rect x="312" y="94" width="2" height="2.5" rx="0.4" />
          <rect x="324" y="86" width="2" height="2.5" rx="0.4" />
        </g>
        {/* Cool-white window glow — the "still working late" lights. */}
        <g fill="#dbeafe" opacity="0.7">
          <rect x="68" y="68" width="2" height="2.5" rx="0.4" />
          <rect x="73" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="290" y="60" width="2" height="2.5" rx="0.4" />
          <rect x="285" y="84" width="2" height="2.5" rx="0.4" />
          <rect x="116" y="80" width="2" height="2.5" rx="0.4" />
          <rect x="116" y="92" width="2" height="2.5" rx="0.4" />
          <rect x="200" y="80" width="2" height="2.5" rx="0.4" />
          <rect x="208" y="92" width="2" height="2.5" rx="0.4" />
        </g>
      </g>

      {/* Wide atmospheric haze band — diffuses the line where the city
          meets the ground so the road never lands as a hard pasted-on
          trapezoid. The band overlaps both the building bases above and
          the road's vanishing edge below. */}
      <rect x="0" y="86" width="400" height="36" fill="url(#splash-horizon-haze)" />

      {/* Road — perspective trapezoid. The road's far edge sits a few
          pixels INSIDE the horizon band (y=114 instead of y=108), so the
          haze fully covers the seam. */}
      <path d="M 162 114 L 238 114 L 380 240 L 20 240 Z" fill="url(#splash-road)" />

      {/* Atmospheric perspective wash on the road — denser near the
          horizon end, blends the road into the haze tone above. */}
      <path d="M 162 114 L 238 114 L 380 240 L 20 240 Z" fill="url(#splash-road-haze)" />

      {/* Soft white edge highlights, fading away near the horizon. */}
      <path
        d="M 162 114 L 20 240"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 238 114 L 380 240"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Center dashed line — animated to scroll toward the viewer,
          giving the static car a sense of forward motion. */}
      <path
        className="splash__road-dashes"
        d="M 200 130 L 200 240"
        stroke="white"
        strokeWidth="2.4"
        strokeDasharray="6 12"
        opacity="0.92"
      />

      {/* Car — bold flat side-view sedan in the Icons8 Color style.
          Solid navy body (deep premium blue), dark tinted glass, clean
          wheels with cross spokes that visibly rotate. The whole car
          gently bobs; the road's center dashes scroll toward the viewer
          so the static car reads as cruising forward. */}

      {/* Soft ground shadow — stays static under the car so the bob
          doesn't carry the shadow with it. */}
      <ellipse cx="200" cy="216" rx="62" ry="3.2" fill="#0f172a" opacity="0.18" />
      <ellipse cx="200" cy="215" rx="48" ry="2.2" fill="#0f172a" opacity="0.26" />

      {/* Subtle headlight glow ahead of the car (right side). */}
      <ellipse
        cx="284"
        cy="200"
        rx="20"
        ry="5.5"
        fill="url(#splash-headlight)"
      />

      {/* Wrap handles position; inner .splash__car handles the bob. */}
      <g transform="translate(133, 168)">
        <g
          className="splash__car"
          filter="url(#splash-car-shadow)"
        >
          {/* Front wheel (drawn first so the body's lower edge clips
              the top of the wheel into a clean arch). */}
          <g transform="translate(108, 50)">
            <g className="splash__car-wheel">
              <circle r="11" fill="#1e293b" />
              <circle r="6.5" fill="#475569" />
              <circle r="3" fill="#0f172a" />
              {/* Cross spokes — make rotation legible on the splash. */}
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          </g>

          {/* Rear wheel */}
          <g transform="translate(32, 50)">
            <g className="splash__car-wheel">
              <circle r="11" fill="#1e293b" />
              <circle r="6.5" fill="#475569" />
              <circle r="3" fill="#0f172a" />
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
            </g>
          </g>

          {/* Body — bold flat navy silhouette (Icons8 Color style is
              about confident solid color, not multi-stop gradients). */}
          <path
            d="M 8 50
               L 8 36
               Q 8 30 13 28
               L 26 26
               L 48 8
               L 92 8
               L 114 26
               L 127 28
               Q 132 30 132 36
               L 132 50
               Z"
            fill="#1e3a8a"
          />

          {/* Lower-body shadow strip — adds dimension without breaking
              the flat color discipline. */}
          <path
            d="M 8 42 L 132 42 L 132 50 L 8 50 Z"
            fill="rgba(0,0,0,0.22)"
          />

          {/* Glass — single dark trapezoid spanning windshield + rear
              window, with B-pillar splitting the cabin. */}
          <path
            d="M 28 26 L 48 10 L 92 10 L 112 26 Z"
            fill="#0a1640"
          />
          <line
            x1="70"
            y1="10"
            x2="70"
            y2="26"
            stroke="#050b22"
            strokeWidth="1.6"
          />

          {/* Roof crown highlight — single bright line. */}
          <path
            d="M 49 9 L 91 9"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          {/* Window reflection — single subtle highlight on the windshield. */}
          <path
            d="M 80 14 L 100 22"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Belt-line — subtle horizontal panel break. */}
          <line
            x1="14"
            y1="36"
            x2="126"
            y2="36"
            stroke="rgba(0,0,0,0.28)"
            strokeWidth="0.5"
          />

          {/* Headlight — clean cool-white circle with a warm core, the
              only "complex" detail in the otherwise flat design. */}
          <circle cx="124" cy="32" r="2.6" fill="#e0eaff" />
          <circle cx="124" cy="32" r="1.4" fill="#fffbeb" opacity="0.95" />

          {/* Tail light — single coral block. */}
          <rect x="6.5" y="30.5" width="6.5" height="3.4" rx="1.2" fill="#ef4444" />

          {/* License plate. */}
          <rect
            x="11"
            y="35"
            width="11"
            height="3.6"
            rx="0.6"
            fill="#f1f5f9"
          />
        </g>
      </g>
    </svg>
  );
}

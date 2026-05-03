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
        {/* Road — top edge is fully transparent so the trapezoid dissolves
            into the horizon haze instead of meeting it as a hard line. The
            road then ramps to opaque atmospheric blue-gray as it nears the
            viewer (atmospheric perspective: lighter far, denser near). */}
        <linearGradient id="splash-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0" />
          <stop offset="18%" stopColor="#eaeff7" stopOpacity="0.85" />
          <stop offset="55%" stopColor="#e1e7ef" stopOpacity="1" />
          <stop offset="82%" stopColor="#d8e0ec" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#c5cfdf" stopOpacity="0" />
        </linearGradient>

        {/* Five-stop metallic body gradient — sky-tint at roof, true brand
            blue at the shoulder, dark navy in the lower panels for that
            "wet paint" feel. Extra mid-stops give the body subtle banding
            that reads as a curved metal panel rather than a flat fill. */}
        <linearGradient id="splash-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b9adf" />
          <stop offset="22%" stopColor="#2c6bdf" />
          <stop offset="55%" stopColor="#1f55c4" />
          <stop offset="80%" stopColor="#1a3477" />
          <stop offset="100%" stopColor="#0c1a3e" />
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

        {/* "City light" horizon glow — soft pale champagne core blended
            into cool blue-gray flanks. Reads like reflected ambient light
            at dusk: not golden-hour, not icy mist. Multi-stop so the
            warm-white peak sits centered in the band and dissolves into
            cool tones above and below. */}
        <linearGradient id="splash-horizon-warm" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b6c4d8" stopOpacity="0" />
          <stop offset="30%" stopColor="#c2cee0" stopOpacity="0.08" />
          <stop offset="55%" stopColor="#efddb2" stopOpacity="0.24" />
          <stop offset="75%" stopColor="#c8d3e3" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#b6c4d8" stopOpacity="0" />
        </linearGradient>

        {/* Atmospheric haze around the horizon line — softens building bases
            into the road, suggesting morning haze / depth. */}
        <linearGradient id="splash-horizon-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.55" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Skyline edge fades — narrow gradients used as overlay rects to
            soften the cityscape's outer left and right edges into the
            splash background, so the city reads as part of one continuous
            scene instead of a rectangular block ending abruptly. */}
        <linearGradient id="splash-skyline-fade-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="splash-skyline-fade-right" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
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

      {/* Skyline outer-edge fades — narrow vertical bands at the left and
          right sides of the SVG, white at the outermost edge fading to
          transparent inward, that gently dissolve the leftmost and
          rightmost buildings into the splash background so the cityscape
          stops reading as a rectangular inserted block. */}
      <rect x="0" y="40" width="64" height="80" fill="url(#splash-skyline-fade-left)" />
      <rect x="336" y="40" width="64" height="80" fill="url(#splash-skyline-fade-right)" />

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

      {/* Soft white edge highlights — start a few px below the horizon
          so they never poke through the haze as a hard line. */}
      <path
        d="M 151 124 L 20 240"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M 249 124 L 380 240"
        stroke="rgba(255,255,255,0.5)"
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

      {/* Car — based on the "Car Outbound" asset from SVG Repo
          (https://www.svgrepo.com/svg/436385/car-outbound, openly
          licensed). Body recolored to SwiftPark navy, glass to dark
          navy, taillights kept red. Wrapped in three transforms:
            translate(200, 175) — splash position (car center)
            .splash__car        — CSS bob animation hook
            scale(0.7) translate(-180,-110.85) — normalize the asset's
              own bounding-box center to (0,0) so the outer translate
              actually centers it on the road.
            matrix(1.27,...,88.581,-65.6388) — the asset's original
              outer transform, preserved verbatim. */}

      {/* Soft ground shadow — under the wheels (which land at y≈223
          after the splash transform). Stays static so the bob doesn't
          drag it along. */}
      <ellipse cx="200" cy="225" rx="76" ry="4" fill="#0f172a" opacity="0.18" />
      <ellipse cx="200" cy="224" rx="56" ry="2.6" fill="#0f172a" opacity="0.28" />

      <g transform="translate(200, 175)">
        <g className="splash__car">
          <g transform="scale(0.7) translate(-180, -110.85)">
            <g transform="matrix(1.27,0,0,1.27,88.581,-65.6388)">
              {/* Right-end reflector cluster */}
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M127.589,121.742L141.24,119.292L144.04,112.013L128.779,109.351L127.52,116.072L125.199,118.411L127.589,121.742Z" fill="#cbd5e1" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M127.604,121.746L125.277,118.252L127.536,116.067L128.805,109.37L130.102,109.578L136.723,120.08L127.604,121.746Z" fill="#94a3b8" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M130.896,111.731L129.916,118.872L139.532,117.723L141.032,113.64L130.896,111.731Z" fill="#0a0e1a" fillRule="nonzero" />
              </g>

              {/* Left-end reflector cluster */}
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M0,111.919L2.8,119.198L16.451,121.648L18.841,118.317L16.52,115.978L15.26,109.258L0,111.919Z" fill="#cbd5e1" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M16.467,121.646L18.794,118.152L16.535,115.967L15.266,109.27L13.969,109.478L7.328,120.009L16.467,121.646Z" fill="#94a3b8" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-10.3296)">
                <path d="M13.145,111.638L14.125,118.779L4.509,117.63L3.009,113.547L13.145,111.638Z" fill="#0a0e1a" fillRule="nonzero" />
              </g>

              {/* Wheel housings — left and right */}
              <path d="M3.89,173.884L5.57,193.416L24.891,193.416L28.882,173.674L3.89,173.884Z" fill="#1e293b" fillRule="nonzero" />
              <path d="M24.052,173.674L24.892,193.416L30.884,173.674L24.052,173.674Z" fill="#0a0e1a" fillRule="nonzero" />
              <path d="M117.358,193.416L136.708,193.416L138.388,174.095L113.395,173.884L117.358,193.416Z" fill="#1e293b" fillRule="nonzero" />
              <path d="M111.394,173.884L117.358,193.416L118.227,173.884L111.394,173.884Z" fill="#0a0e1a" fillRule="nonzero" />

              {/* MAIN BODY — recolored to SwiftPark navy */}
              <g transform="matrix(1,0,0,1.13153,0,-22.926)">
                <path d="M29.468,85.928L1.35,135.269L3.869,173.884L5.759,173.89L138.396,174.304L142.192,135.508L114.687,85.928L29.468,85.928Z" fill="url(#splash-body)" fillRule="nonzero" />
              </g>

              {/* Left taillight cluster — kept red */}
              <g transform="matrix(1,0,0,1,0,-4.6582)">
                <path d="M1.345,135.384L2.179,149.968L20.691,149.97L21.632,135.468L1.345,135.384Z" fill="#ef4444" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-4.6582)">
                <path d="M25.882,135.426L32.923,145.886L28.468,150.055L20.697,149.95L21.752,135.487L25.882,135.426Z" fill="#f1f5f9" fillRule="nonzero" />
              </g>

              {/* Right taillight cluster — kept red */}
              <g transform="matrix(1,0,0,1,0,-4.6582)">
                <path d="M142.191,135.425L140.942,149.926L122.76,149.97L121.71,135.479L142.191,135.425Z" fill="#ef4444" fillRule="nonzero" />
              </g>
              <g transform="matrix(1,0,0,1,0,-4.6582)">
                <path d="M117.706,135.478L111.697,145.925L116.114,149.969L122.78,149.925L121.697,135.466L117.706,135.478Z" fill="#f1f5f9" fillRule="nonzero" />
              </g>

              {/* Rear window — recolored to dark navy / slate */}
              <g transform="matrix(1,0,0,1.348,0,-42.2467)">
                <path d="M34.958,90.982L20.329,115.477L122.254,115.477L109.584,90.982L34.958,90.982Z" fill="url(#splash-window)" fillRule="nonzero" />
              </g>

              {/* Decorative dot — kept dark */}
              <path d="M43.968,171.364C43.968,174.147 41.711,176.405 38.928,176.405C36.145,176.405 33.887,174.147 33.887,171.364C33.887,168.581 36.145,166.324 38.928,166.324C41.711,166.324 43.968,168.581 43.968,171.364" fill="#0a0e1a" fillRule="nonzero" />

              {/* Bumper trim line */}
              <g transform="matrix(1,0,0,1,0,-4.6582)">
                <path d="M32.922,145.804L28.468,150.075L116.072,149.97L111.655,145.804L32.922,145.804Z" fill="#94a3b8" fillRule="nonzero" />
              </g>

              {/* License plate — kept light */}
              <g transform="matrix(1,0,0,1,0,-4.1445)">
                <path d="M55.3,156.916L52.264,167.561L87.671,167.561L84.67,157.046L55.3,156.916Z" fill="#f1f5f9" fillRule="nonzero" />
              </g>

              {/* Body shadow (left side) — darkened to read on the
                  new navy body */}
              <g transform="matrix(1.35601,0,0,1.35601,-9.08601,-43.1939)">
                <path d="M32.477,91.143L21.692,115.493L36.423,115.493L60.694,91.143L32.477,91.143Z" fill="#050a18" fillOpacity="0.42" fillRule="nonzero" />
              </g>

              {/* Body shadow (top / right) */}
              <path d="M109.62,80.397L105.969,80.397L72.75,113.417L122.254,113.417L109.62,80.397Z" fill="#0a1723" fillOpacity="0.4" fillRule="nonzero" />

              {/* Window reflection — slight tinted highlight on the
                  glass to keep it readable against the new dark fill */}
              <g transform="matrix(1.34973,0,0,1.34973,-25.576,-42.4401)">
                <path d="M73.249,115.472L97.46,91.008L91.32,91.008L67.526,115.472L73.249,115.472Z" fill="#3b4f8a" fillRule="nonzero" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

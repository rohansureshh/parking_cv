# SwiftPark Frontend (Step 13)

A polished single-page demo dashboard for the SwiftPark YC prototype. Built with
Vite + React + TypeScript and plain CSS. Talks to the FastAPI backend at
`http://127.0.0.1:8000` — never to Supabase directly.

## Prerequisites (Windows)

- **Node.js 20+** and npm — install from <https://nodejs.org> or `winget install OpenJS.NodeJS.LTS`.
- **Python venv** for the backend (already configured in the repo root).
- The SwiftPark FastAPI backend running locally with seed data loaded.

Verify your tooling in PowerShell:

```powershell
node --version
npm --version
```

## 1. Start the backend (PowerShell, repo root)

In a first PowerShell window:

```powershell
cd C:\Users\rohan\Desktop\parking_cv
.\venv\Scripts\Activate.ps1
uvicorn api.main:app --reload --host 127.0.0.1 --port 8000
```

Then seed the demo data once (in a second window, with the venv active):

```powershell
curl.exe -X POST http://127.0.0.1:8000/demo/seed
```

You should see a JSON occupancy payload come back. The frontend will not have
any spots until you've seeded.

## 2. Start the frontend (PowerShell, second window)

```powershell
cd C:\Users\rohan\Desktop\parking_cv\frontend
npm install     # first time only
npm run dev
```

Vite prints a local URL — by default <http://localhost:5173>. Open it in your
browser.

### Configuring the backend URL (optional)

The frontend reads `VITE_API_BASE_URL` if present, otherwise falls back to
`http://127.0.0.1:8000`. To override:

```powershell
Copy-Item .env.local.example .env.local
notepad .env.local
```

Restart `npm run dev` after editing `.env.local`.

## What the page does

- **Header** — SwiftPark wordmark + tagline + facility status pill.
- **Stats card** — garage name, last-updated time, big available count,
  occupied / unknown / capacity tiles, and an occupancy progress bar.
- **By Level** — open count per level (L1 / L2 / L3).
- **2.5D Spot Map** — tilted floor cards. Available spots are blue,
  occupied red, unknown gray. Click any blue spot to select it.
- **Selected Spot panel** — shows label, level, status, and confidence;
  press **Select Spot** to confirm.
- **Confirmation modal** — "Spot Selected" with the chosen label, level, and
  garage name.
- **Run Detection Simulation** — calls `POST /demo/simulate-detection` and
  refreshes the data; spot colors fade to their new status with a small
  per-tile stagger.

## Scripts

```powershell
npm run dev       # start Vite dev server on :5173
npm run build     # type-check + production build into dist/
npm run preview   # serve the production build locally
npm run lint      # run ESLint (the upstream Vite scaffold's config)
```

## Troubleshooting

- **"Can't reach the SwiftPark backend"** in the UI — uvicorn isn't running, or
  it's bound to a different port. Restart it with the command above.
- **"No demo data yet"** — the backend is up but `parking_spots` is empty.
  Run `curl.exe -X POST http://127.0.0.1:8000/demo/seed`.
- **CORS error in DevTools** — the backend already allows all origins, so this
  shouldn't happen. If it does, restart the backend after pulling the latest
  `api/main.py`.
- **Port 5173 in use** — close the other Vite instance, or let Vite pick the
  next available port (it prints the new URL).

## Notes

- Supabase keys live only in the backend's `.env` and never reach this app.
- Animation budget: ~300ms color transitions with a ~20ms per-tile stagger,
  done with plain CSS — no animation libraries.
- This is a demo; there is no auth, no real reservation, no payment. The CTA
  intentionally reads **Select Spot**, not "Reserve Spot."

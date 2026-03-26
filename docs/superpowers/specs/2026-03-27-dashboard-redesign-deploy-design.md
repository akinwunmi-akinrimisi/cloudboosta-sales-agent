# Dashboard Redesign + Deployment — Design Spec

## Overview

Redesign the Sarah Dashboard with a "Dark Glass" aesthetic and deploy it alongside the existing FastAPI backend in a single Docker container. No new features — same 3 tabs, same data, new skin + production deployment.

## Design System

### Aesthetic: Dark Glass

Dark zinc base with frosted glass cards, warm orange/amber live indicators, green pulse dots. Glassmorphism with restraint — translucent surfaces, subtle borders, no excessive blur.

### Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#09090b` (zinc-950) | Page background |
| `--bg-surface` | `#18181b` (zinc-900) | Sidebar, card backgrounds |
| `--bg-glass` | `rgba(255,255,255,0.04)` | Glass card fill |
| `--border-glass` | `rgba(255,255,255,0.08)` | Glass card border |
| `--border-glass-hover` | `rgba(255,255,255,0.12)` | Hover state borders |
| `--text-primary` | `#fafafa` (zinc-50) | Headings, primary text |
| `--text-secondary` | `#a1a1aa` (zinc-400) | Body text, descriptions |
| `--text-muted` | `#71717a` (zinc-500) | Labels, timestamps |
| `--text-dim` | `#52525b` (zinc-600) | Disabled, tertiary |
| `--accent-live` | `#f97316` (orange-500) | Active/live states, primary accent |
| `--accent-live-bg` | `rgba(249,115,22,0.15)` | Live badge background |
| `--accent-live-border` | `rgba(249,115,22,0.3)` | Live badge border |
| `--accent-success` | `#22c55e` (green-500) | Committed, positive outcomes |
| `--accent-success-bg` | `rgba(34,197,94,0.15)` | Success badge background |
| `--accent-info` | `#3b82f6` (blue-500) | Follow-up, informational |
| `--accent-info-bg` | `rgba(59,130,246,0.15)` | Info badge background |
| `--accent-danger` | `#ef4444` (red-500) | Declined, errors |
| `--accent-danger-bg` | `rgba(239,68,68,0.15)` | Danger badge background |
| `--accent-secondary` | `#a855f7` (violet-500) | Secondary accent |

### Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Headings | Space Grotesk | 600-700 | 20-28px |
| Body | Space Grotesk | 400-500 | 13-15px |
| Labels | IBM Plex Mono | 500 | 10-11px, letter-spacing 1.5px, uppercase |
| Data values | IBM Plex Mono | 500 | 14-20px |
| Badges | IBM Plex Mono | 500 | 11px |

Both fonts loaded via Google Fonts in `index.html`.

### Glass Card Pattern

Every card/panel uses this consistent pattern:

```css
.glass-card {
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  border-radius: 12px;
  backdrop-filter: blur(8px);
  transition: border-color 0.2s;
}
.glass-card:hover {
  border-color: var(--border-glass-hover);
}
```

### Status Badges

Pill-shaped badges with translucent background + matching border:

```css
.badge {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid;
}
```

Each status maps to its accent color (live=orange, committed=green, follow_up=blue, declined=red, queued=violet).

## Layout: Icon Sidebar

### Structure

```
+---+-------------------------------------------+
| S |                                           |
| I |           Content Area                    |
| D |                                           |
| E |                                           |
| B |                                           |
| A |                                           |
| R |                                           |
+---+-------------------------------------------+
```

### Sidebar Details

- Width: 56px fixed
- Background: `var(--bg-surface)` with right border `var(--border-glass)`
- Top: "S" logo in orange gradient square (32x32px, rounded-lg)
- Below logo: 3 tab icons stacked vertically with 12px gap
  - Live View: circle/pulse icon
  - Pipeline: kanban/columns icon
  - Strategy: bar-chart icon
- Active tab: `var(--accent-live-bg)` background + `var(--accent-live-border)` border on the icon container, icon colored orange
- Inactive: icon colored `var(--text-dim)`
- Bottom: logout icon (door/arrow) in `var(--text-dim)`
- Icons: inline SVG, 18x18px

### Content Area

- Background: `var(--bg-base)`
- Padding: 24px
- Max content width: none (fluid)

## Component Redesign

All 12 components get the Dark Glass treatment. No new functionality — same props, same data flow, new visuals.

### App.jsx

- Remove current header/tab navigation
- New layout: sidebar (56px) + content area (flex: 1)
- Sidebar contains logo, 3 icon buttons, logout at bottom
- Content area renders the active tab component
- Dark background on html/body

### Login.jsx

- Full-screen dark background (`var(--bg-base)`)
- Centered glass card with the "S" logo
- "Sarah Dashboard" heading in Space Grotesk
- "Cloudboosta Sales Agent" subtitle in zinc-400
- Token input with dark glass styling (zinc-800 bg, zinc-600 border)
- Orange gradient submit button
- Error text in red-400

### LiveView.jsx

- Top section: row of 4 stat cards (glass cards)
- Middle: Active Call card (if active) — glass card with orange border glow, green pulse dot, call timer
- Bottom: Recent Calls table in a glass card

### StatCard.jsx

- Glass card with label (IBM Plex Mono, uppercase, zinc-500) and value (Space Grotesk, 28px, bold)
- Value color: white by default, green for conversion rate
- Subtle hover: border brightens

### ActiveCallCard.jsx

- Glass card with `var(--accent-live-border)` border
- Top-left: green pulse dot (CSS animation) + "LIVE CALL" label in orange
- Lead name in white, location/programme in zinc-400
- Call duration timer in IBM Plex Mono
- If no active call: collapsed/hidden (not an empty state card)

### RecentCallsTable.jsx

- Glass card container
- Table header: IBM Plex Mono, uppercase, zinc-500, letter-spaced
- Table rows: Space Grotesk, zinc-200 text, zinc-800 hover background
- Outcome column uses status badges
- Alternating row backgrounds: transparent / `rgba(255,255,255,0.02)`

### Pipeline.jsx

- Horizontal scrollable container
- 6 kanban columns with glass card headers showing count badges

### KanbanColumn.jsx

- Glass card for column
- Header: column name (Space Grotesk 600) + count badge (IBM Plex Mono)
- Each column's header accent color matches its status
- Cards stack vertically inside with 8px gap

### LeadCard.jsx

- Compact glass card inside kanban column
- Lead name (white, 13px), phone (zinc-500, 12px)
- Bottom: programme badge + last call timestamp
- Click opens LeadSidePanel
- Hover: border brightens

### LeadSidePanel.jsx

- Slide-in panel from right, 420px wide
- Glass background with stronger blur (12px)
- Dark overlay on the rest of the page
- Header: lead name + status badge + close button
- Sections: Contact Info, Call History (list of glass cards with recording player), Transcript

### StrategyAnalytics.jsx

- Glass card container
- Horizontal bar chart (Recharts) with dark theme:
  - Background: transparent
  - Grid lines: `rgba(255,255,255,0.05)`
  - Bar colors: use accent palette
  - Labels: IBM Plex Mono
- Totals table below chart in same glass card

### OutcomeBadge.jsx

- Maps outcome string to accent color
- Renders pill badge with translucent bg + colored border + colored text

### EmptyState.jsx

- Centered text in zinc-500, Space Grotesk
- Subtle icon above text in zinc-600

## Deployment

### Multi-Stage Dockerfile

```
Stage 1: node:20-alpine
  - Copy dashboard/, npm ci, npm run build
  - Output: /app/dashboard/dist/

Stage 2: python:3.12-slim
  - Copy backend/, pip install
  - Copy --from=stage1 /app/dashboard/dist/ → /app/static/
  - CMD uvicorn
```

### FastAPI Static File Serving

Add to `main.py`:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Serve dashboard static files (after all API routes)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="static-assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve the React SPA — fall back to index.html for client-side routing."""
        file_path = os.path.join(static_dir, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_dir, "index.html"))
```

The SPA catch-all route must be registered last (after all API/webhook routes).

### docker-compose.yml Updates

- Add build context that includes both `backend/` and `dashboard/`
- The Dockerfile handles the multi-stage build
- No new environment variables needed (DASHBOARD_ORIGIN becomes same-origin)

### CORS Update

Since the dashboard is same-origin, CORS is no longer needed for dashboard requests. Keep existing CORS config for potential external API consumers but add the production URL.

### Vite Config

Update `vite.config.js` base to `"/"` (already default). No changes needed — the dev proxy config is only used locally.

## Files Changed

| File | Change |
|---|---|
| `execution/dashboard/index.html` | Add Google Fonts link tags |
| `execution/dashboard/src/index.css` | Replace with Dark Glass CSS variables + base styles |
| `execution/dashboard/tailwind.config.js` | Extend with custom colors, fonts |
| `execution/dashboard/src/App.jsx` | Icon sidebar layout |
| `execution/dashboard/src/components/Login.jsx` | Dark glass login |
| `execution/dashboard/src/components/LiveView.jsx` | Dark glass stat cards + layout |
| `execution/dashboard/src/components/StatCard.jsx` | Glass card with mono labels |
| `execution/dashboard/src/components/ActiveCallCard.jsx` | Orange-bordered live card |
| `execution/dashboard/src/components/RecentCallsTable.jsx` | Dark table styling |
| `execution/dashboard/src/components/Pipeline.jsx` | Glass kanban container |
| `execution/dashboard/src/components/KanbanColumn.jsx` | Glass column cards |
| `execution/dashboard/src/components/LeadCard.jsx` | Compact glass lead cards |
| `execution/dashboard/src/components/LeadSidePanel.jsx` | Slide-in glass panel |
| `execution/dashboard/src/components/StrategyAnalytics.jsx` | Dark Recharts theme |
| `execution/dashboard/src/components/OutcomeBadge.jsx` | Colored pill badges |
| `execution/dashboard/src/components/EmptyState.jsx` | Dark empty state |
| `execution/backend/main.py` | Add StaticFiles mount + SPA catch-all |
| `execution/backend/Dockerfile` | Multi-stage Node + Python build |
| `execution/backend/docker-compose.yml` | Updated build context |

## Out of Scope

- No new features or tabs
- No new API endpoints
- No responsive/mobile layout (desktop-only for now)
- No dark/light toggle (dark only)
- No animation library (CSS transitions only, except Recharts)

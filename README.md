# Thermo

A (fictional) smart home hub for heating, lights and blinds, built from PRD 9. It has two parts: a neumorphic (soft UI) marketing site that takes pre-orders, and a web dashboard for wall tablets, phones and desktops. The PRD's central claim is that soft UI can be accessible, so contrast is enforced by the build, not left to taste.

## Run it

```bash
npm install
npm run dev          # http://localhost:4321  (site, dashboard, simulated hub and API in one process)
npm test             # 62 tests: dial, reducer, schedule, sync/rollback, real WebSocket hub, components + axe
npm run build        # contrast gate -> astro build -> 250KB dashboard budget
npm run preview      # production server on :4322 (static build + API + hub WebSocket)
```

Open two browser windows on `/app` to see real-time sync. Settings > "Simulate an unreliable hub" makes about a third of changes fail, so you can watch them roll back.

## Pages

| Route | What it is |
|---|---|
| `/` | Hero with a working demo dial and the hub, benefits, a live one-room demo panel, specs, pricing, FAQ |
| `/how-it-works` | Setup, a soft vs high-contrast comparison with live controls, wall tablet mode |
| `/pre-order`, `/pre-order/thanks` | Reservation form (works without JavaScript) |
| `/support` | Help topics, accessibility statement, contact |
| `/components` | The component set, live, with the contrast strategy for each |
| `/app` | Dashboard. `/app/room/:id` opens a room, `/app/settings` opens settings, `/app?kiosk=1` turns on wall tablet mode |

## How the spec is met

| Requirement | Where |
|---|---|
| FR-1 dial | `src/ui/Dial.tsx`, geometry in `src/lib/dial.ts`. Drag the ring (the bottom gap never wraps 30° to 5°), Cooler/Warmer buttons, arrows ±0.5°C, PageUp/PageDown ±2°C, Home/End. `role="slider"` with `aria-valuemin/max/now/text` ("21.5 degrees"). Keys and buttons commit after a 400ms pause, so tapping Warmer three times sends one change. |
| FR-2 toggles | `src/ui/Toggle.tsx` (React Aria `useSwitch`). State shows as colour, thumb position and the words On/Off. |
| FR-3 scenes | `SCENES` in `src/lib/home.ts`. One `applyScene` action sets every device atomically; a toast confirms what changed. |
| FR-4 modes | `setMode` moves the whole-home target. Rooms store an offset, so every room follows. The current mode is pressed in, ticked and ink-coloured. |
| FR-5 high contrast | `[data-contrast="more"]` in `src/styles/tokens.css`: shadows off, 2px borders, darker colours. An inline head script applies it before first paint from `prefers-contrast: more` or the manual setting (Auto/On/Off in Settings, plus a switch in the site footer). |
| FR-6 kiosk | `src/app/Kiosk.tsx`. Root font size +20%, 440px dial, full screen button, Screen Wake Lock, dims after 2 minutes. The first tap only wakes the screen; it never reaches a control. The PWA manifest opens full screen. |
| FR-7 real-time sync | `src/lib/sync.ts` + `server/hub.ts`. Each accepted command is broadcast to every screen at once (measured at 194ms between two tabs, most of it the simulated device delay). Optimistic UI: pending commands are replayed over the last confirmed state. On a reject or a 4s timeout the command is dropped, so the UI rolls back, and a message says what was undone. |
| FR-8 schedule | `src/app/ScheduleEditor.tsx`, logic in `src/lib/schedule.ts`. Drag blocks or their ends on a 24-hour timeline (30-minute snap, no overlaps). Earlier/Later/Cooler/Warmer buttons and arrow keys do the same without dragging (WCAG 2.5.7). |
| FR-9 landing demo | `src/islands/DemoDial.tsx` and `DemoPanel.tsx` run on local simulated state with no login. They use the same components as the app. |
| Offline | Last state is cached in `localStorage`. The banner shows when it was last known, and controls are disabled. `public/sw.js` lets the installed app open with no connection. |
| Budget | `scripts/check-budget.ts` follows the module graph from `/app`: **131KB gzipped** of the 250KB budget. |
| Metrics (§10) | `server/api.ts`: anonymous daily counters (landing visits, pre-orders, scene use, high-contrast adoption, temperature changes) with no cookies or IPs, honouring DNT and GPC. `/api/metrics` reports landing conversion against the 3% target (set `METRICS_TOKEN` to protect it). |

## Contrast: one correction to the PRD

The PRD's text and edge tokens are right (10.4:1 and 3.55:1). Its accents are not: `--warm` measures 2.12:1 on `--base`, `--cool` 2.68:1 and `--on` 1.95:1, all below the 3:1 non-text minimum. The PRD's focus ring is specified in `--cool`, so as written it would fail too.

The fix keeps every PRD token unchanged, and they stay as the fills. Each accent gets a darker **ink** partner in the same hue: `--warm-ink` 4.2:1, `--cool-ink` 4.6:1, `--on-ink` 4.4:1. Anything that must be *seen* uses the ink colour: the dial arc's outline, the active toggle's track edge, chart bars, the focus ring and selected-state text. Form errors use `--error-text` (5.0:1), because `--warm-ink` is too light for small text.

`scripts/check-contrast.ts` reads `tokens.css` and checks 14 pairs in both palettes. The build fails if any drops below target. axe-core was also run on every page in both palettes and found no violations.

## Stack decisions

- **One Astro project, not a separate Vite app.** The PRD asks for React + Vite for the app and Astro for the site, sharing components. The app is a React SPA mounted client-only at `/app`; Astro builds with Vite. The component library (`src/ui/`) server-renders on the landing pages with no JavaScript unless a component is interactive.
- **React Aria hooks** for switch, slider, radio group and button. The dial is custom, since React Aria has no circular slider, but it follows the ARIA slider pattern.
- **The hub is simulated** (`server/hub.ts`): it stands in for the cloud API and Matter devices. It adds realistic device latency, warms rooms toward their targets and can fail commands on request. It runs inside the dev server and inside `scripts/serve.ts`.
- **The hub photo is a vector render** (`src/components/HubRender.astro`) until real product photography exists.
- **Energy is shown in kWh only**, since tariff data is out of scope for v1 (see open questions).

## Acceptance criteria

| Criterion | Status |
|---|---|
| Every control meets 3:1 at its boundary | Automated: contrast gate plus axe, both palettes |
| Dial by drag, buttons, keyboard, screen reader | Tested (`tests/components.test.tsx`, `tests/dial.test.ts`); drag checked by hand |
| High contrast, automatic and manual | Built, and verified in the browser. The `prefers-contrast` path runs in the head script and in a no-JS CSS fallback. |
| State syncs within 1s across two devices | Automated (`tests/hub.test.ts`) and measured in two tabs |
| Kiosk on a 10" tablet at 1m | **Needs a real device.** Layout checked at 1280×800 and 768×1024. |
| 5 participants over 65 complete core tasks | **Needs a usability session.** Not something code can stand in for. |

## Open questions from the PRD

- **Dark soft UI at night:** not built. It would need its own shadow palette: on a dark base the light shadow becomes a faint lift and the edge ring has to invert. The token structure (`[data-contrast]` blocks) is ready for a `[data-theme="night"]` block beside it, and the contrast gate would check it the same way.
- **Pounds or kWh:** kWh only for v1. Showing pounds needs tariff data, and a wrong cost figure is worse than none.

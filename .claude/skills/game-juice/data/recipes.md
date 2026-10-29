# Juice recipes — exact numbers

Playtested starting values. Implement as named constants; tune from here.

## Easing

| Use case | Curve | Duration |
|---|---|---|
| UI element entering | ease-out-cubic | 200–300ms |
| UI element leaving | ease-in-cubic | 150–200ms |
| Button press down | ease-out-quad, scale to 0.92 | 60ms |
| Button release | ease-out-back (s=1.7), scale to 1.0 | 180ms |
| Collected item to UI | ease-in-quad (accelerates away) | 350ms |
| Popup / reward appear | ease-out-back (s=2.0) from scale 0 | 280ms |
| Health bar drain | two-stage: instant white segment, then ease-out 600ms | — |
| Camera punch-in | ease-out-quad in 80ms, ease-in-out back 220ms | — |

ease-out-back: `1 + (s+1)*pow(t-1,3) + s*pow(t-1,2)` with s=1.70158 default.

## Screenshake

```
trauma system (the right way):
  trauma: float 0..1, add per event, decays linearly 1.5/sec
  shake = trauma^2  (or ^3 for snappier falloff)
  offset.x = shake * maxOffset * perlin(seed,   t*freq)
  offset.y = shake * maxOffset * perlin(seed+1, t*freq)
  angle    = shake * maxAngle  * perlin(seed+2, t*freq)
  maxOffset = 16px (pixel-art: 4–6px), maxAngle = 2–4deg, freq = 25Hz
```

| Event | Trauma added |
|---|---|
| Player takes hit | 0.4 |
| Player deals normal hit | 0.15 |
| Heavy/critical hit | 0.35 |
| Explosion nearby | 0.5 |
| Landing from big fall | 0.25 |
| UI confirm (subtle) | 0.05 |

Use Perlin/simplex noise, not `random()` — random jitters, noise *sways*.
Sum trauma from simultaneous events, clamp at 1.0.

## Hit-stop (freeze frames)

| Event | Freeze duration |
|---|---|
| Light hit | 30–40ms |
| Medium hit | 50–60ms |
| Heavy / critical | 80–120ms |
| Parry / perfect block | 120–150ms + flash |
| Player death | 200ms + slow-mo 0.3x for 400ms |

Implementation: set timescale to 0 (or 0.05) for the duration, then restore.
Exempt UI and particles from the freeze for extra polish.

## Squash & stretch

| Event | Scale (x, y) | Restore |
|---|---|---|
| Jump launch | (0.85, 1.25) | ease-out 150ms |
| Land soft | (1.15, 0.85) | ease-out-elastic 250ms |
| Land hard | (1.35, 0.65) + dust | ease-out-elastic 350ms |
| Hit reaction | (1.2, 0.8) on impact axis | 150ms |
| Collect pickup | item (1.4, 1.4) then shrink to 0 toward UI | 300ms |

Pivot at the contact edge (feet for landing), never the sprite center.

## Particles

| Event | Count | Behavior |
|---|---|---|
| Footstep / land | 4–8 | low gravity dust, fade 400ms, spread ±30° from ground |
| Jump launch | 5–10 | downward kick, fast fade 250ms |
| Hit spark | 8–15 | along impact normal ±25°, speed 200–400px/s, shrink to 0 |
| Collect | 6–12 | burst then home toward score UI, ease-in |
| Explosion | 30–60 | radial, 2 sizes mixed, smoke (slow, fade 1.2s) + sparks (fast, 300ms) |
| Trail (dash) | spawn every 16ms | afterimage at 40% alpha, fade 200ms |

Pool everything. One emitter class, parameterized — not one class per effect.

## Audio

- ±10% random pitch on EVERY repeated sound. Non-negotiable.
- Combo/coin chains: pitch ladder — `pitch = base * (1 + 0.06 * comboIndex)`,
  cap at +60%, reset on chain break. (The Mario coin trick.)
- Layer impacts: thump (low) + crack (mid) + detail (high), drop layers for
  distant/small hits.
- Duck music 20–30% for 300ms on big moments (explosion, level-up).
- UI: every interactive element gets hover (subtle, -12dB) and press sounds.

## Numbers & UI

- Score count-up: 300–600ms, ease-out, tick sound every ~40ms during count.
- Damage numbers: spawn at hit point +random(±8px), float up 40px over 700ms,
  scale 1.4→1.0 in first 100ms, fade last 200ms. Crits: 2x size, shake.
- Health bar: white "ghost" segment shows the chunk lost, drains after 400ms
  delay — reads damage magnitude at a glance.
- Currency gain: coins fly to the counter, counter pulses scale 1.15 per
  arrival, pitch-laddered tick per coin.

## Camera

- Follow: lerp at 5–8/sec toward target + lead offset (velocity * 0.15s).
- Look-ahead on aim: offset 10–20% of screen toward cursor/stick direction.
- Punch-in on heavy hit: zoom ×1.05 over 80ms, return over 220ms.
- Landing thud: camera dips 6–10px, ease-out-elastic back, 250ms.

## The juice audit template

For each player action, fill the grid; empty cells are your backlog:

| Action | Visual | Audio | Shake/stop | Particles | Anticipation |
|---|---|---|---|---|---|
| Jump | | | | | |
| Land | | | | | |
| Attack | | | | | |
| Take damage | | | | | |
| Collect | | | | | |
| Die | | | | | |
| Menu confirm | | | | | |

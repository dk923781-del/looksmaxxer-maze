# Looksmaxxer Maze: Pixel Evolution

Telegram Mini App, pixel Pac-Man with looksmaxxing memes. Phaser 3 + Vite.

## Run locally
1. Install Node.js 20+ (https://nodejs.org).
2. `npm install`
3. `npm run dev` and open http://127.0.0.1:5173
4. Production: `npm run build` (folder `dist/`), `npm run preview`.

## Tests
`npm run test:unit` (mazes, XP, migration). E2E: `python tests/e2e.py` with Playwright (dev server running).

## Replace character sprites
Put `public/assets/characters/<id>.png` (ids: valera_broke, moggsu, zetaboss, hulioboss, dildoboss), 160x64 px: 10 frames of 16x16 per row, one row per evolution stage (1, 26, 61, 100): `down0 down1 up0 up1 left0 left1 right0 right1 hurt win`. Then add the id to `public/assets/characters/manifest.json`: `{ "sheets": ["moggsu"] }`. Portraits on cards: `portrait` field in `src/data.js`.

## Deploy
GitHub Pages via `.github/workflows/deploy.yml` (Settings > Pages > Source: GitHub Actions).

## Telegram
@BotFather: `/newbot`, then `/newapp` (or Menu Button) with the Pages URL.

# MOGGMAN

A mobile maze arcade for Telegram Mini Apps, built with Phaser and Vite.

Play: https://dk923781-del.github.io/looksmaxxer-maze/
Telegram: https://t.me/looksmaxxmazebot/play

## Version 2

- TikTok-inspired dark interface with pink/cyan accents, portrait cards and meme captions.
- Five generated character portraits, detailed game actors and matching bosses. Existing save and character identifiers remain compatible.
- Aura mode: 40 pellets give six seconds of double score and increased speed. Close escapes reward 100 base points with a per-enemy cooldown.
- Six bundled music tracks, separate music/effect volume, optional local music selection and normal/slowed/sped playback.
- New releases are detected on focus and once per minute. Active runs finish before reloading. A pre-v2 window needs to be reopened once.

Hunter Eyes and ASCEND recordings are **not bundled**: redistribution permission was not obtained. Existing audio credits are in MUSIC_LICENSES.md. Local music selection currently lasts until page reload.

## Development

Node 22+, `npm ci`, `npm run dev`. Run `npm run test:unit` and `npm run build`. Browser regression tests are Python Playwright scripts in tests/.

Push main to deploy through GitHub Pages. Bump the build identifier in vite.config.js and public/version.json for each release. Telegram opens the same hosted site; editing game source and deploying updates the Mini App. This is not an in-game code editor.

## Art

public/assets/characters/moggers-v2.png is generated portrait artwork. Egor and Martin references: https://www.russianmog.ru/assets/egor.jpg and https://www.russianmog.ru/assets/martin.jpg; other references came from the original project. These are stylized characters, not a claim of endorsement. Hoola identity was not verified; Hulio uses the original reference instead.

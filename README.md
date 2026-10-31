# MOGGMAN

Mobile maze arcade built with Phaser and Vite.

- Play: https://dk923781-del.github.io/looksmaxxer-maze/
- Telegram: https://t.me/looksmaxxmazebot/play

## 2.1 — stable playfield and online music

The renderer stays at 320 × 384 logical pixels. Pickups, boss health and score changes never resize it. The HUD reserves its status rows; Telegram sizing follows viewportStableHeight and safe insets. Landscape layout uses that stable height, not transient drag geometry. All seven gameplay keys share a 48 px square shape. Existing saves remain compatible.

Hunter Eyes (laydownrot) is connected through its official SoundCloud widget. Play Hard (Slowed) and Play Hard (Ultra Slowed), by Hardstyle Demon / ASCEND, use official Audiomack embeds. Audiomack playback was verified in Chromium but its localized redirect refuses framing in iPhone WebKit. Those choices are disabled on iOS; a saved ASCEND choice falls back to Hunter Eyes. ASCEND playback on iPhone is not delivered in this release. Open the music strip, tap the provider's play button, then collapse the strip. The last choice persists. Opening music during a run pauses gameplay without changing its size. Bundled music is stopped while an online source is selected.

An internet connection and provider availability are required. Mobile browsers may require a direct tap in the player. Audiomack may show cookie/ad UI; its volume uses device controls. The game's global mute stops its iframe; returning from mute or app background requires play again. Third-party player scripts can emit their own isolated consent/ad errors. Requested recordings are streamed by the provider, not downloaded or redistributed from this repository. Existing bundled audio credits: MUSIC_LICENSES.md.

## Gameplay

Five portrait characters, five worlds, bosses, progression and saved unlocks. Aura mode: 40 pellets grant six seconds of double score and increased speed. Near misses award bonus points with a per-enemy cooldown. Optional local audio and slowed/sped modes are available under the custom-file section; playback-rate and bass controls only apply to bundled/local audio.

## Development and checks

Node 22+: `npm ci`, `npm run dev`, `npm run test:unit`, `npm run build`.
Python Playwright suites: tests/e2e.py, tests/moggman.py, tests/layout.py, tests/updates.py. tests/radio_live.py exercises actual remote players; pass a development URL and optionally --webkit (requires Playwright's WebKit browser). External network/provider behavior is reported separately.

GitHub Actions deploys main to Pages. Bump the build ID in vite.config.js and public/version.json for releases. Open games detect a release and wait until the run ends to reload. Bot metadata is managed separately in BotFather.

## Art

The five portrait atlas images are generated artwork based on original project references and Egor/Martin references from russianmog.ru. The character depictions are stylized and do not imply endorsement. The underlying art and save identifiers are retained from version 2.0.

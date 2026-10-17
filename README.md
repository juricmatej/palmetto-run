# Palmetto Run

**Play now:** https://palmetto-run.palleto.workers.dev

A neon open-world crime sandbox that runs in the browser. Steal cars, fly an attack helicopter or a fighter jet, run missions, rob the casino, pull a co-op bank heist, and fight your friends in real time. Built with [Three.js](https://threejs.org/) r128 and plain JavaScript: no framework, no bundler, no dependencies.

The game is published as a **Claude Artifact**, which gives it live multiplayer. It also runs as a normal web page (single-player).

> Mature themes: guns, gangs, a strip club, gambling, and drug and alcohol use as game mechanics.

## Play

| Where | Multiplayer | How |
|---|---|---|
| Cloudflare (public site) | Yes, the public city or a private `?room=` link | https://palmetto-run.palleto.workers.dev (no account needed) |
| Claude Artifact | Yes, everyone with the page open shares one city | Open the artifact link (must be signed in to Claude and have access) |
| Locally with the lobby | Yes | `npm run preview`, then open http://localhost:8787 in two tabs |
| Locally, quick | No (solo) | `npm run dev`, then open http://localhost:8080 |

### Controls

| Key | Action |
|---|---|
| Mouse / trackpad | Look and aim (click the game to lock the mouse, Esc to free it) |
| WASD / arrows | Walk, drive or fly |
| E or F | Steal or leave a vehicle, use things indoors, climb ladders |
| Click / Space | Shoot (Space also flies a helicopter or jet up) |
| Shift | Sprint, handbrake, or dive in a helicopter or jet |
| Q (hold) | Lock-on aim assist, on foot |
| R or two-finger scroll | Next weapon (scroll up for the previous one) |
| Hold Tab | Weapon wheel (or 1–8) |
| Right-click / Z | Sniper scope |
| G | Detonate sticky bombs |
| X | Flares (break missile locks) |
| N | Use white powder (super strength) |
| M | Sound on/off |
| P | Settings: rebind keys, look sensitivity, vehicle and scope look, invert Y, aim assist, sprint mode |

Every key in this table can be rebound in the settings panel (P): click a key chip and press the new key.

Phones get an on-screen joystick and buttons.

## Develop

Requires Node 18 or newer. There is nothing to install.

```bash
npm run dev     # build, then serve dist/ on http://localhost:8080
npm run check   # syntax-check the game code
npm run build   # write dist/artifact.html, dist/index.html and dist/2d.html
npm run smoke   # play the build in headless Chrome, print console errors (see the top of scripts/smoke.mjs)
```

Edit files in `src/`, then run `npm run dev` again and reload the page.

### Project layout

```
src/
  page.html     HTML markup: HUD, menus, start screen. Contains /*@@STYLE@@*/ and /*@@SCRIPT@@*/ placeholders
  style.css     All CSS
  game/         The game, split into ordered files that build.mjs joins into one script:
    00-core.js      Preamble, world grid, terrain, hills, landmarks
    10-people.js    Player state, cars, police, pedestrians, gangs, effects
    20-audio.js     Sound, combat, enter/exit a vehicle, gun shop
    30-air.js       Attack helicopter, fighter jets, drugs, robberies, sticky bombs
    40-casino.js    Blackjack (solo and shared), roulette, slots, rocket, poker, horses, wheel
    50-heist.js     The Union Job, weapon wheel, progression, places, mod shop, properties
    60-jobs.js      Jobs, story missions, movement, traffic lights
    70-phone.js     Phone, perf overlay, career, drugs, minigames, Pit, weather, events, races, crews
    80-input.js     Keyboard, mouse, pointer lock, touch, gamepad
    85-multiplayer.js  Claude room / Cloudflare lobby presence
    90-ui.js        HUD, hints, menus
    92-update.js    Main simulation step
    95-scene.js     Three.js scene setup
    96-models.js    Procedural meshes
    97-interior.js  Interior look
    98-instanced.js Instanced civilians and ambient cars
    98-landmarks.js Landmark meshes
    99-boot.js      Boot and the main loop
legacy/
  palmetto-run-2d.html   The original top-down 2D version (separate artifact)
worker/
  index.js      Cloudflare Worker: serves dist/ and runs the multiplayer lobby
scripts/
  build.mjs     Joins src/game/*.js in name order and inlines the result with style.css into page.html
  check.mjs     Syntax check
  serve.mjs     Local static server
dist/           Build output (not committed)
```

### How the game is organized

`src/game/` is one big IIFE split across the files above, concatenated in name order, so every file
shares one scope: functions declared in one file are visible everywhere, exactly as before the split.
Each file is further split into sections marked `// ---------- name ----------`. Search for these to
find your way around:

| Section | What it does |
|---|---|
| world | Map grid (`N`×`N` blocks of size `B`), districts, building generation, collision |
| state | Player, interiors (`mkRoom`), doors, interaction spots |
| cars, peds | Traffic AI on the road grid, parked cars, pedestrians |
| Rustwater Vipers / Low Palms Kings | Gang spawning (`gangPop`) and AI (`gangStep`) |
| combat | Bullets, rockets, explosions, damage |
| attack helicopter, fighter jets | Flight models and weapons |
| robberies, sticky bombs, blackjack, roulette, slots, Union Job | Activities |
| jobs | Mission types (`newJob`, `jobStep`) |
| input | Keyboard, mouse, pointer lock, touch |
| multiplayer | Claude `room` inside the artifact, or `wsRoom()` (the Cloudflare lobby) elsewhere |
| ui | HUD, hints, menus |
| update | Main simulation step |
| 3D scene, models | Three.js scene, procedural meshes, static batching (`staticBatch`) |
| minimap, boot | Radar and startup |

Coordinates: game logic is 2D on the ground plane (`x`, `y`) with a separate height `z`. In Three.js that maps to `(x, z, y)`.

### Multiplayer

When the page runs inside Claude, `window.claude.use('room')` returns a live room. Each player publishes a small presence object about 15 times a second: position, vehicle, health, last shot, damage dealt to others, heist progress and so on. Every client simulates its own traffic and pedestrians. Damage is decided by the shooter and applied by the victim when they see it in the shooter's presence. Outside Claude the game connects to the Cloudflare lobby when the page is served from one, and runs solo otherwise. The badge above the minimap shows the state. `npm run lobby:test` starts the Cloudflare lobby locally and checks the relay end to end; presence carries a protocol version (`pv`), and a player on a different version is asked to reload instead of being dropped.

The default city is public: everyone who opens the site shares it. Add `?room=code` to the link, or type a code on the start screen, to get a separate city that only players with that code can see; a tab remembers the last code. A code is not a secret, just a door: anyone with the link can join, so do not reuse a password as a room name.

## Publish as a Claude Artifact

The artifact is a single HTML page. `npm run build` produces it as `dist/artifact.html`.

**Update the existing artifact (keeps the same link)**

1. `npm run build`
2. In Claude Code (desktop app or CLI), opened in this folder, ask:
   > Publish dist/artifact.html to https://claude.ai/artifact/3pU67sVhffYYZVpghHwU3S

   Claude reads the current version, then republishes. The `room` capability (multiplayer) is kept automatically.

Only the artifact's owner, or someone the owner gave **edit** access to, can update that link.

**Publish your own copy (contributors)**

1. `npm run build`
2. In Claude Code, ask:
   > Publish dist/artifact.html as a new artifact with the `room` capability

The `room` capability is what turns on multiplayer. Without it the artifact runs solo.

**Playing with friends:** in the artifact's **Share** menu, invite each friend by email. Friends must be signed in to Claude. Visitors who arrive through a public link cannot join the shared room.

## Host it on Cloudflare (free, with multiplayer)

`worker/index.js` is a Cloudflare Worker that serves `dist/` and runs the multiplayer lobby in Durable Objects at `/ws`. Each `?room=` code gets its own object, so groups in different rooms never meet. When the game is not running inside Claude, it connects there automatically (`wsRoom()` in `game.js`).

```bash
npx wrangler login   # once
npm run deploy       # builds and deploys
```

`npm run preview` runs the same thing locally on http://localhost:8787. Configuration is in `wrangler.jsonc`. Each city holds up to 32 players.

### Automatic deploys

`.github/workflows/deploy.yml` deploys to Cloudflare on every push to `main`, which includes merged pull requests. It needs two repository secrets (**Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → **My Profile → API Tokens → Create Token** → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → **Workers & Pages** → Account ID in the right sidebar |

Pull requests from forks never see these secrets; only code that lands on `main` is deployed.

### Auto-merge (no review)

`.github/workflows/automerge.yml` merges every pull request opened from a branch **in this repo** (the owner and collaborators) as soon as `npm run check` and `npm run build` pass, then deploys it. Open a pull request as a **Draft** to keep it from merging until you click **Ready for review**. Pull requests from forks are never auto-merged.

The live site checks `/version.json` every 45 seconds. When a new version is deployed, players see a **Reload** button at the top of the screen.

The Claude Artifact is not updated automatically. Republish it by hand when you want it to match (see above).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

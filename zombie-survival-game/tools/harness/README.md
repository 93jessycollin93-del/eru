# Browser harness

Scripted checks that drive the real game in headless Chromium (software WebGL, so they step the
simulation instead of rendering in real time). Start the dev server first:

```sh
npx vite --host 127.0.0.1 --port 8080 --strictPort   # in the background
node tools/harness/doors.mjs           # all door/window/barricade/access-control scenarios
node tools/harness/doors.mjs H2,H6     # just some of them
node tools/harness/perf.mjs 8080       # draw calls at a fixed pose and AI update cost
node tools/harness/snap.mjs 8080       # JSON snapshot of everything the town random stream decides
node tools/harness/save.mjs            # H11/H11b/H11c: save → reload page → load, damaged saves, v1 saves
node tools/harness/lineup.mjs          # H13: a cast of every role, screenshots in tools/harness/out/
```

`snap.mjs` is how determinism was checked: run it against a worktree of an older commit on another
port and diff the two outputs (buildings, computers and passwords, containers, spawn points, hosts
must match). Its `zombies` part (H14) starts a game and lists every zombie's seed, place, speeds,
runner flag and height plus the game rng position: they must match too.

`lineup.mjs` (H13) renders a row of people of every role (police, sheriff, clerk, hardware worker,
tradesman, hiker, hunter, sleepwear, office, jogger, hooded, open jacket, a fresh runner, the player
with gear and a living townsperson) from the front, back and close up, and checks 2 draw calls per
character. `SHOTS=full,portrait1` renders a subset; `RAW=1` skips post-processing. Look at the PNGs.

Scenarios in `doors.mjs` (pass criteria in the session 7 entry of HANDOFF.md):

| | |
|---|---|
| H0 | Barrier census |
| H1 | Open/close a house door: collider, sight, noise, deadbolt, unbolt-and-open, obstruction |
| H2 | Siege timing: 1 zombie on a latched door, 2 on a deadbolted one |
| H3 | A silent player ends a siege |
| H4 | Windows: break, vault, cuts, zombie climbs in via the broken window, shove-off |
| H5 | Boarding: time, materials, hammer noise, prying, tearing order outside/inside |
| H6 | Police: ssh → `door` CLI → armory, keypad lockout/grant, UPS failure, zombie pushes the released door, generator |
| H8 | Determinism of the barrier world and the save → restore round trip |
| H9 | No looting through walls or glass; usable from inside |
| H10 | Hiding behind a glass door: the zombie breaks through |
| H12 | Aiming at windows over counters targets the window, looking down targets the counter |

Playwright comes from `npm i --no-save playwright`, or the container's global install.

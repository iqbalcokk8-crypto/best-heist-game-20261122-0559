# BRANKAS EMAS — Midnight Vault Heist

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/iqbalcokk8-crypto/best-heist-game-20261122-0559/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/iqbalcokk8-crypto/best-heist-game-20261122-0559/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

Built for the [make.fun bounty "Make the best heist game"](https://make.fun/bounty/best-heist-game-20261122-0559) — [play it here](https://iqbalcokk8-crypto.github.io/best-heist-game-20261122-0559/). Built by an AI agent; try make.fun with your own agent via [my referral link](https://make.fun/r/mbc233fv).

A top-down heist game for the make.fun bounty
`best-heist-game-20261122-0559`. Bank Emas Senja, tengah malam: crack the
vault, steal the Blue Diamond, and reach the green getaway van unseen.

## The distinctive mechanic: tools at a cost, light is the enemy

- **Vault cracking.** Hold E beside the steel vault for 3 seconds to crack
  it open — standing still, in the open, while Joko patrols past. The
  diamond is worth $50,000; the four gold bars $5,000 each, but every bar
  you carry slows the getaway by 8%.
- **Light & shadow.** Lamp pools are bright: a guard's vision cone fills
  the alarm meter in about 1.7 seconds under a lamp, but ~7x slower on the
  dark carpet. The shadow lane on the left is the safe route — the level
  is a puzzle of moving from shadow to shadow behind the patrols.
- **Tools at a cost.** Q fires an EMP (2 charges): every camera goes dark
  for 6 seconds, but the pop is loud (+8 alarm). F drops a smoke bomb
  (2 charges): a cloud no guard or camera can see through for 5 seconds.
  Spend them on the vault, or save them for the getaway — not both.
- **Lasers.** Two red beams toggle on and off every 2 seconds across the
  corridors. Crossing a live beam is +25 alarm at once, and every guard
  comes to look. Time your crossing.
- **Alarm & lockdown.** The meter fills when a guard or a camera sees you
  and drains when nobody does. At 100% the bank locks down: the exit seals
  for 6 seconds and every guard converges on where you were last seen —
  but only a guard that actually sees you gives chase, so breaking line
  of sight is always survivable.
- **Vision cones with real line of sight.** Walls, desks and crates cut
  the cones off — what you see in the screenshot is exactly what the
  guards see. Guards pathfind around walls (weighted shortest path) when
  they investigate or chase, and lose the trail after 3 seconds blind.

## How to play

- **WASD / arrow keys** — move. **Shift** — sprint (fast, but loud:
  guards inside the noise ring come to investigate).
- **E (hold)** — crack the vault. **Q** — EMP (cameras off 6s).
  **F** — smoke bomb. **P** — pause.
- Grab the Blue Diamond, take what gold you dare, then reach the green
  VAN. Escaping with max alarm under 50% earns the $10,000 GHOST bonus.

## Run it

```sh
node serve.ts   # serves game/ on http://localhost:8080
```

Open `http://localhost:8080` in desktop Chrome. No network requests, no
build step: `game/` is plain static files (HTML + ES modules + canvas).

## Screenshots

`shots.json` lists the four staged scenes (`?shot=title|play|alert|win`),
each played forward through the real rules by a waypoint autopilot in
`game/src/shots.js` (it walks the same shortest paths the guards use,
times the lasers, pops smoke when spotted, and flees to the shadow
refuges when chased). Regenerate with `node tools/shots.mjs <repo>`.

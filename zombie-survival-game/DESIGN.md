# Design Guide: Realism

**Goal (owner's words):** the physical *and cybernetic* world in this game should be more realistic than any game ever made, using the best ideas from everywhere.

This document defines what that means, so every session builds toward the same thing. ROADMAP.md says *when*; this says *what* and *why*.

## The rules every system follows

1. **Simulate, don't fake.** If the player can see it, it has state and causes. A light is on because a circuit has power because a generator has fuel. A zombie heard you because sound travelled there. No scripted "events" pretending to be systems.
2. **Everything is connected.** Systems feed each other. The power grid drives computers, networks, cameras, lights, fridges and water pumps. Weather drives temperature, sound and visibility. Wounds drive aim and speed.
3. **Information is diegetic.** The world tells you things the way reality would: notes, emails, logs, radio broadcasts, a camera feed, a dripping tap. The UI shows only what your character could know (infection stays hidden until you feel symptoms).
4. **Real procedures, real knowledge.** A Linux shell behaves like Linux. A network behaves like TCP/IP. A wound needs pressure, cleaning and dressing. Players who know the real thing get rewarded for it, and players who don't can learn it in-game.
5. **Consequences persist.** What you break stays broken, what you take is gone, and what you burn leaves ash. Permadeath.
6. **The simulation is portable.** Rules live in `src/sim/` (engine-agnostic TypeScript, deterministic with an injected RNG, serialisable state) so they survive the port to Unreal Engine 5.

## Best-of-the-best: what we take from where

| Source | What we take |
| ------ | ------------ |
| **DayZ** | Open world tension; blood vs health; colour drains as blood drops; scavenging; strangers as the scariest thing |
| **Escape from Tarkov** | Visual grit and lighting; per-body-part damage; deep weapon handling and ballistics; inventory as Tetris with weight |
| **Project Zomboid** | Hidden infection with no cure; moodles; the power and water shutoff; skills learned by doing; "this is how you died" |
| **Vein** | Every building enterable; dense, believable towns; electricity and appliances that work |
| **SCUM** | Metabolism (calories, nutrients), body simulation detail |
| **Arma** | Realistic ballistics, sound propagation over distance, terrain scale |
| **Kenshi / Dwarf Fortress** | Systemic world that doesn't revolve around the player; emergent stories |
| **S.T.A.L.K.E.R.** | Atmosphere, A-life (the world simulates offscreen) |
| **Uplink / Hacknet / Grey Hack** | Real-feeling hacking: scanning, credentials, logs, traces |
| **EXAPUNKS / Shenzhen I/O / Stationeers** | Programmable devices, circuits and logic you actually build |
| **Duskers / Quadrilateral Cowboy** | Using terminals to control the physical world (doors, drones, cameras) |
| **Real life** | Linux, TCP/IP, SSH, NVR camera systems, UPS batteries, electrical load, radio propagation, field medicine |

## The physical world

### Body (done: session 2; extend)
Blood volume, wounds per body part, clotting, hidden infection and reanimation, body temperature, fatigue, pain, panic.
**Next:**
- fractures and splints, wound infection and disinfecting, food poisoning, nutrients (SCUM)
- calories instead of a single hunger bar
- carried weight affecting stamina and joint injuries

### Matter and objects
- Every item has weight, volume, condition and material.
- Food spoils on a real timeline, faster without a working fridge.
- Containers have capacity.
- Doors and windows have health, lock state and noise; glass breaks and can cut you.

### Energy (key system linking both worlds) (done: session 6)
- The town grid goes down on a set day.
- Each building has a **circuit with a load**: lights, fridge, computers, network gear.
- **UPS batteries** keep critical equipment alive for hours. Generators burn real fuel per kW, make noise that attracts zombies, and must be wired to a building.
- Car batteries and solar panels come later.

### Sound and light
- Sound propagates and is blocked by walls. Gunshots carry hundreds of metres.
- Light makes you visible: flashlights, lit windows, computer screens.
- Zombies reason about both.

### Weather and time
Rain (wet clothes chill you, rain masks sound), fog, wind, seasons getting colder.

### The world lives without you
Zombies migrate, things decay, power fails, and other survivors' traces appear and change.

## The cybernetic world

The goal is that **every electronic device is a real, working system** with its own state, power needs, network address and software, and that controlling electronics changes the physical world.

### Computers (done: session 3; extend)
Boot, login, real shell, filesystem with permissions, mail, programs, battery.
**Next:**
- text editor (`nano`) and writing your own files
- shell scripts you can run
- `ps`/`kill`, logs that record *your* actions (and can be read by others later)
- USB drives as physical items that carry files between machines

### Networks (done: session 4)
- Each building with electronics has a LAN with real addressing (`10.0.4.0/24`, `192.168.1.0/24`), a router, and devices.
- Commands: `ip addr`, `ping`, `nmap`, `ssh`, `scp`.
- The internet is down; inter-building links come later (radio bridges, long Ethernet runs you lay yourself).
- Devices only respond while they have power.

### Devices that touch the physical world
- **CCTV:** network cameras streaming **live views of the 3D world** to an NVR you can watch from a terminal. Scout before you step outside.
- **Access control:** door controllers you can unlock from the network (with credentials).
- **Building systems:** lights, alarms (which make noise and draw zombies), water pumps.
- **Radio:** scanners, emergency broadcasts on a schedule, transmitting to other survivors (multiplayer era).
- **Programmable logic:** a simple PLC or microcontroller language to automate generators, lights and doors (EXAPUNKS-style), and later drones.

### Security and realism
- Credentials are found, not given: notes, mail, bash history, config files, default passwords on cheap devices.
- Failed logins lock out and are logged. Actions leave traces.
- No magic "hack" button. If you get in, you got in the way a real person would.

## Engineering approach
- Each system first as a pure model in `src/sim/` with tests, then wired into the client.
- Data-driven content (items, devices, networks, documents) generated from world facts, so the world stays coherent: the email names the real address, the camera shows the real street.
- Performance budgets: the browser build must stay playable on a mid-range laptop. High/Low quality, and offscreen work (like CCTV renders) is throttled.

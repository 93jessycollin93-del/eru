# qpdb: the owner's language

The language of the game's computers and networks, designed by the owner. This file records the design as the owner gave it, so every session builds the same thing. Where something is my reading rather than the owner's words, it says so.

## The letters

Each letter is a circle (0) joined to a stick (1), and the four letters are one shape turned four ways. Each letter carries two bits: which side the stick is on, and which way it points.

| Letter | Stick side | Stick points | Value | Bits |
|---|---|---|---|---|
| b | left | up | 0 | 00 |
| d | right | up | 1 | 01 |
| p | left | down | 2 | 10 |
| q | right | down | 3 | 11 |

Two letters make one hex digit and four letters make one byte. Example: `qpdbdbqppqbd` is 3 2 1 0 1 0 3 2 2 3 0 1, which is the bytes `E4 4E B1`.

## The owner's numbers (2026-10-14, replaces the 0–3 values above)

The owner assigned each letter a power of two:

| Letter | Value | Bit |
|---|---|---|
| q | 2 | 00010 |
| p | 4 | 00100 |
| d | 8 | 01000 |
| b | 16 | 10000 |

What follows from that:

- Each letter is one bit. Any group of different letters adds up to a number no other group makes (`qp` = 6, `db` = 24, `qpdb` = 30), so a sum can always be read back into its letters.
- Rotation becomes literal: rotating the bit one place turns q → p → d → b → q. A key is a stream of rotations (0 to 3 places per letter), and decrypting rotates back.
- 1 (the bit below q) is not assigned yet. Open: does it belong to something, such as the bare circle or the bare stick?
- The 0–3 table and the turning moves below are kept as a record of the earlier reading. Where they disagree, the owner's numbers win.

## eYe protocol and SANDi drones (owner, 2026-10-14)

- The letters are sent "completely encrypted using the eYe protocol" to the owner's **SANDi** drones, written `<S<A<N>D>I>`: **S**pecialized **A**tomic **N**euronic **D**rones, plus an **I** whose meaning the owner has forgotten. (Corrections from the owner: it is the I they forgot, not eYe; and the N is Neuronic, not Neutron, "because they're highly specialized and fine tuned to get the job done whatever it may be".)
- Design intent from the name: each drone is a specialist, tuned for one kind of job, rather than one drone that does everything.
- A lead for the I, not confirmed: in the owner's Jackie app SANDi is "the index router", grown out of the "Index Pill", so the i may be **index**.
- eYe in the Jackie app is the "24-pod compression intelligence system" with SHA-256 integrity checks, a ring of pods each passing condensed data to the next. Working reading here: the eYe protocol is the whole sending pipeline (compress, encrypt, authenticate), because those are the jobs eYe does in the app.
- Open: the nested brackets in `<S<A<N>D>I>` may mean layers, each wrapping the next (like layers of encryption). To confirm with the owner.
- In the game, SANDi drones are devices on the network that take eYe-protected qpdb commands. They come with the programmable-devices work (DESIGN.md: "programmable logic ... and later drones").

## Turning the letters is the encryption

Each letter becomes any other letter with one of four moves:

| Move | Effect | Same as |
|---|---|---|
| Leave it | b stays b | XOR 00 |
| Mirror left-right | b ↔ d, p ↔ q | XOR 01 |
| Flip upside down | b ↔ p, d ↔ q | XOR 10 |
| Half-turn | b ↔ q, d ↔ p | XOR 11 |

A key is a stream of moves, one per letter. Encrypting turns each letter by its move. Decrypting makes the same moves again, because every move undoes itself.

## The key, times four, stays in the router

- The router's secret key is stretched "times four" into a stream of moves that never repeats. (My reading: four passes through a mixing step. To confirm with the owner: it could mean four separate keys.)
- The key lives in a sealed chip inside the router, and the router sits in a locked top-secret room. No file, command, screen or save the player can read ever shows the key. The router encrypts and decrypts only for devices it trusts.
- Cheap devices in the world use short keys that repeat. Those can be cracked by spotting patterns, and that is meant to be gameplay. The router's key cannot be guessed, only reached.

## Hidden authenticator symbols

The router works out a few extra letters from the message and the key and hides them at the end. If one letter changes, the check fails and the message is rejected. Nobody without the key can forge it. The same check catches a tag or signal that was misread.

## Compression

Runs of repeated letters shrink to a count plus the letter: `qbpdqqqqqqqpb` becomes `qbpd`, 7 × `q`, `pb`.

Encrypted letters look random and do not shrink, so the order is fixed:

- **Sending:** compress → encrypt → add the authenticator
- **Receiving:** check the authenticator → decrypt → decompress

## Notches: qpdb you can see and hear

The sticks' ups and downs form a strip of notches that can be read like a barcode or Morse code (the owner's "QR Morse code"). `qbpdqqqqqqqpb` reads down, up, down, up, then eight downs, then up.

- **Printed:** tags and stamps on crates, keycards, doors and notes, scanned or copied by hand into a terminal.
- **Light:** a lamp blinking the strip.
- **Sound:** high and low radio tones.

Stick side is the second feature of each notch, so a full reading needs both the ups and downs and the left and right.

## Where it sits

- qpdb is what travels over the in-game cables: the network layer of the computer system.
- It is built after the hardware and boot layer.
- Rules live in `src/sim/` like every other system: deterministic, tested, saveable.

## Still open

- What "times four" means exactly: four passes or four keys.
- Whether the tall-versus-hanging reading (b and d as data, p and q as commands) has any role, now that every letter is a value from 0 to 3.

# Vidyut Panchayat

Vidyut Panchayat is a browser-based simulation of autonomous city utilities negotiating scarce power during a disaster. The engine is pure TypeScript and runs in Web Workers in the browser or under Node.js for batch experiments. The frontend renders engine output; it does not allocate power.

## Prerequisites

- Node.js and npm
- `npm install` to install the pinned project dependencies

## Development commands

- `npm run dev` starts the Vite development server.
- `npm run typecheck` checks TypeScript.
- `npm test` runs the Vitest suite.
- `npm run batch` runs seeded experiments.
- `npm run build` creates the static demo build.

## Team

- Om Rashiya — frontend, 3D and demo lead (`rashiyaom@gmail.com`)
- Krish Ardeshana — simulation engine lead (`krishardeshana@gmail.com`)

See [architecture.md](architecture.md) for the system and repository structure and [timeline.md](timeline.md) for the execution plan.

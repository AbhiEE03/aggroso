# Aggroso — Dynamic User-Defined Skills Agent Platform

## Overview

TODO — fill in after Phase 5 deployment.

## Architecture

TODO — mermaid diagram of Skill → ExecutionRun → Tool flow and approval gate.

## Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Server
```bash
cd server
cp .env.example .env        # fill in MONGODB_URI, PORT
npm install
npm run dev                  # starts Express on :5000
```

### Client
```bash
cd client
npm install
npm run dev                  # starts Vite on :5173, proxies /api to :5000
```

### Tests
```bash
cd server
npm test
```

## Completed Scope

TODO — fill in after Phase 5.

## Intentionally Excluded Scope

TODO — fill in after Phase 5. Be explicit and honest.

## Known Limitations

TODO — fill in after Phase 5.

## Deployment

TODO — Vercel (frontend) + Render (backend) + MongoDB Atlas.

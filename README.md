# SGC Navigator Frontend

## About SGC Navigator

**SGC Navigator** is a web-based navigator for the COBISS General Subject Headings (SGC / Splošni geslovnik COBISS), a controlled vocabulary thesaurus in Slovenia's COBISS.SI library system. 

The navigator enables users to search approximately **70,000 SKOS terms** and explore their hierarchical and associative relationships through an interactive graph view. Users can navigate between broader concepts (nadrejeni), narrower concepts (podrejeni), and related terms (sorodni izrazi) visualized as an interactive concept graph. All terms are available in both Slovenian and English.

**Target Users**: COBISS Plus users and librarians

**Similar Solutions**: [GND Explorer](https://explore.gnd.network/) (German National Library thesaurus)

## Tech Stack

- **Frontend**: React 19 + TypeScript (strict mode)
- **Build**: Vite 8 with `@vitejs/plugin-react` (Oxc transpilation)
- **API**: GraphQL (Apollo Client)
- **Containerization**: Docker + Docker Compose

## Prerequisites

- Node.js 20+
- npm/yarn
- Docker & Docker Compose (for running the full stack locally)
- The backend GraphQL API running (see `sgc-navigator-backend`)

## Getting started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
```

## Available commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check then build to `/dist` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint across all `.ts`/`.tsx` files |

## Project Structure

```
src/
├── main.tsx              # React app entry point
├── App.tsx               # Root component
├── components/
│   ├── SearchBar/        # Term search with autocomplete
│   ├── GraphView/        # Interactive concept graph (broader/narrower/related)
│   └── TermDetail/       # Term detail panel (prefLabel, altLabel, scopeNote, SL/EN)
├── api/                  # GraphQL client and queries
└── assets/
```

**Key Pattern**: Functional components with React hooks, co-located CSS modules for styling.

## Backend API

The frontend communicates with a **GraphQL API** running on the backend. During development, the backend is expected at `http://localhost:8080`. 

Set `VITE_API_BASE_URL` in `.env.local` to override the API endpoint:

```
VITE_API_BASE_URL=http://localhost:8080/graphql
```

Key GraphQL queries consumed:

| Query | Purpose |
|---|---|
| `searchTerms(q: String!)` | Full-text term search by Slovenian or English label |
| `getTerm(id: ID!)` | Fetch a single SKOS concept with all metadata (labels, scope notes) |
| `getTermGraph(id: ID!)` | Fetch broader, narrower, and related concept neighbours |

For detailed backend documentation, see `backend` repository.


## Docker

A `Dockerfile` and `docker-compose.yml` are provided for containerized deployment and local full-stack development.

### Local Development with Docker Compose

Start both frontend and backend services:

```bash
docker-compose up
```

This starts:
- Frontend at `http://localhost:5173` (Vite dev server with HMR)
- Backend at `http://localhost:8080` (GraphQL endpoint)

### Production Build

```bash
docker build -t sgc-navigator-frontend:latest .
docker run -p 3000:80 sgc-navigator-frontend:latest
```

## CI/CD Pipeline

GitHub Actions workflow automatically:

- **Lint** — Runs ESLint on all `.ts`/`.tsx` files
- **Type Check** — Validates TypeScript compilation (`tsc -b`)
- **Build** — Creates production build (`npm run build`)
- **Tests** — Runs test suite (when added)

Pipeline runs on:
- Every push to `main` / `develop` branches
- All pull requests

Build artifacts are published to the repository (see Actions tab for details).

## Notes

- **TypeScript errors block the production build** — run `npm run build` before committing. The GitHub Actions pipeline will catch this automatically.
- **React Compiler is disabled** — do not enable without updating `vite.config.ts`.
- **No routing installed** — React Router should be added when multi-page navigation is needed beyond the main navigator view.
- **GraphQL Queries** — All backend queries are in `src/api/`. Update these when backend schema changes.
- **Backend Dependency** — The frontend requires the backend API running. See `sgc-navigator-backend` for backend setup.

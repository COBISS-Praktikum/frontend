# AGENTS.md - Frontend Development Guide

## Project Overview
React 19 + TypeScript + Vite frontend application for SGC Navigator — a semantic graph browser for exploring ~75,000 concepts in the Slovenian Thesaurus (COBISS). Features include full-text search with auto-suggestions and interactive force-directed graph visualization of concept relationships (broader, narrower, related terms). Supports Slovenian and English translations.

## Tech Stack
- **Runtime**: React 19 with React DOM
- **Language**: TypeScript 6.x (strict mode, ES2023 target)
- **Build Tool**: Vite 8.x with `@vitejs/plugin-react` (uses Oxc for fast transpilation)
- **Routing**: React Router 7.x (SPA routes are mounted under `/frontend/`, with route parameters for concept URIs)
- **API**: GraphQL via Apollo Client 4.x (development uses Vite proxy at `/graphql`; production uses `VITE_API_URL` via Apollo `HttpLink` and a CORS proxy fetch wrapper)
- **Linting**: ESLint 10.x (flat config format) with TypeScript, React Hooks, and React Refresh plugins
- **Styling**: Tailwind CSS 4.x (with `@tailwindcss/vite` plugin) + CSS modules co-located with components. UI components from `shadcn/ui` with `lucide-react` icons.
- **Visualization**: Dual graph rendering — `react-force-graph-2d` for force-directed concept relationships; `@xyflow/react` (ReactFlow) for hierarchical taxonomy layout
- **State**: Local React state (`useState`, `useMemo`, `useEffect`) + Apollo Client cache
- **Animations**: `framer-motion` (v12.x) for page transitions and component-level animations
- **SEO & Meta Tags**: `react-helmet-async` for dynamic document head management (title, meta tags, og: tags, canonical URLs)
- **Rate Limiting**: Client-side rate limiting (20 requests/minute) with ALTCHA CAPTCHA verification (`altcha` library)

## Essential Commands
```bash
npm run dev      # Start Vite dev server (HMR enabled at http://localhost:5173)
npm run build    # TypeScript check (tsc -b) THEN Vite build to /dist
npm run lint     # Run ESLint across all .ts/.tsx files
npm run preview  # Preview production build locally
npm run test     # Run test suite (Vitest) for CI/CD pipelines
npm run test:ui  # Run tests with interactive UI for development
```

**Key Workflow**: Type checking runs as part of build process, not separately via tsc command alone. Tests should pass before build in CI/CD.

## Project Structure & Patterns

### React Component Pattern
- **Functional components with hooks** (see `src/App.tsx` for reference)
- **File structure**: 
  - General components: `src/[ComponentName].tsx` + `src/[ComponentName].css`
  - UI components: `src/components/ui/` (from `shadcn/ui`)
  - Layout/common components: `src/components/layout/` (Header, Footer)
  - App-level components: `src/components/CaptchaModal.tsx` (rate limit gate)
  - Page components: `src/pages/[PageName].tsx` + `src/pages/[PageName].css` (routable pages)
- Use React 19's JSX transform (no need to import React)
- Entry point: `src/main.tsx` wraps app in `HelmetProvider`, `ApolloProvider`, `BrowserRouter`, and `RateLimitProvider` before rendering `App` + `CaptchaModal` into `#root` div
- **Routing**: Uses React Router 7.x with route parameters (e.g., `/frontend/graph/:uri` for concept detail pages)

### Page Components Pattern
Pages in `src/pages/` are top-level routable components:
- **SearchPage** (`/frontend/`) - Search interface with Apollo `useLazyQuery` for real-time suggestions
- **GraphPage** (`/frontend/graph/:uri`) - Concept detail page with tabbed graph/hierarchy views using Apollo `useQuery` + `useSearchParams`
Each page manages its own Apollo queries and route parameters via `useParams` and `useNavigate`.

### shadcn/ui
- The project uses `shadcn/ui` for its component library.
- Components are added via the `shadcn-ui` CLI, which places them in `src/components/ui`.
- Configuration is managed in `components.json`.
- The `cn` utility function in `src/lib/utils.ts` is used to merge Tailwind CSS classes.

### SEO & Document Head Management
- `react-helmet-async` is configured with `HelmetProvider` in `src/main.tsx` to wrap the app
- `SEO` component in `src/components/layout/SEO.tsx` provides reusable meta tag management
  - Props: `title`, `description`, `keywords` (string or array), `ogImage`, `canonicalUrl`
  - Automatically appends site name to title, sets og: tags, Twitter card meta tags
  - Language-aware: reads current language from `i18next` and sets `htmlAttributes.lang`
  - Example usage in SearchPage and GraphPage for dynamic page metadata
- Use `<SEO />` in page components to set page-specific metadata

### Utility Functions
- `cn()` - Merges Tailwind CSS class names using `clsx` and `tailwind-merge`
- `stripLanguageTag()` - Removes SKOS language tags from values (e.g., "term@en" → "term"); used throughout concept label rendering

### TypeScript Configuration
- **Split config**: `tsconfig.app.json` (src/ files) + `tsconfig.node.json` (build files)
- **Strict settings enabled** (via `tsconfig.app.json`):
  - `noUnusedLocals`, `noUnusedParameters` - unused code detection
  - `noFallthroughCasesInSwitch` - switch statement safety
  - Target: ES2023 with DOM APIs
- **Path Aliases**: The project uses path aliases configured in `tsconfig.app.json`. The main alias is `@/*` which maps to `src/*`.
- **Build info stored** in `node_modules/.tmp/` (git-ignored)

### ESLint Configuration
- **Flat config format** (`eslint.config.js`) - latest ESLint standard
- Active rules:
  - `@eslint/js` (recommended)
  - `typescript-eslint` (recommended)
  - `react-hooks` (exhaustive deps, rules of hooks)
  - `react-refresh` (Vite-specific: prevents invalid Fast Refresh exports)
- **Dist folder ignored** - no linting of build output

### Assets & Public Files
- `/src/assets/` - imported images (React/Vite logos, hero.png)
- `/public/` - static files served as-is (icons.svg, favicon.svg)
- SVG icons used via `<use>` tags with `/icons.svg#icon-name` paths

## Critical Integration Points

### GraphQL & Apollo Client
- Apollo Client configured in `src/config/apollo-client.ts`; `getGraphqlUri()` uses `/graphql` in development and `${VITE_API_URL}/graphql` in production
- In development, Vite proxies both `/graphql` and `/api` to `VITE_API_URL` from env (see `vite.config.ts` `server.proxy` + `loadEnv`)
  - `/graphql` - GraphQL endpoint
  - `/api` - API endpoints (e.g., CAPTCHA challenge/verification endpoints)
- In production, Apollo uses a custom fetch wrapper that routes GraphQL requests through `https://corsproxy.io/?`
- **Query patterns**:
  - `useQuery` for reactive data fetching (e.g., `GET_CONCEPT` in GraphPage for concept detail + relationships)
  - `useLazyQuery` for on-demand searches (e.g., `SEARCH_CONCEPTS` in SearchPage for autocomplete)
- GraphQL queries defined inline via `gql` template literals in component files
- **Common operations**: `query GetConcept($uri: String!)` fetches concept details with broader/narrower relationships

### Internationalization (i18n)
- The project uses `i18next` for internationalization.
- Configuration is in `src/config/i18n.ts`.
- Translation files are located in `public/locales/{lng}/translation.json`.
- i18next backend `loadPath` is `/frontend/locales/{{lng}}/translation.json` to match Vite `base`.
- The `useTranslation` hook from `react-i18next` should be used to translate text.

### Rate Limiting & CAPTCHA Verification
- **RateLimitContext** (`src/context/RateLimitContext.tsx`) manages client-side rate limiting and CAPTCHA state
  - Threshold: 20 requests per minute (configurable constant `RATE_LIMIT_THRESHOLD`)
  - Tracking: Request timestamps stored in React ref; timestamps older than 1 minute auto-purged
  - Interface: `checkRateLimit()` (returns boolean; shows modal if exceeded), `recordRequest()`, `isVerified`, `setShowCaptchaModal`
  - Verification persisted in `sessionStorage` as `captcha_verified` flag
- **CaptchaModal** (`src/components/CaptchaModal.tsx`) renders ALTCHA widget when rate limit triggered
  - Library: `altcha` (v3+); requires TypeScript definitions in `src/altcha.d.ts`
  - Challenge & verification endpoints configured via `VITE_API_URL` environment variable
  - In dev: routes to local `/api/auth/captcha-challenge` and `/api/auth/verify-gateway`
  - In prod: appends `VITE_API_URL` base to endpoints
  - On successful verification: sets `isVerified=true` in context, stores flag in sessionStorage, closes modal
- **Integration in SearchPage**: Uses `checkRateLimit()` before executing `useLazyQuery`; calls `recordRequest()` after passing check
- **Provider Setup**: `RateLimitProvider` wraps app in `src/main.tsx` (positioned between `Router` and `App`); `CaptchaModal` rendered as peer to `App` for modal overlay

### Force Graph Visualization
- GraphPage displays interactive concept relationships via **two complementary visualizations**:
  - **Force-Directed Graph** (`react-force-graph-2d`): D3 force simulation for organic concept clustering; auto-colored nodes, particle-animated links
  - **Hierarchy Layout** (`@xyflow/react` / ReactFlow): Tabbed hierarchical tree view of broader/narrower relationships using dagre layout algorithm (`@dagrejs/dagre`)
- Graph data structures:
  - ForceGraph: `{ nodes: [{id, name, uri}], links: [{source, target}] }`
  - Hierarchy: `{ nodes: [HierarchyFlowNode], edges: [HierarchyFlowEdge] }` with custom node component
- Example in `src/pages/GraphPage.tsx`: transforms Apollo query data (concept + broader/narrower/related) into both graph representations
- Tabs allow toggling between graph view and hierarchy view

### Vite HMR (Hot Module Replacement)
- Enabled by default in dev mode
- React Refresh plugin handles component updates without full reload
- **Important for developers**: Save edits to `.tsx` files for instant feedback

### Page Transitions & Animations
- `framer-motion` (v12.x) provides animation components for transitions and effects
- **Route transitions**: `AnimatePresence` in `App.tsx` wraps `Routes` with `location` key to trigger exit/enter animations on route changes
- **Component animations**: Individual components (SearchPage, GraphPage) use `motion` components for fade-ins, slides, and staggered effects
- **Usage pattern**: Import `{ motion, AnimatePresence }` from `'framer-motion'` and apply to JSX elements or replace standard HTML elements with `motion.div`, `motion.button`, etc.

### Build Output
- Production build via `npm run build` → `/dist` directory
- Type check runs first (`tsc -b`); build fails if TypeScript errors exist
- Preview changes verified via `npm run preview` before deployment

## Testing

### Test Framework
- **Vitest** (v4.x) - Fast unit test framework optimized for Vite projects
- **@testing-library/react** - React component testing utilities
- **jsdom** - JavaScript DOM implementation for browser-like testing environment

### Test Structure
Tests organized in `/src/tests/` directory with the following coverage:

1. **lib.utils.test.ts** - Utility function tests (11 tests)
   - `stripLanguageTag()` - SKOS language tag removal from concept labels
   - `cn()` - Tailwind CSS class merging utility
   - Edge cases: null, undefined, empty strings, conflicts

2. **apollo-client.test.ts** - Apollo Client configuration tests (4 tests)
   - Client instance and cache configuration
   - Development proxy setup
   - Production CORS proxy configuration
   - Environment-based setup validation

3. **app.test.tsx** - Routing and application structure tests (11 tests)
   - Route configuration verification (`/frontend/`, `/frontend/graph/:uri`)
   - Parameter support for concept URIs
   - Application structure patterns (functional components, Apollo, i18n)

### Running Tests
- **Development**: `npm run test:ui` - Opens interactive Vitest UI
- **CI/CD**: `npm run test` - Single run mode, suitable for pipelines
- **Specific tests**: `npx vitest src/tests/lib.utils.test.ts`

### Test Configuration
- **Config file**: `vitest.config.ts`
- **Setup file**: `src/tests/setup.ts` (cleanup, mocks, environment setup)
- **Globals**: `describe`, `it`, `expect` available without import
- **Coverage reporter**: V8 with html/json/text output

### Pipeline Integration
Add to CI/CD workflow:
```yaml
- name: Run tests
  run: npm run test
```

Recommended pipeline order:
```bash
npm run lint      # Check code style
npm run test      # Run tests
npm run build     # Build production bundle (includes tsc check)
```

## AI Agent Guidance (continued)

### When Adding Features
1. **Before creating new components**: Check what's currently in `src/` to avoid duplication
2. **Follow the App.tsx pattern**: Functional components, hooks for state, CSS co-located
3. **For data requirements**: Use Apollo `useQuery` or `useLazyQuery` for GraphQL fetching (see SearchPage and GraphPage patterns)
4. **For rate-limited operations**: Wrap queries with `useRateLimit()` hook (call `checkRateLimit()` before fetch, `recordRequest()` after pass); CAPTCHA modal auto-triggers on limit exceeded
5. **For graph visualizations**: Pick the right tool — use `react-force-graph-2d` for organic force-directed layouts, `@xyflow/react` for hierarchical trees (see GraphPage tabs)
6. **For page/route transitions**: Use `framer-motion` `AnimatePresence` wrapper around `Routes` with `location` key for automatic animated transitions between pages
7. **For SEO/meta tags**: Use `<SEO />` component in page components to set title, description, og: tags, and canonical URLs
8. **For multi-page features**: Add routes in `App.tsx` and create page components in `src/pages/`
9. **For utility functions**: Add tests in `src/tests/` (follow patterns in lib.utils.test.ts); run `npm run test` to verify
10. **Run `npm run lint`** after changes to ensure compliance with project's ESLint setup
11. **Ensure `npm run test` passes** before committing new features
12. **TypeScript errors block builds** - ensure `npm run build` succeeds before committing

### When Modifying Configuration
- `vite.config.ts` - Includes React plugin, Tailwind CSS plugin (`@tailwindcss/vite`), `base: '/frontend/'`, and env-driven dev proxy for `/graphql` and `/api` endpoints
- `eslint.config.js` - Uses flat config (v9+ format); if adding rules, maintain this format
- `tsconfig.app.json` - Strict mode enabled; verify new dependencies have type definitions

### When Installing Dependencies
- React Compiler is **disabled** (per README); if enabling, update `vite.config.ts`
- New packages should have `@types/` equivalents for TypeScript support
- Dependency types specified in `dependencies` (runtime) vs `devDependencies` (build-time)

## Context for Scaling
- **Routing**: React Router 7.x is configured with `/frontend/` (search) and `/frontend/graph/:uri` (concept detail) routes. Extend via additional `<Route>` entries in `App.tsx`.
- **State management**: Currently local component state (useState) + Apollo client cache. Step up to Zustand or Redux for non-Apollo state.
- **API layer**: GraphQL via Apollo Client handles all data fetching. Query complexity or caching needs may require cache policies or field merging.
- **Styling approach**: Combination of Tailwind CSS 4.x (via `@tailwindcss/vite`), `shadcn/ui` components, and co-located CSS modules. Maintain this pattern or discuss before changing.
- **Icons**: lucide-react provides SVG icons (used in header language selector). Prefer lucide icons for new UI elements.

## References
- [Vite React Documentation](https://vite.dev/)
- [React 19 Docs](https://react.dev/)
- [TypeScript ESM Config](https://www.typescriptlang.org/tsconfig)
- [ESLint Flat Config Docs](https://eslint.org/docs/latest/use/configure/configuration-files)
- [React Router Docs](https://reactrouter.com/)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [react-force-graph GitHub](https://github.com/vasturiano/react-force-graph)
- [ReactFlow Docs](https://reactflow.dev/) (for hierarchy visualization)
- [ALTCHA Documentation](https://altcha.com/docs) (for CAPTCHA verification)
- [framer-motion Docs](https://www.framer.com/motion/) (for page transitions and animations)
- [react-helmet-async Docs](https://github.com/steverichey/react-helmet-async) (for document head management)
- [shadcn/ui Components](https://ui.shadcn.com/)

## Available Skills
- **apollo-client**: For GraphQL query patterns, cache management, and Apollo Client setup guidance
- **shadcn**: For component library management (adding/styling shadcn/ui components)

## Skills location /.agents/skills


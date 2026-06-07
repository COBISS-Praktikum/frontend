# SGC Navigator Frontend

## O SGC Navigatorju

**SGC Navigator** je spletni navigator za Splošni geslovnik COBISS (SGC / Splošni geslovnik COBISS), kontrolirani tezaver v slovenskem sistemu COBISS.SI.

Navigator uporabnikom omogoča iskanje približno **75.000 SKOS izrazov** in raziskovanje njihovih hierarhičnih in asociativnih razmerij prek interaktivnega grafičnega prikaza. Uporabniki se lahko navigirajo med širšimi pojmi (nadrejeni), ožjimi pojmi (podrejeni) in sorodnimi izrazi vizualiziranimi kot interaktivni konceptni graf — bodisi kot organski grafični prikaz z gravitacijo ali hierarhično drevesno strukturo. Vsi izrazi so dostopni v slovenščini in angleščini.

**Ciljni uporabniki**: Uporabniki COBISS Plus in knjižničarji

**Povezava do naše aplikacije** [SGC-Navigator](https://cobiss-praktikum.github.io/frontend/)

**Podobne rešitve**: [GND Explorer](https://explore.gnd.network/) (Nemški nacionalni tezaver)

## Tehnološki sklad

| Kategorija | Tehnologija |
|---|---|
| **Runtime** | React 19 z React DOM |
| **Jezik** | TypeScript 6.x (stroga nastavitev, cilj ES2023) |
| **Gradnja** | Vite 8.x z `@vitejs/plugin-react` (Oxc transpilacija) |
| **Usmerjanje** | React Router 7.x (SPA poti pod `/frontend/`, parametri za URI-je konceptov) |
| **API** | GraphQL prek Apollo Client 4.x (razvojni proxy `/graphql`; produkcija prek `VITE_API_URL`) |
| **Linting** | ESLint 10.x (flat config format) z TypeScript, React Hooks in React Refresh vtičniki |
| **Oblikovanje** | Tailwind CSS 4.x + CSS moduli skupno s komponentami; UI komponente iz `shadcn/ui` z `lucide-react` ikonami |
| **Vizualizacija** | `react-force-graph-2d` (gravitacijski graf) + `@xyflow/react` / ReactFlow (hierarhična taksonomija) |
| **Stanje** | Lokalno React stanje (`useState`, `useMemo`, `useEffect`) + Apollo Client predpomnilnik |
| **Animacije** | `framer-motion` v12.x (prehodi med stranmi, animacije komponent) |
| **SEO** | `react-helmet-async` (dinamično upravljanje glave dokumenta: title, meta, og: oznake, canonical URL) |
| **i18n** | `i18next` + `react-i18next` (datoteke prevodov v `public/locales/{lng}/translation.json`) |
| **Omejevanje dostopa** | Odjemalsko omejevanje (20 zahtev/minuto) + ALTCHA CAPTCHA preveritev (`altcha` knjižnica) |
| **Testiranje** | Vitest 4.x + `@testing-library/react` + jsdom |
| **Kontejnerizacija** | Docker + Docker Compose |

## Predpogoji

- Node.js 20+
- npm/yarn
- Docker & Docker Compose (za zagon polne sklope lokalno)
- Zaledna GraphQL API (glejte `sgc-navigator-backend`)

## Začetek

```bash
npm install
npm run dev        # razvojni strežnik na http://localhost:5173
```

## Dostopni ukazi

| Ukaz | Opis |
|---|---|
| `npm run dev` | Zagon Vite razvojnega strežnika s HMR na `http://localhost:5173` |
| `npm run build` | Preverjanje tipov (`tsc -b`) in gradnja v `/dist` |
| `npm run preview` | Predogled produkcijske gradnje lokalno |
| `npm run lint` | Zagon ESLinta na vseh `.ts`/`.tsx` datotekah |
| `npm run test` | Zagon testne suite (Vitest) — enojni tek, primeren za CI/CD |
| `npm run test:ui` | Zagon testov z interaktivnim Vitest UI za razvoj |

**Ključni vzorec**: Preverjanje tipov se izvede kot del procesa gradnje. Testi morajo biti uspešni pred gradnjo v CI/CD. Priporočen vrstni red: `lint → test → build`.

## Struktura projekta

```
src/
├── main.tsx                  # Vstopna točka — HelmetProvider, ApolloProvider, BrowserRouter, RateLimitProvider
├── App.tsx                   # Definicija poti in AnimatePresence za prehode med stranmi
├── config/
│   ├── apollo-client.ts      # Konfiguracija Apollo Client (razvoj: proxy, produkcija: CORS proxy)
│   └── i18n.ts               # Konfiguracija i18next
├── context/
│   └── RateLimitContext.tsx  # Odjemalsko omejevanje dostopa in stanje CAPTCHA
├── components/
│   ├── ui/                   # shadcn/ui komponente
│   ├── layout/               # Header, Footer, SEO komponente
│   └── CaptchaModal.tsx      # ALTCHA CAPTCHA modal (sproži se ob prekoračitvi omejitve)
├── pages/
│   ├── SearchPage.tsx        # Iskalni vmesnik (/frontend/) z Apollo useLazyQuery
│   └── GraphPage.tsx         # Stran koncepta (/frontend/graph/:uri) z zavihki graf/hierarhija
├── lib/
│   └── utils.ts              # cn() in stripLanguageTag() pomožne funkcije
├── tests/                    # Vitest testi (lib.utils, apollo-client, app)
├── assets/                   # Uvožene slike
└── altcha.d.ts               # TypeScript definicije za ALTCHA
public/
├── locales/                  # Datoteke prevodov (sl, en)
├── icons.svg                 # SVG ikone (dostopane prek <use>)
└── favicon.svg
```

## Spremenljivke okolja

Ustvari datoteko `.env` v korenu projekta:

```env
VITE_API_URL=    # Osnovni URL zalednega API strežnika (GraphQL in /api končne točke)
VITE_GROQ_KEY=   # API ključ za Groq storitev
```

> **Opomba**: V razvoju Vite posreduje zahteve `/graphql` in `/api` na `VITE_API_URL` prek `vite.config.ts` proxy nastavitve. V produkciji Apollo Client neposredno uporablja `VITE_API_URL`.

## Docker

`Dockerfile` in `docker-compose.yml` sta zagotovljena za kompartmentalizirano razporeditev in lokalni polno-skladni razvoj.

### Lokalni razvoj z Docker Compose

Zagon obeh storitev frontend in backend:

```bash
docker-compose up
```

To zagoni:
- Frontend na `http://localhost:5173` (Vite razvojni strežnik s HMR)
- Backend na `http://localhost:8080` (GraphQL končna točka)

## CI/CD

GitHub Actions delovni tok samodejno:

- **Lint** — Zagon ESLinta na vseh `.ts`/`.tsx` datotekah
- **Testi** — Zagon testne suite z Vitest (`npm run test`)
- **Preverjanje tipov** — Validacija TypeScript kompilacije (izvedena kot del `npm run build`)
- **Gradnja** — Ustvarjanje produkcijske gradnje (`npm run build`)

Priporočen vrstni red v pipeline:

```yaml
- name: Lint
  run: npm run lint
- name: Run tests
  run: npm run test
- name: Build
  run: npm run build
```

Vodovod se zagne na:
- Vsak push na `main` / `develop` veje
- Vse zahteve za povlečenje
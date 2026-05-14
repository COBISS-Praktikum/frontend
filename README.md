# SGC Navigator Frontend

## O SGC Navigatorju

**SGC Navigator** je spletni navigator za Splošni geslovnik COBISS (SGC / Splošni geslovnik COBISS), kontrolirani tezaver v slovenskem sistemu COBISS.SI. 

Navigator uporabnikom omogoča iskanje približno **700.000 SKOS izrazov** in raziskovanje njihovih hierarhičnih in asociativnih razmerij prek interaktivnega grafičnega prikaza. Uporabniki se lahko navigirajo med širšimi pojmi (nadrejeni), ožjimi pojmi (podrejeni) in sorodnimi izrazi (sorodni izrazi) vizualiziranimi kot interaktivni konceptni graf. Vsi izrazi so dostopni v slovenščini in angleščini.

**Ciljni uporabniki**: Uporabniki COBISS Plus in knjižničarji

**Podobne rešitve**: [GND Explorer](https://explore.gnd.network/) (Německi nacionalni tezaver)

## Tehnološki sklad

- **Frontend**: React 19 + TypeScript (stroga nastavitev)
- **Gradnja**: Vite 8 z `@vitejs/plugin-react` (Oxc transpilacija)
- **API**: GraphQL (Apollo Client)
- **Kontejnerizacija**: Docker + Docker Compose

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
| `npm run dev` | Zagon Vite razvojnega strežnika s HMR |
| `npm run build` | Preverjanje tipov in gradnja v `/dist` |
| `npm run preview` | Predogled produkcijske gradnje lokalno |
| `npm run lint` | Zagon ESLinta na vseh `.ts`/`.tsx` datotekah |

## Struktura projekta

```
src/
├── main.tsx              # Vstopna točka React aplikacije
├── App.tsx               # Koreninski komponent
├── components/
│   ├── SearchBar/        # Iskanje izrazov z samodopolnjevanjem
│   ├── GraphView/        # Interaktivni konceptni graf (širši/ožji/sorodna)
│   └── TermDetail/       # Plošča s podrobnostmi izraza (prefLabel, altLabel, scopeNote, SL/EN)
├── api/                  # GraphQL odjemalec in poizvedbe
└── assets/
```

**Ključni vzorec**: Funkcijski komponenti s React hookami, skupno sklenjeni CSS moduli za oblikovanje.

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
- **Preverjanje tipov** — Validacija TypeScript kompilacije (`tsc -b`)
- **Gradnja** — Ustvarjanje produkcijske gradnje (`npm run build`)
- **Testi** — Zagon testne suite (ko je dodana)

Vodovod se zagne na:
- Vsak push na `main` / `develop` veje
- Vse zahteve za povlečenje


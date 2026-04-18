# Mordheim Campaign Manager (HTML5 + JS)

A browser-only prototype for multi-user Mordheim campaign management.

## Implemented in this version

- Login page with:
  - username
  - password
  - campaign password
- Account/login behavior:
  - `Login / Register` registers if the username+campaign scope does not exist yet.
  - Existing users must provide the correct password for that username+campaign scope.
- After login, users land on **Create and manage Warbands**.
- Warbands are tied to both:
  - user login
  - campaign password scope
- Create Warband supports two modes:
  - **Standard Rules**
    - 500 gc cap
    - mercenary faction enforcement
    - basic creation constraints at creation (hero caps and max 6 heroes)
  - **Free**
    - no creation rule enforcement
- Existing warbands are displayed read-only in the manage section.
- Warband changes are modeled as append-only **logged transactions** with full history:
  - inbetween games
  - pre-match events
  - match-events
  - post-match

## Transaction logging

Every transaction stores:

- transaction type
- date
- warband
- gold delta
- XP delta
- detailed notes
- actor and timestamp

A full transaction history is rendered in the UI and persists in `localStorage`.

## Run

Open `index.html` directly in a browser, or serve statically:

```bash
python -m http.server 8080
```

Then open http://localhost:8080

## Notes

- This is still client-side only and not secure for production authentication.
- Next step for real deployment is a backend with proper password hashing and server-side authorization.

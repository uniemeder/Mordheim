# Mordheim Mercenary Roster Builder (HTML5 + JS)

This project is now a **pure HTML5 + JavaScript** web app (no Python backend).

## Scope (current milestone)

- Build a mercenary warband hero roster.
- Support up to **6 hero slots**.
- Restrict hero choices to mercenary-appropriate hero types:
  - Captain (max 1)
  - Champion (max 2)
  - Youngblood (max 2)
  - Promoted Henchman (max 1)
- Track base hero costs + extra gear costs.
- Persist/load roster in browser `localStorage`.

## Run locally

Open `index.html` directly in your browser,
or serve with a static server, e.g.:

```bash
python -m http.server 8080
```

Then open: http://localhost:8080

## Next steps

- Add henchmen groups and unit caps.
- Add injury and advancement workflow after matches.
- Add campaign/match logging and dashboard views.

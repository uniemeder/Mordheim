# Mordheim Warband Manager (MVP)

A small Flask app to manage **Mordheim** campaign data:

- Users can manage their own warbands.
- A match can include one or more warbands.
- Match events can log gains/losses/xp/purchases/hires/injuries.
- Dashboard view shows current warbands, matches, and outcomes.

## Quickstart

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open: http://127.0.0.1:5000

## Data model (initial)

- `User` (owner)
- `Warband` (name, faction, treasury)
- `Match` (scenario, date)
- `MatchEvent` (event log with gold/xp deltas)
- `match_warbands` (many-to-many join table)

## Notes

This is an MVP scaffold. Next good steps:

1. Add authentication and per-user access controls.
2. Split event types into richer domain entities (injuries, equipment, roster changes).
3. Add campaign progression reports and charting.
4. Add API endpoints and frontend SPA if desired.

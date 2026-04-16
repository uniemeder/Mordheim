from datetime import datetime

from flask import Flask, redirect, render_template, request, url_for
from flask_sqlalchemy import SQLAlchemy


app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///mordheim.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


match_warbands = db.Table(
    "match_warbands",
    db.Column("match_id", db.Integer, db.ForeignKey("match.id"), primary_key=True),
    db.Column("warband_id", db.Integer, db.ForeignKey("warband.id"), primary_key=True),
)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    warbands = db.relationship("Warband", backref="owner", lazy=True)


class Warband(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    faction = db.Column(db.String(120), nullable=False)
    treasury_gc = db.Column(db.Integer, nullable=False, default=0)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)


class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scenario = db.Column(db.String(120), nullable=False)
    played_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    warbands = db.relationship(
        "Warband", secondary=match_warbands, lazy="subquery", backref="matches"
    )
    events = db.relationship("MatchEvent", backref="match", lazy=True)


class MatchEvent(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey("match.id"), nullable=False)
    warband_id = db.Column(db.Integer, db.ForeignKey("warband.id"), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    summary = db.Column(db.String(255), nullable=False)
    gold_change = db.Column(db.Integer, nullable=False, default=0)
    xp_change = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    warband = db.relationship("Warband", backref="events")


@app.route("/")
def dashboard():
    users = User.query.order_by(User.name.asc()).all()
    warbands = Warband.query.order_by(Warband.name.asc()).all()
    matches = Match.query.order_by(Match.played_at.desc()).all()

    total_events = MatchEvent.query.count()
    total_gold_change = db.session.query(db.func.coalesce(db.func.sum(MatchEvent.gold_change), 0)).scalar()
    total_xp_change = db.session.query(db.func.coalesce(db.func.sum(MatchEvent.xp_change), 0)).scalar()

    return render_template(
        "dashboard.html",
        users=users,
        warbands=warbands,
        matches=matches,
        total_events=total_events,
        total_gold_change=total_gold_change,
        total_xp_change=total_xp_change,
    )


@app.route("/users", methods=["POST"])
def create_user():
    name = request.form.get("name", "").strip()
    if name:
        db.session.add(User(name=name))
        db.session.commit()
    return redirect(url_for("dashboard"))


@app.route("/warbands", methods=["POST"])
def create_warband():
    name = request.form.get("name", "").strip()
    faction = request.form.get("faction", "").strip()
    owner_id = request.form.get("owner_id", type=int)
    treasury_gc = request.form.get("treasury_gc", type=int, default=0)

    if name and faction and owner_id:
        db.session.add(
            Warband(
                name=name,
                faction=faction,
                owner_id=owner_id,
                treasury_gc=treasury_gc,
            )
        )
        db.session.commit()
    return redirect(url_for("dashboard"))


@app.route("/matches", methods=["POST"])
def create_match():
    scenario = request.form.get("scenario", "").strip()
    warband_ids = [int(w) for w in request.form.getlist("warband_ids") if w.isdigit()]

    if scenario and warband_ids:
        match = Match(scenario=scenario)
        match.warbands = Warband.query.filter(Warband.id.in_(warband_ids)).all()
        db.session.add(match)
        db.session.commit()
    return redirect(url_for("dashboard"))


@app.route("/events", methods=["POST"])
def create_event():
    match_id = request.form.get("match_id", type=int)
    warband_id = request.form.get("warband_id", type=int)
    event_type = request.form.get("event_type", "").strip()
    summary = request.form.get("summary", "").strip()
    gold_change = request.form.get("gold_change", type=int, default=0)
    xp_change = request.form.get("xp_change", type=int, default=0)

    if match_id and warband_id and event_type and summary:
        event = MatchEvent(
            match_id=match_id,
            warband_id=warband_id,
            event_type=event_type,
            summary=summary,
            gold_change=gold_change,
            xp_change=xp_change,
        )
        db.session.add(event)
        warband = Warband.query.get(warband_id)
        if warband:
            warband.treasury_gc += gold_change
        db.session.commit()
    return redirect(url_for("dashboard"))


@app.cli.command("init-db")
def init_db():
    db.create_all()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)

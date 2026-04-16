from app import Match, MatchEvent, User, Warband, app, db


def setup_module(module):
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    with app.app_context():
        db.drop_all()
        db.create_all()


def test_can_create_user_warband_match_and_event():
    with app.app_context():
        user = User(name="Alice")
        db.session.add(user)
        db.session.flush()

        warband = Warband(name="Doom Crows", faction="Reiklanders", owner_id=user.id)
        db.session.add(warband)
        db.session.flush()

        match = Match(scenario="Wyrdstone Hunt")
        match.warbands.append(warband)
        db.session.add(match)
        db.session.flush()

        event = MatchEvent(
            match_id=match.id,
            warband_id=warband.id,
            event_type="gain",
            summary="Recovered extra wyrdstone",
            gold_change=20,
            xp_change=2,
        )
        db.session.add(event)
        db.session.commit()

        assert User.query.count() == 1
        assert Warband.query.count() == 1
        assert Match.query.count() == 1
        assert MatchEvent.query.count() == 1
        assert match.events[0].summary == "Recovered extra wyrdstone"

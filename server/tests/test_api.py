from datetime import date, timedelta

from app.core.config import settings
from app.core.security import hash_password
from app.models import Child, ChildDailyStat, ChildStatus, Reward, User, UserStatus
from app.services.progress import current_streak, record_speaking_day


async def test_register_verify_login(client):
    ac, _ = client
    r = await ac.post(
        "/auth/register",
        json={"email": "a@b.com", "password": "secret123!", "display_name": "Alex", "child_name": "Mia"},
    )
    assert r.status_code == 200
    token = r.json()["dev_verify_token"]
    v = await ac.post("/auth/verify-email", json={"token": token})
    assert v.status_code == 200
    assert v.json()["access_token"]
    login = await ac.post("/auth/login", json={"email": "a@b.com", "password": "secret123!"})
    assert login.status_code == 200
    me = await ac.get("/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.json()["email"] == "a@b.com"
    kids = await ac.get("/children", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert kids.status_code == 200
    assert [k["display_name"] for k in kids.json()] == ["Mia"]


async def test_children_isolation_and_activity(client):
    ac, Session = client
    async with Session() as db:
        u1 = User(email="p1@x.com", password_hash=hash_password("secret123!"), status=UserStatus.active)
        u2 = User(email="p2@x.com", password_hash=hash_password("secret123!"), status=UserStatus.active)
        db.add_all([u1, u2])
        await db.flush()
        c1 = Child(parent_id=u1.id, display_name="Mia", status=ChildStatus.active)
        c2 = Child(parent_id=u2.id, display_name="Sam", status=ChildStatus.active)
        db.add_all([c1, c2])
        await db.commit()
        c1_id, c2_id = str(c1.id), str(c2.id)

    login = await ac.post("/auth/login", json={"email": "p1@x.com", "password": "secret123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    kids = await ac.get("/children", headers=headers)
    assert [k["display_name"] for k in kids.json()] == ["Mia"]
    forbidden = await ac.get(f"/children/{c2_id}/activity", headers=headers)
    assert forbidden.status_code == 404
    act = await ac.get(f"/children/{c1_id}/activity", headers=headers)
    assert act.status_code == 200
    body = act.json()
    assert "week" in body
    assert set(body["week"]) >= {"words_practiced", "streak_days", "minutes", "accuracy_pct", "days"}
    assert len(body["week"]["days"]) == 7


async def test_admin_login_page(client):
    ac, _ = client
    res = await ac.get("/admin/login", follow_redirects=True)
    assert res.status_code == 200
    assert "login" in res.text.lower() or "username" in res.text.lower()


async def test_record_speaking_day_streak_and_idempotency(client):
    _, Session = client
    async with Session() as db:
        user = User(email="streak@x.com", password_hash=hash_password("secret123!"), status=UserStatus.active)
        db.add(user)
        await db.flush()
        child = Child(parent_id=user.id, display_name="Mia", status=ChildStatus.active)
        db.add(child)
        await db.commit()
        child_id = child.id

        first = await record_speaking_day(db, child_id, minutes=5, words=2)
        await db.commit()
        assert first.streak_days == 1
        assert first.stars_earned == 5
        assert await current_streak(db, child_id) == 1

        second = await record_speaking_day(db, child_id, minutes=3, words=1)
        await db.commit()
        assert second.streak_days == 1
        assert second.stars_earned == 0

        from sqlalchemy import func, select

        today = await db.scalar(
            select(ChildDailyStat).where(
                ChildDailyStat.child_id == child_id,
                ChildDailyStat.stat_date == date.today(),
            )
        )
        assert today is not None
        assert today.minutes == 8
        assert today.words_practiced == 3
        reward_count = await db.scalar(select(func.count()).select_from(Reward).where(Reward.child_id == child_id))
        assert int(reward_count or 0) == 1

        # Seed yesterday and clear today so the next record continues the streak to 2.
        await db.delete(today)
        db.add(
            ChildDailyStat(
                child_id=child_id,
                stat_date=date.today() - timedelta(days=1),
                words_practiced=1,
                minutes=5,
                streak_days=1,
            )
        )
        await db.commit()

        nxt = await record_speaking_day(db, child_id, minutes=5, words=1)
        await db.commit()
        assert nxt.streak_days == 2
        assert nxt.stars_earned == 5
        assert await current_streak(db, child_id) == 2


async def test_child_reply_done_updates_home_streak(client):
    ac, Session = client
    async with Session() as db:
        user = User(email="talk@x.com", password_hash=hash_password("secret123!"), status=UserStatus.active)
        db.add(user)
        await db.flush()
        child = Child(parent_id=user.id, display_name="Mia", status=ChildStatus.active)
        db.add(child)
        await db.commit()
        child_id = str(child.id)

    login = await ac.post("/auth/login", json={"email": "talk@x.com", "password": "secret123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    home0 = await ac.get(f"/children/{child_id}/home", headers=headers)
    assert home0.status_code == 200
    assert home0.json()["streak_days"] == 0

    conv = await ac.post(
        "/conversations",
        headers=headers,
        json={"child_id": child_id, "title": "Talk", "context": "lesson:practice"},
    )
    assert conv.status_code == 200
    conversation_id = conv.json()["id"]

    done = False
    last = None
    for _ in range(settings.llm_max_turns + 1):
        last = await ac.post(
            f"/conversations/{conversation_id}/child-reply",
            headers=headers,
            json={"text_content": "hello kick", "heard_speech": True},
        )
        assert last.status_code == 200
        body = last.json()
        assert body["accepted"] is True
        if body.get("done"):
            done = True
            break
    assert done is True
    assert last is not None
    assert last.json()["streak_days"] == 1
    assert last.json()["stars_earned"] == 5

    home1 = await ac.get(f"/children/{child_id}/home", headers=headers)
    assert home1.status_code == 200
    assert home1.json()["streak_days"] == 1
    assert home1.json()["stars"] >= 1

    # Same-day second completion: streak stays 1, no new stars
    conv2 = await ac.post(
        "/conversations",
        headers=headers,
        json={"child_id": child_id, "title": "Talk 2", "context": "lesson:practice"},
    )
    conversation_id2 = conv2.json()["id"]
    last2 = None
    for _ in range(settings.llm_max_turns + 1):
        last2 = await ac.post(
            f"/conversations/{conversation_id2}/child-reply",
            headers=headers,
            json={"text_content": "hello again", "heard_speech": True},
        )
        assert last2.status_code == 200
        if last2.json().get("done"):
            break
    assert last2 is not None
    assert last2.json()["done"] is True
    assert last2.json()["streak_days"] == 1
    assert last2.json()["stars_earned"] == 0


async def test_end_conversation_records_streak(client):
    ac, Session = client
    async with Session() as db:
        user = User(email="end@x.com", password_hash=hash_password("secret123!"), status=UserStatus.active)
        db.add(user)
        await db.flush()
        child = Child(parent_id=user.id, display_name="Mia", status=ChildStatus.active)
        db.add(child)
        await db.commit()
        child_id = str(child.id)

    login = await ac.post("/auth/login", json={"email": "end@x.com", "password": "secret123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    conv = await ac.post(
        "/conversations",
        headers=headers,
        json={"child_id": child_id, "title": "Talk", "context": "lesson:practice"},
    )
    conversation_id = conv.json()["id"]

    # One accepted reply, then leave early via /end
    reply = await ac.post(
        f"/conversations/{conversation_id}/child-reply",
        headers=headers,
        json={"text_content": "hello kick", "heard_speech": True},
    )
    assert reply.status_code == 200
    assert reply.json()["accepted"] is True
    assert reply.json().get("done") is not True

    ended = await ac.post(f"/conversations/{conversation_id}/end", headers=headers)
    assert ended.status_code == 200
    body = ended.json()
    assert body["recorded"] is True
    assert body["streak_days"] == 1
    assert body["stars_earned"] == 5

    home = await ac.get(f"/children/{child_id}/home", headers=headers)
    assert home.json()["streak_days"] == 1

    # Ending again the same day does not re-award stars
    ended2 = await ac.post(f"/conversations/{conversation_id}/end", headers=headers)
    assert ended2.status_code == 200
    assert ended2.json()["streak_days"] == 1
    assert ended2.json()["stars_earned"] == 0

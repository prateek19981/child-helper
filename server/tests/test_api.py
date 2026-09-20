from app.core.security import hash_password
from app.models import Child, ChildStatus, User, UserStatus


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

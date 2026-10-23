import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import connect_to_mongo, close_mongo_connection, get_database

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await connect_to_mongo()
    yield
    await close_mongo_connection()

@pytest_asyncio.fixture
async def admin_headers():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/auth/login", json={
            "email": "admin@materialmapp.com",
            "password": "admin123"
        })
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_health_check():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

@pytest.mark.asyncio
async def test_auth_login_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/auth/login", json={
            "email": "admin@materialmapp.com",
            "password": "admin123"
        })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@materialmapp.com"

@pytest.mark.asyncio
async def test_auth_login_invalid():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post("/api/auth/login", json={
            "email": "admin@materialmapp.com",
            "password": "wrongpassword"
        })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_masters_get_and_uniqueness(admin_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/masters", headers=admin_headers)
        assert res.status_code == 200
        masters = res.json()
        assert "VehicleNo" in masters
        assert "TypeMode" in masters

        # Add unique vehicle
        unique_v = f"MP09TEST{uuid.uuid4().hex[:6].upper()}"
        add_res = await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": unique_v
        }, headers=admin_headers)
        assert add_res.status_code == 200
        assert add_res.json()["value"] == unique_v

        # Try duplicate
        dup_res = await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": unique_v.lower()
        }, headers=admin_headers)
        assert dup_res.status_code == 400
        assert "already exists" in dup_res.json()["detail"]

@pytest.mark.asyncio
async def test_destination_routing_and_calculations(admin_headers):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Case 1: Royalty Sale -> royalty_sale (with GST)
        royalty_payload = {
            "date": "10/14/2026",
            "vehicle_no": "MP09GG1230",
            "transport_type": "VMPL",
            "type_mode": "Royalty Sale",
            "material_name": "10MM",
            "party_name": "NAWAZ KHAN",
            "g_wt": 15000,
            "t_wt": 5000,
            "rate": 200,
            "gst_rate": 5
        }
        res1 = await ac.post("/api/entries", json=royalty_payload, headers=admin_headers)
        assert res1.status_code == 201
        data1 = res1.json()
        assert data1["saved_in"] == "royalty_sale"
        entry1 = data1["entry"]
        assert entry1["net_wt"] == 10000.0  # 15000 - 5000
        assert entry1["amount"] == 2000.0 # (10000 / 1000) * 200
        assert entry1["gst_amount"] == 100.0 # 5% of 2000
        assert entry1["total_amount"] == 2100.0 # 2000 + 100

        # Case 2: HR Loading + With Royalty -> hr_loading (with GST)
        hr_with_royalty = {
            "date": "10/14/2026",
            "vehicle_no": "MP09BS6668",
            "transport_type": "VMPL",
            "type_mode": "HR Loading",
            "hr_loading_type": "With Royalty",
            "material_name": "GSB",
            "party_name": "SAGEER PATEL",
            "g_wt": 12000,
            "t_wt": 2000,
            "rate": 300,
            "gst_rate": 18
        }
        res2 = await ac.post("/api/entries", json=hr_with_royalty, headers=admin_headers)
        assert res2.status_code == 201
        data2 = res2.json()
        assert data2["saved_in"] == "hr_loading"
        assert data2["entry"]["gst_rate"] == 18.0
        assert data2["entry"]["gst_amount"] == 540.0

        # Case 3: HR Loading + Without Royalty -> hr_loading (NO GST)
        hr_without_royalty = {
            "date": "10/14/2026",
            "vehicle_no": "MP09BS6668",
            "transport_type": "VMPL",
            "type_mode": "HR Loading",
            "hr_loading_type": "Without Royalty",
            "material_name": "GSB",
            "party_name": "SAGEER PATEL",
            "g_wt": 10000,
            "t_wt": 2000,
            "rate": 300,
            "gst_rate": 18
        }
        res3 = await ac.post("/api/entries", json=hr_without_royalty, headers=admin_headers)
        assert res3.status_code == 201
        data3 = res3.json()
        assert data3["saved_in"] == "hr_loading"
        assert data3["entry"]["gst_rate"] == 0.0
        assert data3["entry"]["gst_amount"] == 0.0
        assert data3["entry"]["total_amount"] == data3["entry"]["amount"]

@pytest.mark.asyncio
async def test_user_isolation_and_blank_first_signup():
    """
    CRITICAL REQUIREMENT:
    Verify that when a brand new user registers and signs in:
    1. Their entries list is completely BLANK (0 entries).
    2. Their summary total is 0.
    3. Their masters dropdowns for custom categories are blank (only standard Type/Modes exist).
    4. Their next challan series starts at 001.
    5. Data created by User A is NEVER visible to User B, and vice-versa.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        user_a_email = f"user_a_{uuid.uuid4().hex[:6]}@example.com"
        user_b_email = f"user_b_{uuid.uuid4().hex[:6]}@example.com"
        password = "SecurePassword123"

        # 1. Register User A
        reg_a = await ac.post("/api/auth/register", json={
            "email": user_a_email,
            "password": password,
            "name": "User Alpha"
        })
        assert reg_a.status_code == 200

        # Login User A
        login_a = await ac.post("/api/auth/login", json={
            "email": user_a_email,
            "password": password
        })
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 2. User A initial state MUST be 100% BLANK
        entries_a = await ac.get("/api/entries", headers=headers_a)
        assert entries_a.status_code == 200
        assert len(entries_a.json()) == 0  # Blank entries!

        summary_a = await ac.get("/api/entries/summary", headers=headers_a)
        assert summary_a.status_code == 200
        assert summary_a.json()["total_entries"] == 0

        next_ch_a = await ac.get("/api/entries/next-challan", headers=headers_a)
        assert next_ch_a.status_code == 200
        assert next_ch_a.json()["next_challan_no"] == "001"

        masters_a = await ac.get("/api/masters", headers=headers_a)
        assert masters_a.status_code == 200
        data_m_a = masters_a.json()
        assert len(data_m_a["VehicleNo"]) == 0
        assert len(data_m_a["TransportName"]) == 0
        assert len(data_m_a["MaterialName"]) == 0
        assert len(data_m_a["PartyName"]) == 0
        assert len(data_m_a["TypeMode"]) >= 6  # Standard system modes available

        # 3. User A adds a vehicle and creates an entry
        await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": "ALPHA-TRUCK-01"
        }, headers=headers_a)

        entry_res_a = await ac.post("/api/entries", json={
            "date": "10/23/2026",
            "vehicle_no": "ALPHA-TRUCK-01",
            "transport_type": "Default",
            "type_mode": "Cash Sale",
            "material_name": "10MM",
            "party_name": "Alpha Party",
            "cum": 5,
            "rate": 400
        }, headers=headers_a)
        assert entry_res_a.status_code == 201
        assert entry_res_a.json()["entry"]["challan_no"] == "001"

        # Verify User A now has 1 entry
        entries_a_after = await ac.get("/api/entries", headers=headers_a)
        assert len(entries_a_after.json()) == 1

        # 4. Register and Login User B (Brand New User)
        reg_b = await ac.post("/api/auth/register", json={
            "email": user_b_email,
            "password": password,
            "name": "User Beta"
        })
        assert reg_b.status_code == 200

        login_b = await ac.post("/api/auth/login", json={
            "email": user_b_email,
            "password": password
        })
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 5. User B MUST have completely BLANK data (NEVER see User A's data!)
        entries_b = await ac.get("/api/entries", headers=headers_b)
        assert entries_b.status_code == 200
        assert len(entries_b.json()) == 0  # Blank! User A's entry is not shown!

        summary_b = await ac.get("/api/entries/summary", headers=headers_b)
        assert summary_b.json()["total_entries"] == 0

        next_ch_b = await ac.get("/api/entries/next-challan", headers=headers_b)
        assert next_ch_b.json()["next_challan_no"] == "001"  # Independent sequence!

        masters_b = await ac.get("/api/masters", headers=headers_b)
        assert "ALPHA-TRUCK-01" not in masters_b.json()["VehicleNo"]
        assert len(masters_b.json()["VehicleNo"]) == 0

        # 6. User B creates their own entry with their own challan 001
        entry_res_b = await ac.post("/api/entries", json={
            "date": "10/23/2026",
            "vehicle_no": "BETA-VEHICLE-99",
            "transport_type": "Default",
            "type_mode": "Credit Sale",
            "material_name": "GSB",
            "party_name": "Beta Party",
            "cum": 10,
            "rate": 350
        }, headers=headers_b)
        assert entry_res_b.status_code == 201
        assert entry_res_b.json()["entry"]["challan_no"] == "001"

        # 7. Re-check User A's entries: User A only has User A's entry!
        entries_a_final = await ac.get("/api/entries", headers=headers_a)
        assert len(entries_a_final.json()) == 1
        assert entries_a_final.json()[0]["vehicle_no"] == "ALPHA-TRUCK-01"

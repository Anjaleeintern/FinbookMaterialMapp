import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import connect_to_mongo, close_mongo_connection

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await connect_to_mongo()
    yield
    await close_mongo_connection()

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
async def test_masters_get_and_uniqueness():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Ensure test master item exists
        await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": "MP09GG1230"
        })

        res = await ac.get("/api/masters")
        assert res.status_code == 200
        masters = res.json()
        assert "VehicleNo" in masters
        assert "MP09GG1230" in masters["VehicleNo"]

        # 2. Try adding duplicate VehicleNo (case-insensitive)
        dup_res = await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": "mp09gg1230"
        })
        assert dup_res.status_code == 400
        assert "already exists" in dup_res.json()["detail"]

        # 3. Add brand new unique vehicle
        new_val = "RJ14AB9999"
        add_res = await ac.post("/api/masters", json={
            "category": "VehicleNo",
            "value": new_val
        })
        assert add_res.status_code == 200
        assert add_res.json()["value"] == new_val

@pytest.mark.asyncio
async def test_destination_routing_and_calculations():
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
        res1 = await ac.post("/api/entries", json=royalty_payload)
        assert res1.status_code == 201
        data1 = res1.json()
        assert data1["saved_in"] == "royalty_sale"
        entry1 = data1["entry"]
        assert entry1["net_wt"] == 10000.0  # 15000 - 5000
        assert entry1["amount"] == 2000000.0 # 10000 * 200
        assert entry1["gst_amount"] == 100000.0 # 5% of 2000000
        assert entry1["total_amount"] == 2100000.0 # 2000000 + 100000

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
        res2 = await ac.post("/api/entries", json=hr_with_royalty)
        assert res2.status_code == 201
        data2 = res2.json()
        assert data2["saved_in"] == "hr_loading"
        assert data2["entry"]["gst_rate"] == 18.0
        assert data2["entry"]["gst_amount"] == 540000.0

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
            "gst_rate": 18 # Stale value must be ignored/zeroed out
        }
        res3 = await ac.post("/api/entries", json=hr_without_royalty)
        assert res3.status_code == 201
        data3 = res3.json()
        assert data3["saved_in"] == "hr_loading"
        assert data3["entry"]["gst_rate"] == 0.0
        assert data3["entry"]["gst_amount"] == 0.0
        assert data3["entry"]["total_amount"] == data3["entry"]["amount"]

        # Case 4: Cash Sale -> cash_sale (Payment mode defaulted to Cash)
        cash_payload = {
            "date": "10/14/2026",
            "vehicle_no": "MP09GG1150",
            "transport_type": "MSK",
            "type_mode": "Cash Sale",
            "material_name": "20MM",
            "party_name": "ALTAMASH KHAN",
            "cum": 5,
            "rate": 500
        }
        res4 = await ac.post("/api/entries", json=cash_payload)
        assert res4.status_code == 201
        data4 = res4.json()
        assert data4["saved_in"] == "cash_sale"
        assert data4["entry"]["payment_mode"] == "Cash"

        # Case 5: QR Sale -> qr_sale (Payment mode defaulted to QR)
        qr_payload = {
            "date": "10/14/2026",
            "vehicle_no": "RJ09GE1458",
            "transport_type": "MSK",
            "type_mode": "QR Sale",
            "material_name": "M-SAND",
            "party_name": "ANIL AARIYA",
            "cum": 8,
            "rate": 450
        }
        res5 = await ac.post("/api/entries", json=qr_payload)
        assert res5.status_code == 201
        data5 = res5.json()
        assert data5["saved_in"] == "qr_sale"
        assert data5["entry"]["payment_mode"] == "QR"

        # Case 6: Credit Sale -> credit_sale
        credit_payload = {
            "date": "10/14/2026",
            "vehicle_no": "MP09GG7934",
            "transport_type": "VMPL",
            "type_mode": "Credit Sale",
            "material_name": "10MM",
            "party_name": "PUSHPENDRA",
            "cum": 10,
            "rate": 400
        }
        res6 = await ac.post("/api/entries", json=credit_payload)
        assert res6.status_code == 201
        data6 = res6.json()
        assert data6["saved_in"] == "credit_sale"

        # Case 7: Without Royalty -> without_royalty
        without_payload = {
            "date": "10/14/2026",
            "vehicle_no": "MP09GG1230",
            "transport_type": "VMPL",
            "type_mode": "Without Royalty",
            "material_name": "GSB",
            "party_name": "NAWAZ KHAN",
            "cum": 12,
            "rate": 350
        }
        res7 = await ac.post("/api/entries", json=without_payload)
        assert res7.status_code == 201
        data7 = res7.json()
        assert data7["saved_in"] == "without_royalty"

@pytest.mark.asyncio
async def test_get_all_entries_aggregation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/entries")
        assert res.status_code == 200
        entries = res.json()
        assert len(entries) >= 6
        for e in entries:
            assert "saved_in" in e
            assert e["saved_in"] in [
                "royalty_sale", "without_royalty", "credit_sale",
                "cash_sale", "qr_sale", "hr_loading"
            ]

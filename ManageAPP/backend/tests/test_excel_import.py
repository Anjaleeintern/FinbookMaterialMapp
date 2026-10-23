import pytest
import pytest_asyncio
import io
import sys
import os
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import connect_to_mongo, close_mongo_connection
from services.excel_service import (
    generate_sample_excel_template,
    parse_excel_or_csv_bytes,
    process_raw_imported_rows,
)

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await connect_to_mongo()
    yield
    await close_mongo_connection()

@pytest.mark.asyncio
async def test_generate_and_parse_template():
    # 1. Generate template
    template_bytes = generate_sample_excel_template()
    assert len(template_bytes) > 1000

    # 2. Parse template
    raw_rows, sheets = parse_excel_or_csv_bytes(template_bytes, "template.xlsx")
    assert len(raw_rows) == 5

    # 3. Process rows
    valid_entries, errors = process_raw_imported_rows(raw_rows)
    assert len(valid_entries) == 5
    assert len(errors) == 0

    # Check calculations and destination routing
    first = valid_entries[0]
    assert first["vehicle_no"] == "MP09GG1230"
    assert first["target_collection"] == "royalty_sale"
    assert first["net_wt"] == 45790.0  # 60790 - 15000
    assert first["gst_rate"] == 5.0

    second = valid_entries[1]
    assert second["vehicle_no"] == "MP09BS6668"
    assert second["target_collection"] == "cash_sale"
    assert second["payment_mode"] == "Cash"

@pytest.mark.asyncio
async def test_csv_parsing():
    csv_content = """Date,VehicleNo,TransportType,Type/Mode,MaterialName,PartyName,G.WT,T.WT,Rate
10/18/2026,MP09AB1111,VMPL,Royalty Sale,10MM,TEST PARTY,50000,10000,500
10/17/2026,MP09AB2222,MSK,Cash Sale,20MM,ANOTHER PARTY,40000,10000,600
"""
    raw_rows, sheets = parse_excel_or_csv_bytes(csv_content.encode('utf-8'), "data.csv")
    assert len(raw_rows) == 2

    valid_entries, errors = process_raw_imported_rows(raw_rows)
    assert len(valid_entries) == 2
    assert len(errors) == 0
    # Date sorting: 10/17/2026 should come before 10/18/2026
    assert valid_entries[0]["vehicle_no"] == "MP09AB2222"
    assert valid_entries[1]["vehicle_no"] == "MP09AB1111"

@pytest.mark.asyncio
async def test_api_template_and_preview():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Login to get auth token
        login_res = await ac.post("/api/auth/login", json={
            "email": "admin@materialmapp.com",
            "password": "admin123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Template
        res_tpl = await ac.get("/api/entries/template")
        assert res_tpl.status_code == 200
        assert "spreadsheetml" in res_tpl.headers.get("content-type", "")

        # Preview
        files = {
            "file": ("test_import.xlsx", res_tpl.content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        }
        res_prev = await ac.post("/api/entries/import-excel?preview_only=true", files=files, headers=headers)
        assert res_prev.status_code == 200
        data = res_prev.json()
        assert data["preview"] is True
        assert data["valid_count"] == 5
        assert data["error_count"] == 0
        assert "royalty_sale" in data["by_collection"]

@pytest.mark.asyncio
async def test_sheet_name_and_default_mode_detection():
    import openpyxl
    # Create workbook where sheet title is 'Royalty Sale' but rows have NO Type/Mode column
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Royalty Sale"
    ws.append(["Date", "VehicleNo", "MaterialName", "PartyName", "Rate", "G.WT", "T.WT"])
    ws.append(["10/16/2026", "MP09XX9999", "10MM", "TEST PARTY", 450, 50000, 10000])

    buf = io.BytesIO()
    wb.save(buf)
    file_bytes = buf.getvalue()

    # 1. Parse without default_mode: should detect "Royalty Sale" from ws.title
    raw_rows, _ = parse_excel_or_csv_bytes(file_bytes, "oct_data.xlsx")
    assert len(raw_rows) == 1
    assert raw_rows[0]["type_mode"] == "Royalty Sale"

    valid_entries, errors = process_raw_imported_rows(raw_rows)
    assert len(valid_entries) == 1
    assert len(errors) == 0
    assert valid_entries[0]["target_collection"] == "royalty_sale"

    # 2. Test generic sheet title 'OCT-2026' with default_type_mode='Cash Sale'
    wb2 = openpyxl.Workbook()
    ws2 = wb2.active
    ws2.title = "OCT-2026"
    ws2.append(["Date", "VehicleNo", "MaterialName", "PartyName", "Rate", "G.WT", "T.WT"])
    ws2.append(["10/16/2026", "MP09YY8888", "20MM", "CASH PARTY", 500, 40000, 10000])

    buf2 = io.BytesIO()
    wb2.save(buf2)
    file_bytes2 = buf2.getvalue()

    raw_rows2, _ = parse_excel_or_csv_bytes(file_bytes2, "OCT-2026.xlsx", default_type_mode="Cash Sale")
    assert len(raw_rows2) == 1
    assert raw_rows2[0]["type_mode"] == "Cash Sale"

    valid_entries2, errors2 = process_raw_imported_rows(raw_rows2, default_type_mode="Cash Sale")
    assert len(valid_entries2) == 1

    assert len(errors2) == 0
    assert valid_entries2[0]["target_collection"] == "cash_sale"
    assert valid_entries2[0]["payment_mode"] == "Cash"

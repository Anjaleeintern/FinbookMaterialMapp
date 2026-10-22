from models.entry_models import EntryCreate

def process_entry_calculations(entry: EntryCreate) -> dict:
    data = entry.model_dump()

    # 1. Net Weight calculation: G.WT - T.WT
    g_wt = float(data.get("g_wt") or 0.0)
    t_wt = float(data.get("t_wt") or 0.0)
    net_wt = max(0.0, round(g_wt - t_wt, 2))
    data["net_wt"] = net_wt

    # 2. Base Amount: ((NET WT / 1000) * Rate) if NET WT > 0 else (CUM * Rate)
    rate = float(data.get("rate") or 0.0)
    cum = float(data.get("cum") or 0.0)
    if net_wt > 0:
        amount = round((net_wt / 1000.0) * rate, 2)
    else:
        amount = round(cum * rate, 2)
    data["amount"] = amount

    # 3. HR Loading Type validation & sanitization
    type_mode = data.get("type_mode")
    if type_mode == "HR Loading":
        if not data.get("hr_loading_type"):
            data["hr_loading_type"] = "Without Royalty"
    else:
        data["hr_loading_type"] = None

    # 4. GST Applicability:
    # OR([Type/Mode] = "Royalty Sale", AND([Type/Mode] = "HR Loading", [HR Loading Type] IN ["Royalty Sale", "With Royalty"]))
    is_gst_applicable = (
        type_mode == "Royalty Sale" or
        (type_mode == "HR Loading" and data.get("hr_loading_type") in ["Royalty Sale", "With Royalty"])
    )

    if is_gst_applicable:
        gst_rate = float(data.get("gst_rate") or 0.0)
        data["gst_rate"] = gst_rate
        gst_amount = round((amount * gst_rate) / 100.0, 2)
        data["gst_amount"] = gst_amount
        data["total_amount"] = round(amount + gst_amount, 2)
    else:
        data["gst_rate"] = 0.0
        data["gst_amount"] = 0.0
        data["total_amount"] = amount

    # 5. Payment Mode Applicability:
    # IN([Type/Mode], LIST("Cash Sale", "QR Sale"))
    is_cash_or_qr = (
        type_mode in ["Cash Sale", "Case Sale", "Case sale", "case sale", "QR Sale"]
        or "cash" in type_mode.lower()
        or "case" in type_mode.lower()
        or "qr" in type_mode.lower()
    )
    if is_cash_or_qr:
        if not data.get("payment_mode"):
            data["payment_mode"] = "QR" if ("qr" in type_mode.lower()) else "Cash"
    else:
        data["payment_mode"] = None

    return data

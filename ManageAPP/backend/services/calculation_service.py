from models.entry_models import EntryCreate

def process_entry_calculations(entry: EntryCreate) -> dict:
    data = entry.model_dump()

    # 1. Net Weight calculation: G.WT - T.WT (Weights are in Tons by default)
    g_wt = float(data.get("g_wt") or 0.0)
    t_wt = float(data.get("t_wt") or 0.0)
    net_wt = max(0.0, round(g_wt - t_wt, 2))
    data["net_wt"] = net_wt

    # 2. Rate Calculation Unit: CUM vs MT
    # If CUM: amount = cum * rate
    # If MT: amount = net_wt * rate (Tons by default, no / 1000)
    rate_calc_unit = (data.get("rate_calc_unit") or "MT").strip().upper()
    if rate_calc_unit not in ["MT", "CUM"]:
        rate_calc_unit = "MT"
    data["rate_calc_unit"] = rate_calc_unit

    rate = float(data.get("rate") or 0.0)
    cum = float(data.get("cum") or 0.0)
    if rate_calc_unit == "CUM":
        amount = round(cum * rate, 2)
    else:
        amount = round(net_wt * rate, 2)
    data["amount"] = amount

    # 3. Sale Type validation & Mode Normalization
    data["sale_type"] = (data.get("sale_type") or "").strip() or None
    data["hr_loading_type"] = None

    type_mode = (data.get("type_mode") or "").strip()
    if type_mode == "QR Sale":
        data["type_mode"] = "Cash Sale"
        data["payment_mode"] = "QR"

    # 4. Additional Charges:
    additional_charges = data.get("additional_charges")
    if additional_charges and isinstance(additional_charges, list) and len(additional_charges) > 0:
        cleaned_charges = []
        total_add = 0.0
        names = []
        for item in additional_charges:
            if isinstance(item, dict):
                c_name = str(item.get("name") or "").strip()
                c_amt = float(item.get("amount") or 0.0)
                if c_name or c_amt > 0:
                    cleaned_charges.append({"name": c_name, "amount": c_amt})
                    total_add += c_amt
                    if c_name:
                        names.append(c_name)
        data["additional_charges"] = cleaned_charges
        data["additional_charge_amount"] = round(total_add, 2)
        data["additional_charge_name"] = ", ".join(names) if names else None
        add_charge_amount = round(total_add, 2)
    else:
        add_charge_amount = float(data.get("additional_charge_amount") or 0.0)
        data["additional_charge_amount"] = add_charge_amount
        data["additional_charge_name"] = (data.get("additional_charge_name") or "").strip() or None

    # Taxable Value = Amount + Additional Charges
    taxable_amount = round(amount + add_charge_amount, 2)
    data["taxable_amount"] = taxable_amount

    # 5. Party State Determination (Intra-state MP vs Inter-state outside MP)
    party_state = (data.get("party_state") or "").strip()
    state_norm = party_state.lower()
    is_mp = state_norm in ["madhya pradesh", "mp", "m.p.", "m.p"] or not party_state

    # 6. GST Applicability: Available & calculated across all sale types
    gst_rate = float(data.get("gst_rate") or 0.0)
    data["gst_rate"] = gst_rate

    if gst_rate > 0:
        if is_mp:
            # Intra-state: CGST + SGST (split 50-50)
            cgst_rate = round(gst_rate / 2.0, 2)
            sgst_rate = round(gst_rate / 2.0, 2)
            cgst_amount = round((taxable_amount * cgst_rate) / 100.0, 2)
            sgst_amount = round((taxable_amount * sgst_rate) / 100.0, 2)
            total_gst = round(cgst_amount + sgst_amount, 2)

            data["cgst_rate"] = cgst_rate
            data["cgst_amount"] = cgst_amount
            data["sgst_rate"] = sgst_rate
            data["sgst_amount"] = sgst_amount
            data["igst_rate"] = 0.0
            data["igst_amount"] = 0.0
            data["gst_amount"] = total_gst
        else:
            # Inter-state (outside MP): Full IGST
            igst_rate = gst_rate
            igst_amount = round((taxable_amount * igst_rate) / 100.0, 2)
            total_gst = igst_amount

            data["cgst_rate"] = 0.0
            data["cgst_amount"] = 0.0
            data["sgst_rate"] = 0.0
            data["sgst_amount"] = 0.0
            data["igst_rate"] = igst_rate
            data["igst_amount"] = igst_amount
            data["gst_amount"] = total_gst
    else:
        data["gst_rate"] = 0.0
        data["gst_amount"] = 0.0
        data["cgst_rate"] = 0.0
        data["cgst_amount"] = 0.0
        data["sgst_rate"] = 0.0
        data["sgst_amount"] = 0.0
        data["igst_rate"] = 0.0
        data["igst_amount"] = 0.0

    # 7. Total Amount & Round Off (rounded to nearest rupee)
    gst_amt = float(data.get("gst_amount") or 0.0)
    raw_total = round(taxable_amount + gst_amt, 2)
    if "round_off" in data and data["round_off"] is not None:
        try:
            round_off = round(float(data["round_off"]), 2)
        except (ValueError, TypeError):
            round_off = round(round(raw_total) - raw_total, 2)
    else:
        round_off = round(round(raw_total) - raw_total, 2)

    data["round_off"] = round_off
    data["total_amount"] = round(raw_total + round_off, 2)

    # 5. Payment Mode Applicability & Customer Name:
    is_cash = "cash" in type_mode.lower() or "case" in type_mode.lower() or "qr" in type_mode.lower()
    if is_cash:
        cust_name = (data.get("customer_name") or "").strip()
        data["customer_name"] = cust_name or None
        party_val = (data.get("party_name") or "").strip()
        if not party_val or party_val == "Cash Sale":
            data["party_name"] = cust_name or "Cash Sale"

        pm = (data.get("payment_mode") or "Cash").strip()
        low_pm = pm.lower()
        if low_pm == "bank":
            data["payment_mode"] = "Bank"
        elif low_pm == "qr":
            data["payment_mode"] = "QR"
        else:
            data["payment_mode"] = "Cash"
    else:
        data["customer_name"] = None
        data["payment_mode"] = None

    return data

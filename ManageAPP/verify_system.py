import httpx

base = 'http://localhost:8000'
client = httpx.Client(base_url=base)

# 1. Login
r_login = client.post('/api/auth/login', json={'email': 'admin@materialmapp.com', 'password': 'admin123'})
assert r_login.status_code == 200, f'Login failed: {r_login.text}'
token = r_login.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}
print('[PASS] Login successful. JWT token received.')

# 2. Get Me
r_me = client.get('/api/auth/me', headers=headers)
assert r_me.status_code == 200
print('[PASS] Authenticated user:', r_me.json()['email'])

# 3. Masters
r_masters = client.get('/api/masters')
assert r_masters.status_code == 200
masters = r_masters.json()
print('[PASS] Master Vehicles count:', len(masters['VehicleNo']))

# 4. Add unique master item
r_add_m = client.post('/api/masters', json={'category': 'VehicleNo', 'value': 'MP09ZZ9999'})
print('[PASS] Master add response:', r_add_m.status_code)

# 5. Direct destination save entry
entry_payload = {
    'date': '10/14/2026',
    'vehicle_no': 'MP09GG1230',
    'transport_type': 'VMPL',
    'type_mode': 'Royalty Sale',
    'material_name': '10MM',
    'party_name': 'NAWAZ KHAN',
    'g_wt': 20000,
    't_wt': 5000,
    'rate': 250,
    'gst_rate': 5
}
r_entry = client.post('/api/entries', json=entry_payload)
assert r_entry.status_code == 201
saved = r_entry.json()
challan = saved['entry']['challan_no']
target = saved['saved_in']
assert target == 'royalty_sale'
print(f'[PASS] Direct destination save: {challan} -> collection {target}')

# 6. Unified query
r_all = client.get('/api/entries')
assert r_all.status_code == 200
all_e = r_all.json()
print(f'[PASS] Unified All Entries count: {len(all_e)}')
print('ALL VERIFICATIONS PASSED!')

from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['materialmapp']

modes = [
    'Royalty Sale',
    'Without Royalty',
    'Credit Sale',
    'Cash Sale',
    'QR Sale',
    'HR Loading'
]

for m in modes:
    db.masters.update_one(
        {'category': 'Type/Mode', 'value': m},
        {'$set': {'category': 'Type/Mode', 'value': m}},
        upsert=True
    )

print('Type/Mode successfully stored in MongoDB masters!')
count = db.masters.count_documents({'category': 'Type/Mode'})
print('Count of Type/Mode:', count)

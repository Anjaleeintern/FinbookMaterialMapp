from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['materialmapp']

# Delete all transaction documents from the 4 destination collections
for col in ['royalty_sale', 'without_royalty', 'credit_sale', 'cash_sale']:
    res = db[col].delete_many({})
    print(f'Cleared {res.deleted_count} documents from {col}')

# Reset sequence counter to 0
db.counters.update_one({'_id': 'challan_seq'}, {'$set': {'seq': 0}}, upsert=True)
print('Reset challan_seq to 0.')

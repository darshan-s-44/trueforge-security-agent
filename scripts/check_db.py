import sqlite3

db_path = r'C:\Users\darsh\AppData\Local\trueforge\Data\db\db.sqlite'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== MESSAGES IN THREAD / SESSION 01m190fj1fkbv5cw3gxrff2zjs ===")
cursor.execute("SELECT rowid, * FROM thread_context_log WHERE session_id='01m190fj1fkbv5cw3gxrff2zjs' ORDER BY rowid ASC")
rows = cursor.fetchall()
for r in rows:
    print(r)

print("\n=== ALL THREAD CONTEXT LOGS ===")
cursor.execute("SELECT rowid, session_id, message_id, created_at FROM thread_context_log ORDER BY rowid DESC LIMIT 10")
for r in cursor.fetchall():
    print(r)

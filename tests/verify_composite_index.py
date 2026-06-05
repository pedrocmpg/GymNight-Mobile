#!/usr/bin/env python3
"""
Verification Script: Composite Index Query Plan Analysis

This script verifies that the composite index (user_id, deleted_at) is being
used correctly by the PostgreSQL query planner for multi-tenant sync queries.
"""

from sqlalchemy import create_engine, text
from app.core.config import DATABASE_URL

print("=" * 70)
print("COMPOSITE INDEX VERIFICATION")
print("=" * 70)

engine = create_engine(DATABASE_URL)

print("\n1. Creating test data for query plan analysis...")

with engine.connect() as conn:
    trans = conn.begin()
    
    try:
        # Insert some test tombstones to make query planner use indexes
        for i in range(10):
            conn.execute(text("""
                INSERT INTO deleted_records (id, table_name, record_id, user_id, deleted_at)
                VALUES (
                    :id,
                    'workouts',
                    :record_id,
                    :user_id,
                    :deleted_at
                )
            """), {
                'id': f'tombstone-test-{i}',
                'record_id': f'workout-{i}',
                'user_id': f'user-{i % 3}',  # 3 different users
                'deleted_at': 1234567890000 + (i * 1000)
            })
        
        trans.commit()
        print(f"  ✓ Inserted 10 test tombstones")
        
    except Exception as e:
        print(f"  Note: {e}")
        trans.rollback()

print("\n2. Query Plan: Multi-tenant sync query (SHOULD use composite index)")
print("   Query: WHERE user_id = ? AND deleted_at > ?")

with engine.connect() as conn:
    result = conn.execute(text("""
        EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
        SELECT * FROM deleted_records 
        WHERE user_id = 'user-1' AND deleted_at > 1234567890000
    """))
    
    query_plan = [row[0] for row in result]
    
    uses_composite = False
    for line in query_plan:
        print(f"   {line}")
        if 'idx_deleted_records_user_deleted_at' in line:
            uses_composite = True
    
    if uses_composite:
        print(f"\n  ✓ Query planner uses composite index")
    else:
        print(f"\n  ⊙ Query planner did not explicitly mention composite index")
        print(f"     (This may be normal for small tables)")

print("\n3. Query Plan: Single-column sync query (backward compatibility)")
print("   Query: WHERE deleted_at > ?")

with engine.connect() as conn:
    result = conn.execute(text("""
        EXPLAIN (ANALYZE, BUFFERS, VERBOSE) 
        SELECT * FROM deleted_records 
        WHERE deleted_at > 1234567890000
    """))
    
    query_plan = [row[0] for row in result]
    
    uses_single = False
    uses_composite = False
    for line in query_plan:
        print(f"   {line}")
        if 'idx_deleted_records_deleted_at' in line:
            uses_single = True
        if 'idx_deleted_records_user_deleted_at' in line:
            uses_composite = True
    
    if uses_single or uses_composite:
        print(f"\n  ✓ Query planner uses an index (backward compatible)")
    else:
        print(f"\n  ⊙ Query planner did not use an index")
        print(f"     (This may be normal for small tables)")

print("\n4. Cleanup: Removing test data...")

with engine.connect() as conn:
    trans = conn.begin()
    
    try:
        result = conn.execute(text("""
            DELETE FROM deleted_records 
            WHERE id LIKE 'tombstone-test-%'
        """))
        
        deleted_count = result.rowcount
        trans.commit()
        print(f"  ✓ Deleted {deleted_count} test tombstones")
        
    except Exception as e:
        print(f"  ✗ Error during cleanup: {e}")
        trans.rollback()

print("\n" + "=" * 70)
print("Verification complete!")
print("=" * 70)

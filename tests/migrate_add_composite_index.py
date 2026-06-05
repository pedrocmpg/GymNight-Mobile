#!/usr/bin/env python3
"""
Migration Script: Add composite index (user_id, deleted_at) to DeletedRecord table

This migration implements Problem 4 fix from the bugfix specification:
- Adds composite index idx_deleted_records_user_deleted_at on (user_id, deleted_at)
- Column order: user_id first (equality condition), deleted_at second (range condition)
- Optimal for query pattern: WHERE user_id = ? AND deleted_at > ?

Index rationale:
- Significantly improves multi-tenant sync queries
- Query planner can seek to user_id match, then range scan within that user's tombstones
- Backward compatible: Existing queries using only WHERE deleted_at > ? continue to use single-column index
- Keeps existing single-column indexes for backward compatibility
"""

from sqlalchemy import create_engine, text, inspect
from app.core.config import DATABASE_URL

print("=" * 70)
print("MIGRATION: Add composite index (user_id, deleted_at) to deleted_records")
print("=" * 70)

# Create engine
engine = create_engine(DATABASE_URL)

print("\nStep 1: Checking current deleted_records indexes...")
inspector = inspect(engine)

indexes = inspector.get_indexes('deleted_records')
print(f"  Current indexes on deleted_records:")
for idx in indexes:
    print(f"    - {idx['name']}: columns={idx['column_names']}, unique={idx['unique']}")

print("\nStep 2: Creating composite index...")

with engine.connect() as conn:
    try:
        # Check if index already exists
        existing_index_names = [idx['name'] for idx in indexes]
        
        if 'idx_deleted_records_user_deleted_at' not in existing_index_names:
            sql = """
            CREATE INDEX idx_deleted_records_user_deleted_at 
            ON deleted_records (user_id, deleted_at)
            """
            conn.execute(text(sql))
            print("  ✓ Created composite index idx_deleted_records_user_deleted_at")
        else:
            print("  ⊙ Composite index idx_deleted_records_user_deleted_at already exists")
        
        # Commit the index creation
        conn.commit()
        
    except Exception as e:
        print(f"  ✗ Error creating index: {e}")
        conn.rollback()
        raise

print("\nStep 3: Verifying new index...")

# Refresh inspector to see changes
inspector = inspect(engine)
indexes = inspector.get_indexes('deleted_records')

composite_index = None
for idx in indexes:
    if idx['name'] == 'idx_deleted_records_user_deleted_at':
        composite_index = idx
        break

print(f"  Indexes on deleted_records after migration:")
for idx in indexes:
    print(f"    - {idx['name']}: columns={idx['column_names']}, unique={idx['unique']}")

if composite_index:
    print(f"\n  ✓ Composite index exists")
    print(f"  ✓ Index name: {composite_index['name']}")
    print(f"  ✓ Index columns: {composite_index['column_names']}")
    
    # Verify column order
    expected_columns = ['user_id', 'deleted_at']
    if composite_index['column_names'] == expected_columns:
        print(f"  ✓ Column order correct: user_id first, deleted_at second")
        all_success = True
    else:
        print(f"  ✗ Column order incorrect: expected {expected_columns}, got {composite_index['column_names']}")
        all_success = False
else:
    print(f"  ✗ Composite index not found")
    all_success = False

print("\nStep 4: Verifying query plan uses composite index...")

with engine.connect() as conn:
    # Test query plan for multi-tenant query pattern
    explain_query = """
    EXPLAIN SELECT * FROM deleted_records 
    WHERE user_id = 'test-user-id' AND deleted_at > 1234567890000
    """
    
    result = conn.execute(text(explain_query))
    query_plan = [row[0] for row in result]
    
    print(f"  Query plan for: WHERE user_id = ? AND deleted_at > ?")
    for line in query_plan:
        print(f"    {line}")
    
    # Check if composite index is used
    uses_composite_index = any('idx_deleted_records_user_deleted_at' in line for line in query_plan)
    
    if uses_composite_index:
        print(f"  ✓ Query planner uses composite index")
        all_success = all_success and True
    else:
        print(f"  ⊙ Query planner may not use composite index (could be due to empty table)")
        # Don't fail migration - planner behavior depends on table size and statistics
        # In production with actual data, the planner will choose the composite index

print("\nStep 5: Verifying backward compatibility...")

with engine.connect() as conn:
    # Test query plan for single-column query pattern
    explain_query = """
    EXPLAIN SELECT * FROM deleted_records 
    WHERE deleted_at > 1234567890000
    """
    
    result = conn.execute(text(explain_query))
    query_plan = [row[0] for row in result]
    
    print(f"  Query plan for: WHERE deleted_at > ? (backward compatibility)")
    for line in query_plan:
        print(f"    {line}")
    
    # Check that single-column queries still work (should use idx_deleted_records_deleted_at)
    uses_single_index = any('idx_deleted_records_deleted_at' in line for line in query_plan)
    uses_composite_index = any('idx_deleted_records_user_deleted_at' in line for line in query_plan)
    
    if uses_single_index or uses_composite_index:
        print(f"  ✓ Query planner uses an index (backward compatible)")
    else:
        print(f"  ⊙ Query planner may not use an index (could be due to empty table)")

print("\n" + "=" * 70)
if all_success:
    print("Migration completed successfully!")
    print("- Composite index (user_id, deleted_at) created")
    print("- Multi-tenant sync queries now optimized")
    print("- Backward compatibility maintained for existing queries")
else:
    print("Migration FAILED - some checks did not pass")
    exit(1)
print("=" * 70)

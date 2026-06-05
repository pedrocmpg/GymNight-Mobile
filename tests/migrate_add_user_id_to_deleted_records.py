#!/usr/bin/env python3
"""
Migration Script: Add user_id column to DeletedRecord table

This migration implements Problem 3 fix from the bugfix specification:
- Adds user_id VARCHAR(36) column to deleted_records table (NULLABLE)
- Updates create_tombstone_on_delete() trigger function to populate user_id

Column is NULLABLE because:
- Exercises have no user_id (shared catalog)
- Existing tombstones cannot be backfilled
- NULL means "applies to all users" or "user unknown"

Trigger function population logic:
- For users table: v_user_id := OLD.id (deleted user's ID)
- For exercises table: v_user_id := NULL (no ownership)
- For other tables: Extract OLD.user_id dynamically
"""

from sqlalchemy import create_engine, text, inspect
from app.core.config import DATABASE_URL

print("=" * 70)
print("MIGRATION: Add user_id column to DeletedRecord table")
print("=" * 70)

# Create engine
engine = create_engine(DATABASE_URL)

print("\nStep 1: Checking current deleted_records schema...")
inspector = inspect(engine)

columns = [col['name'] for col in inspector.get_columns('deleted_records')]
print(f"  deleted_records: {', '.join(columns)}")

print("\nStep 2: Adding user_id column...")

with engine.connect() as conn:
    try:
        # Check if column already exists
        if 'user_id' not in columns:
            sql = "ALTER TABLE deleted_records ADD COLUMN user_id VARCHAR(36)"
            conn.execute(text(sql))
            print("  ✓ Added deleted_records.user_id")
        else:
            print("  ⊙ deleted_records.user_id already exists")
        
        # Commit the column addition
        conn.commit()
        
    except Exception as e:
        print(f"  ✗ Error adding column: {e}")
        conn.rollback()
        raise

print("\nStep 3: Updating create_tombstone_on_delete() trigger function...")

# Import the updated trigger function SQL from the model
from app.database.models.sync import CREATE_TOMBSTONE_FUNCTION_SQL

with engine.connect() as conn:
    try:
        # Execute CREATE OR REPLACE FUNCTION
        conn.execute(text(CREATE_TOMBSTONE_FUNCTION_SQL))
        print("  ✓ Updated create_tombstone_on_delete() function")
        
        # Commit the function update
        conn.commit()
        
    except Exception as e:
        print(f"  ✗ Error updating trigger function: {e}")
        conn.rollback()
        raise

print("\nStep 4: Verifying new schema...")

# Refresh inspector to see changes
inspector = inspect(engine)

columns = [col['name'] for col in inspector.get_columns('deleted_records')]
has_user_id = 'user_id' in columns

print(f"  deleted_records columns: {', '.join(columns)}")
status_symbol = "✓" if has_user_id else "✗"
print(f"  {status_symbol} user_id column present")

print("\nStep 5: Verifying trigger function update...")

with engine.connect() as conn:
    # Check if the trigger function exists and contains user_id logic
    result = conn.execute(text("""
        SELECT prosrc 
        FROM pg_proc 
        WHERE proname = 'create_tombstone_on_delete'
    """))
    
    function_source = result.scalar()
    
    if function_source:
        has_user_id_logic = 'v_user_id' in function_source
        has_declare = 'DECLARE' in function_source
        has_if_users = "TG_TABLE_NAME = 'users'" in function_source
        has_if_exercises = "TG_TABLE_NAME = 'exercises'" in function_source
        
        print(f"  ✓ Trigger function exists")
        print(f"  {'✓' if has_declare else '✗'} Has DECLARE block")
        print(f"  {'✓' if has_user_id_logic else '✗'} Has v_user_id variable")
        print(f"  {'✓' if has_if_users else '✗'} Has users table conditional")
        print(f"  {'✓' if has_if_exercises else '✗'} Has exercises table conditional")
        
        all_success = has_user_id and has_user_id_logic and has_declare and has_if_users and has_if_exercises
    else:
        print("  ✗ Trigger function not found")
        all_success = False

print("\n" + "=" * 70)
if all_success:
    print("Migration completed successfully!")
    print("- user_id column added to deleted_records table")
    print("- Trigger function updated to populate user_id")
    print("- Multi-tenant tombstone filtering now supported")
else:
    print("Migration FAILED - some checks did not pass")
    exit(1)
print("=" * 70)

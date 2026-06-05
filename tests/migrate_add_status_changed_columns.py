#!/usr/bin/env python3
"""
Migration Script: Add _status and _changed columns to all syncable models

This migration implements Problem 1 fix from the bugfix specification:
- Adds _status VARCHAR(10) column to all syncable tables
- Adds _changed VARCHAR(500) column to all syncable tables
- Both columns are NULLABLE for backward compatibility

Affected tables:
- users
- exercises
- workouts
- workout_exercises
- workout_sessions
- logged_sets
"""

from sqlalchemy import create_engine, text, inspect
from app.core.config import DATABASE_URL

print("=" * 70)
print("MIGRATION: Add _status and _changed columns to syncable models")
print("=" * 70)

# Create engine
engine = create_engine(DATABASE_URL)

# List of syncable tables that need the new columns
syncable_tables = [
    'users',
    'exercises',
    'workouts',
    'workout_exercises',
    'workout_sessions',
    'logged_sets'
]

print("\nStep 1: Checking current schema...")
inspector = inspect(engine)

for table_name in syncable_tables:
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    print(f"  {table_name}: {', '.join(columns)}")

print("\nStep 2: Adding _status and _changed columns...")

with engine.connect() as conn:
    for table_name in syncable_tables:
        try:
            # Check if columns already exist
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            
            # Add _status column if not exists
            if '_status' not in columns:
                sql = f"ALTER TABLE {table_name} ADD COLUMN _status VARCHAR(10)"
                conn.execute(text(sql))
                print(f"  ✓ Added {table_name}._status")
            else:
                print(f"  ⊙ {table_name}._status already exists")
            
            # Add _changed column if not exists
            if '_changed' not in columns:
                sql = f"ALTER TABLE {table_name} ADD COLUMN _changed VARCHAR(500)"
                conn.execute(text(sql))
                print(f"  ✓ Added {table_name}._changed")
            else:
                print(f"  ⊙ {table_name}._changed already exists")
                
        except Exception as e:
            print(f"  ✗ Error processing {table_name}: {e}")
            conn.rollback()
            raise
    
    # Commit all changes
    conn.commit()

print("\nStep 3: Verifying new schema...")

# Refresh inspector to see changes
inspector = inspect(engine)

all_success = True
for table_name in syncable_tables:
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    has_status = '_status' in columns
    has_changed = '_changed' in columns
    
    status_symbol = "✓" if has_status else "✗"
    changed_symbol = "✓" if has_changed else "✗"
    
    print(f"  {table_name}: {status_symbol} _status, {changed_symbol} _changed")
    
    if not (has_status and has_changed):
        all_success = False

print("\n" + "=" * 70)
if all_success:
    print("Migration completed successfully!")
    print("All syncable models now have _status and _changed columns.")
else:
    print("Migration FAILED - some columns are missing")
    exit(1)
print("=" * 70)

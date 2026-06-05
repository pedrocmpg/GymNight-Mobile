#!/usr/bin/env python3
"""
Database Reset Script
Drops all tables and recreates them from the new models
"""

from sqlalchemy import create_engine, text
from app.core.config import DATABASE_URL
from app.database.models import Base

print("="*70)
print("DATABASE RESET SCRIPT")
print("="*70)

# Create engine
engine = create_engine(DATABASE_URL)

print("\nStep 1: Dropping all tables...")
try:
    with engine.connect() as conn:
        # Drop all triggers first
        conn.execute(text("DROP TRIGGER IF EXISTS create_tombstone_after_users_delete ON users CASCADE"))
        conn.execute(text("DROP TRIGGER IF EXISTS create_tombstone_after_workouts_delete ON workouts CASCADE"))
        conn.execute(text("DROP TRIGGER IF EXISTS create_tombstone_after_workout_exercises_delete ON workout_exercises CASCADE"))
        conn.execute(text("DROP TRIGGER IF EXISTS create_tombstone_after_workout_sessions_delete ON workout_sessions CASCADE"))
        conn.execute(text("DROP TRIGGER IF EXISTS create_tombstone_after_logged_sets_delete ON logged_sets CASCADE"))
        
        # Drop trigger function
        conn.execute(text("DROP FUNCTION IF EXISTS create_tombstone_on_delete() CASCADE"))
        
        # Drop all tables with CASCADE
        conn.execute(text("DROP TABLE IF EXISTS deleted_records CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS logged_sets CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS workout_sessions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS workout_exercises CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS workouts CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS exercises CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        
        conn.commit()
    
    print("✓ All tables and triggers dropped")
except Exception as e:
    print(f"Error dropping tables: {e}")
    print("Continuing anyway...")

print("\nStep 2: Creating new schema from models...")
try:
    Base.metadata.create_all(engine)
    print("✓ All tables created successfully")
except Exception as e:
    print(f"✗ Error creating tables: {e}")
    exit(1)

print("\nStep 3: Verifying schema...")
from sqlalchemy import inspect

inspector = inspect(engine)
tables = inspector.get_table_names()

expected_tables = [
    'users', 'exercises', 'workouts', 'workout_exercises',
    'workout_sessions', 'logged_sets', 'deleted_records'
]

print(f"\nTables in database: {tables}")

for table in expected_tables:
    if table in tables:
        print(f"✓ {table}")
    else:
        print(f"✗ {table} MISSING")

print("\n" + "="*70)
print("Database reset complete!")
print("="*70)

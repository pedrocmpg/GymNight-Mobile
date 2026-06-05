#!/usr/bin/env python3
"""
Verification Script: Test user_id population in DeletedRecord trigger

This script verifies that the create_tombstone_on_delete() trigger
correctly populates user_id for different table scenarios:

1. Users table: user_id should be OLD.id (the deleted user's own ID)
2. Exercises table: user_id should be NULL (shared catalog)
3. Other tables (workouts): user_id should be OLD.user_id
"""

from sqlalchemy import create_engine, text
from app.core.config import DATABASE_URL
import uuid

print("=" * 70)
print("VERIFICATION: user_id trigger population")
print("=" * 70)

# Create engine
engine = create_engine(DATABASE_URL)

def cleanup_test_data(conn, test_ids):
    """Clean up test data"""
    for table, id_val in test_ids.items():
        try:
            conn.execute(text(f"DELETE FROM {table} WHERE id = :id"), {"id": id_val})
        except:
            pass
    # Clean up test tombstones
    try:
        conn.execute(text("DELETE FROM deleted_records WHERE table_name IN ('users', 'exercises', 'workouts')"))
    except:
        pass
    conn.commit()

with engine.connect() as conn:
    test_ids = {}
    
    print("\nStep 1: Creating test records...")
    
    try:
        # Create test user
        user_id = str(uuid.uuid4())
        test_ids['users'] = user_id
        
        conn.execute(text("""
            INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
            VALUES (:id, 'Test User', 'test@example.com', 'dummy_hash',
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        """), {"id": user_id})
        print(f"  ✓ Created test user: {user_id}")
        
        # Create test exercise
        exercise_id = str(uuid.uuid4())
        test_ids['exercises'] = exercise_id
        
        conn.execute(text("""
            INSERT INTO exercises (id, name, created_at, updated_at)
            VALUES (:id, 'Test Exercise',
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        """), {"id": exercise_id})
        print(f"  ✓ Created test exercise: {exercise_id}")
        
        # Create test workout (owned by user)
        workout_id = str(uuid.uuid4())
        test_ids['workouts'] = workout_id
        
        conn.execute(text("""
            INSERT INTO workouts (id, user_id, name, created_at, updated_at)
            VALUES (:id, :user_id, 'Test Workout',
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint,
                    floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint)
        """), {"id": workout_id, "user_id": user_id})
        print(f"  ✓ Created test workout: {workout_id} (user_id: {user_id})")
        
        conn.commit()
        
    except Exception as e:
        print(f"  ✗ Error creating test data: {e}")
        conn.rollback()
        raise
    
    print("\nStep 2: Testing trigger behavior...")
    
    # Test 1: Delete workout (should populate user_id from OLD.user_id)
    print("\n  Test 1: Deleting workout (should populate user_id)")
    try:
        conn.execute(text("DELETE FROM workouts WHERE id = :id"), {"id": workout_id})
        conn.commit()
        
        result = conn.execute(text("""
            SELECT table_name, record_id, user_id 
            FROM deleted_records 
            WHERE table_name = 'workouts' AND record_id = :id
        """), {"id": workout_id})
        
        row = result.fetchone()
        if row:
            print(f"    Tombstone: table={row[0]}, record_id={row[1]}, user_id={row[2]}")
            if row[2] == user_id:
                print(f"    ✓ user_id correctly populated: {row[2]}")
            else:
                print(f"    ✗ user_id incorrect: expected {user_id}, got {row[2]}")
        else:
            print("    ✗ Tombstone not created")
            
    except Exception as e:
        print(f"    ✗ Error: {e}")
        conn.rollback()
    
    # Test 2: Delete exercise (should NOT create tombstone - exercises don't have triggers)
    print("\n  Test 2: Deleting exercise (should NOT create tombstone - no trigger by design)")
    try:
        conn.execute(text("DELETE FROM exercises WHERE id = :id"), {"id": exercise_id})
        conn.commit()
        
        result = conn.execute(text("""
            SELECT table_name, record_id, user_id 
            FROM deleted_records 
            WHERE table_name = 'exercises' AND record_id = :id
        """), {"id": exercise_id})
        
        row = result.fetchone()
        if row:
            print(f"    ✗ Unexpected tombstone created: {row}")
            print(f"    ✗ exercises table should NOT have trigger (RESTRICT protection)")
        else:
            print(f"    ✓ No tombstone created (correct - exercises don't have triggers)")
            print(f"    ✓ Exercises use RESTRICT constraints, not sync deletion tracking")
            
    except Exception as e:
        print(f"    ✗ Error: {e}")
        conn.rollback()
    
    # Test 3: Delete user (should populate user_id as OLD.id)
    print("\n  Test 3: Deleting user (should populate user_id as OLD.id)")
    try:
        conn.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
        conn.commit()
        
        result = conn.execute(text("""
            SELECT table_name, record_id, user_id 
            FROM deleted_records 
            WHERE table_name = 'users' AND record_id = :id
        """), {"id": user_id})
        
        row = result.fetchone()
        if row:
            print(f"    Tombstone: table={row[0]}, record_id={row[1]}, user_id={row[2]}")
            if row[2] == user_id:
                print(f"    ✓ user_id correctly populated as deleted user's ID: {row[2]}")
            else:
                print(f"    ✗ user_id incorrect: expected {user_id}, got {row[2]}")
        else:
            print("    ✗ Tombstone not created")
            
    except Exception as e:
        print(f"    ✗ Error: {e}")
        conn.rollback()
    
    print("\nStep 3: Cleaning up test data...")
    try:
        # Clean up tombstones
        conn.execute(text("""
            DELETE FROM deleted_records 
            WHERE record_id IN (:user_id, :exercise_id, :workout_id)
        """), {"user_id": user_id, "exercise_id": exercise_id, "workout_id": workout_id})
        conn.commit()
        print("  ✓ Cleaned up test tombstones")
    except Exception as e:
        print(f"  ✗ Error cleaning up: {e}")

print("\n" + "=" * 70)
print("Verification complete!")
print("=" * 70)

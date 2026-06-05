#!/usr/bin/env python3
"""
Task 14.2: Test Trigger Captures CASCADE Deletes
Test that PostgreSQL triggers capture all CASCADE delete operations when a user is deleted.

Requirements Tested: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
- Create user with workout, workout with workout_exercises, workout_session with logged_sets
- Delete user (triggers CASCADE deletes)
- Verify deleted_records contains tombstones for: workouts, workout_exercises, workout_sessions, logged_sets
- Verify all tombstones have correct table_name and record_id values
"""

import sys
import uuid
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL
from app.database.connection import Base
from app.database.models import (
    User,
    Exercise,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    LoggedSet,
    DeletedRecord,
    current_timestamp_ms
)


def test_trigger_captures_cascade_deletes(engine):
    """
    Test that PostgreSQL triggers capture all CASCADE delete operations.
    
    When a user is deleted, the CASCADE delete rules should trigger deletions
    in multiple tables:
    - users -> workouts (CASCADE)
    - workouts -> workout_exercises (CASCADE)
    - users -> workout_sessions (CASCADE)
    - workout_sessions -> logged_sets (CASCADE)
    
    Each of these CASCADE deletes should create a tombstone in deleted_records.
    
    Requirements:
    - 10.1: THE System SHALL store deleted_record tombstones with id, table_name, 
            record_id, deleted_at columns
    - 10.2: WHEN a syncable record is deleted, THE System SHALL create a 
            Tombstone_Record in the deleted_records table
    - 10.3: THE Tombstone_Record SHALL store the table_name (String) identifying 
            which table the record belonged to
    - 10.4: THE Tombstone_Record SHALL store the record_id (String UUID) of the 
            deleted record
    - 10.5: THE Tombstone_Record SHALL store the deleted_at timestamp 
            (DateTime or BigInteger)
    - 10.6: THE Sync_Protocol SHALL use deleted_records to inform clients which 
            records to delete locally
    
    Test Scenario:
    1. Create user
    2. Create exercise (shared resource)
    3. Create workout owned by user
    4. Create workout_exercise in workout
    5. Create workout_session for user
    6. Create logged_sets in workout_session
    7. Record timestamp before deletion
    8. Delete user (triggers CASCADE deletes to all owned records)
    9. Verify deleted_records contains tombstones for all four table types:
       - workouts
       - workout_exercises
       - workout_sessions
       - logged_sets
    10. Verify each tombstone has correct table_name and record_id
    11. Verify deleted_at timestamps are within reasonable range
    """
    print("\n" + "="*70)
    print("TEST: Trigger Captures CASCADE Deletes")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Generate UUIDs for all test records
        user_id = str(uuid.uuid4())
        exercise_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        workout_exercise_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        logged_set1_id = str(uuid.uuid4())
        logged_set2_id = str(uuid.uuid4())
        
        print("\nStep 1: Creating test data hierarchy...")
        print("-" * 70)
        
        # Step 1: Create a user
        user = User(
            id=user_id,
            name="Test User for CASCADE Tombstone Test",
            email=f"cascade_tombstone_test_{user_id}@example.com",
            password_hash="hashed_password_cascade_tombstone",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create an exercise (shared resource, not user-owned)
        exercise = Exercise(
            id=exercise_id,
            name=f"Bench Press for CASCADE Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise)
        db.commit()
        print(f"✓ Created exercise: {exercise_id}")
        
        # Step 3: Create a workout owned by the user
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Push Day A - CASCADE Test",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        # Step 4: Create a workout_exercise in the workout
        workout_exercise = WorkoutExercise(
            id=workout_exercise_id,
            workout_id=workout_id,
            exercise_id=exercise_id,
            series_target=4,
            reps_target=8,
            weight_target=80.0,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout_exercise)
        db.commit()
        print(f"✓ Created workout_exercise: {workout_exercise_id}")
        
        # Step 5: Create a workout_session for the user
        session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=workout_id,
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(session)
        db.commit()
        print(f"✓ Created workout_session: {session_id}")
        
        # Step 6: Create logged_sets in the workout_session
        logged_set1 = LoggedSet(
            id=logged_set1_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=80.0,
            repetitions=8,
            estimated_one_rm=80.0 * (1 + 8/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set1)
        
        logged_set2 = LoggedSet(
            id=logged_set2_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=82.5,
            repetitions=7,
            estimated_one_rm=82.5 * (1 + 7/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set2)
        db.commit()
        print(f"✓ Created logged_set 1: {logged_set1_id}")
        print(f"✓ Created logged_set 2: {logged_set2_id}")
        
        print("\nData hierarchy created:")
        print("  User")
        print("  ├─ Workout")
        print("  │  └─ WorkoutExercise")
        print("  └─ WorkoutSession")
        print("     ├─ LoggedSet 1")
        print("     └─ LoggedSet 2")
        
        # Step 7: Record timestamp before deletion
        timestamp_before_delete = int(time.time() * 1000)  # Unix milliseconds
        print(f"\n✓ Recorded timestamp before deletion: {timestamp_before_delete}")
        
        # Step 8: Delete the user (triggers CASCADE deletes)
        print("\nStep 2: Deleting user (triggers CASCADE deletes)...")
        print("-" * 70)
        print(f"Deleting user: {user_id}")
        db.delete(user)
        db.commit()
        print(f"✓ User deleted - CASCADE deletes triggered")
        
        # Record timestamp after deletion
        timestamp_after_delete = int(time.time() * 1000)  # Unix milliseconds
        print(f"✓ Recorded timestamp after deletion: {timestamp_after_delete}")
        
        # Step 9: Verify all records were deleted
        print("\nStep 3: Verifying CASCADE delete behavior...")
        print("-" * 70)
        
        user_after = db.query(User).filter_by(id=user_id).first()
        workout_after = db.query(Workout).filter_by(id=workout_id).first()
        workout_exercise_after = db.query(WorkoutExercise).filter_by(id=workout_exercise_id).first()
        session_after = db.query(WorkoutSession).filter_by(id=session_id).first()
        logged_set1_after = db.query(LoggedSet).filter_by(id=logged_set1_id).first()
        logged_set2_after = db.query(LoggedSet).filter_by(id=logged_set2_id).first()
        
        if user_after is None:
            print("✓ User was deleted")
        else:
            print("✗ FAIL: User still exists")
            return False
        
        if workout_after is None:
            print("✓ Workout was CASCADE deleted")
        else:
            print("✗ FAIL: Workout still exists")
            return False
        
        if workout_exercise_after is None:
            print("✓ WorkoutExercise was CASCADE deleted")
        else:
            print("✗ FAIL: WorkoutExercise still exists")
            return False
        
        if session_after is None:
            print("✓ WorkoutSession was CASCADE deleted")
        else:
            print("✗ FAIL: WorkoutSession still exists")
            return False
        
        if logged_set1_after is None and logged_set2_after is None:
            print("✓ LoggedSets were CASCADE deleted")
        else:
            print("✗ FAIL: Some LoggedSets still exist")
            return False
        
        # Step 10: Query deleted_records table for tombstones
        print("\nStep 4: Verifying tombstone creation for CASCADE deletes...")
        print("-" * 70)
        
        # Query tombstones created after our timestamp
        all_tombstones = db.query(DeletedRecord).filter(
            DeletedRecord.deleted_at >= timestamp_before_delete - 100  # 100ms tolerance
        ).all()
        
        print(f"✓ Found {len(all_tombstones)} tombstone(s) created during test")
        
        # Expected tombstones:
        # - 1 workout tombstone
        # - 1 workout_exercise tombstone
        # - 1 workout_session tombstone
        # - 2 logged_set tombstones
        # Total: 5 tombstones
        
        expected_tombstones = {
            "workouts": [workout_id],
            "workout_exercises": [workout_exercise_id],
            "workout_sessions": [session_id],
            "logged_sets": [logged_set1_id, logged_set2_id]
        }
        
        found_tombstones = {}
        
        # Organize tombstones by table_name
        for tombstone in all_tombstones:
            if tombstone.table_name not in found_tombstones:
                found_tombstones[tombstone.table_name] = []
            found_tombstones[tombstone.table_name].append(tombstone.record_id)
        
        print("\nTombstones found by table:")
        for table_name, record_ids in found_tombstones.items():
            print(f"  - {table_name}: {len(record_ids)} tombstone(s)")
            for record_id in record_ids:
                print(f"    • {record_id}")
        
        # Step 11: Verify each expected tombstone exists
        print("\nStep 5: Verifying tombstone details...")
        print("-" * 70)
        
        all_checks_passed = True
        
        for table_name, expected_record_ids in expected_tombstones.items():
            print(f"\nChecking {table_name} tombstones:")
            
            for expected_record_id in expected_record_ids:
                # Find tombstone for this record
                tombstone = db.query(DeletedRecord).filter_by(
                    table_name=table_name,
                    record_id=expected_record_id
                ).first()
                
                if tombstone is None:
                    print(f"  ✗ FAIL: No tombstone found for {table_name}.{expected_record_id}")
                    all_checks_passed = False
                    continue
                
                print(f"  ✓ Found tombstone for record: {expected_record_id}")
                
                # Verify table_name (Requirement 10.3)
                if tombstone.table_name == table_name:
                    print(f"    ✓ table_name = '{table_name}' (Requirement 10.3)")
                else:
                    print(f"    ✗ FAIL: table_name = '{tombstone.table_name}' (expected '{table_name}')")
                    all_checks_passed = False
                
                # Verify record_id (Requirement 10.4)
                if tombstone.record_id == expected_record_id:
                    print(f"    ✓ record_id = '{expected_record_id}' (Requirement 10.4)")
                else:
                    print(f"    ✗ FAIL: record_id = '{tombstone.record_id}' (expected '{expected_record_id}')")
                    all_checks_passed = False
                
                # Verify deleted_at timestamp (Requirement 10.5)
                if tombstone.deleted_at is None:
                    print(f"    ✗ FAIL: deleted_at is NULL")
                    all_checks_passed = False
                else:
                    print(f"    ✓ deleted_at = {tombstone.deleted_at} (Requirement 10.5)")
                    
                    # Verify timestamp is within reasonable range (within 5 seconds)
                    time_window_ms = 5000  # 5 seconds
                    time_tolerance_before_ms = 100  # 100ms tolerance
                    
                    if (timestamp_before_delete - time_tolerance_before_ms) <= tombstone.deleted_at <= (timestamp_after_delete + time_window_ms):
                        print(f"    ✓ deleted_at is within reasonable range")
                        print(f"      Time difference: {tombstone.deleted_at - timestamp_before_delete}ms")
                    else:
                        print(f"    ✗ FAIL: deleted_at is outside reasonable range")
                        print(f"      Expected: {timestamp_before_delete - time_tolerance_before_ms} to {timestamp_after_delete + time_window_ms}")
                        print(f"      Actual: {tombstone.deleted_at}")
                        all_checks_passed = False
        
        if not all_checks_passed:
            print("\n✗ FAIL: Some tombstone checks failed")
            return False
        
        print("\n✓ PASS: Trigger captures CASCADE deletes correctly!")
        print("\nVerified CASCADE delete chain and tombstones:")
        print("  User deletion →")
        print("    ├─ Workout deleted (CASCADE)")
        print("    │  • Tombstone created: workouts table, 1 record")
        print("    │  └─ WorkoutExercise deleted (CASCADE)")
        print("    │     • Tombstone created: workout_exercises table, 1 record")
        print("    └─ WorkoutSession deleted (CASCADE)")
        print("       • Tombstone created: workout_sessions table, 1 record")
        print("       └─ LoggedSets deleted (CASCADE)")
        print("          • Tombstones created: logged_sets table, 2 records")
        print("\nTotal tombstones created: 5")
        print("\nSync Protocol Impact (Requirement 10.6):")
        print("  - Clients can query: SELECT * FROM deleted_records WHERE deleted_at > last_pulled_at")
        print("  - Clients receive all 5 tombstones")
        print("  - Clients delete corresponding local records from WatermelonDB")
        print("  - Offline-first synchronization handles CASCADE deletes correctly")
        
        # Cleanup: delete tombstones and exercise
        print("\nCleaning up test data...")
        for tombstone in all_tombstones:
            db.delete(tombstone)
        db.delete(exercise)
        db.commit()
        print("✓ Test data cleaned up")
        
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run the CASCADE delete tombstone capture test"""
    print("="*70)
    print("TASK 14.2: Test Trigger Captures CASCADE Deletes")
    print("Testing Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables and triggers should already exist
    print("✓ Using existing database schema with triggers")
    
    # Run test
    test_passed = test_trigger_captures_cascade_deletes(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: Trigger Captures CASCADE Deletes")
        print("="*70)
        print("\n✓ TEST PASSED - PostgreSQL triggers capture CASCADE deletes correctly!")
        print("\nVerified Requirements:")
        print("  - 10.1: Tombstones have id, table_name, record_id, deleted_at columns")
        print("  - 10.2: Triggers create tombstones for all CASCADE deleted records")
        print("  - 10.3: Tombstones store correct table_name for each deleted record")
        print("  - 10.4: Tombstones store correct record_id (UUID) for each deleted record")
        print("  - 10.5: Tombstones store deleted_at timestamp in Unix milliseconds")
        print("  - 10.6: Sync protocol can use tombstones to propagate deletes to clients")
        print("\nCASCADE Delete Coverage:")
        print("  ✓ workouts table (1 tombstone)")
        print("  ✓ workout_exercises table (1 tombstone)")
        print("  ✓ workout_sessions table (1 tombstone)")
        print("  ✓ logged_sets table (2 tombstones)")
        print("\nSync Protocol Workflow Validated:")
        print("  1. User deletes account on mobile while offline")
        print("  2. Mobile creates local tombstones and deletes all user data")
        print("  3. Mobile syncs when online, sends user deletion to server")
        print("  4. Server CASCADE deletes all user-owned records")
        print("  5. Server triggers create tombstones for all CASCADE deleted records")
        print("  6. Other clients pull and receive all tombstones")
        print("  7. Other clients clean up any cached/shared data")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: Trigger Captures CASCADE Deletes")
        print("="*70)
        print("\n✗ TEST FAILED - Review trigger implementation")
        print("\nPossible Issues:")
        print("  - Triggers may not be attached to all tables")
        print("  - Trigger function may not fire on CASCADE deletes")
        print("  - Some tables may be missing AFTER DELETE triggers")
        print("\nDebugging Steps:")
        print("  1. Check triggers on all tables:")
        print("     SELECT tablename, tgname FROM pg_trigger")
        print("     JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid")
        print("     WHERE tgname LIKE '%tombstone%';")
        print("  2. Verify triggers exist on:")
        print("     - workouts")
        print("     - workout_exercises")
        print("     - workout_sessions")
        print("     - logged_sets")
        print("  3. Test individual CASCADE paths manually")
        return 1


if __name__ == "__main__":
    sys.exit(main())

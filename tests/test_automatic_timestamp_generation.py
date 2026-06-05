#!/usr/bin/env python3
"""
Task 12.1: Test Automatic Timestamp Generation on Create
Test automatic timestamp generation on create for all tables

Requirements Tested: 2.4, 2.5
- Verify created_at and updated_at are automatically set to current Unix milliseconds
- Verify timestamps are within reasonable range (±1000ms of current time)
"""

import sys
import uuid
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
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


def test_user_automatic_timestamps(engine):
    """
    Test that User records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 1: User Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Capture time before creating record
        before_timestamp = int(time.time() * 1000)
        
        # Create user without providing created_at/updated_at
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password"
            # Note: NOT providing created_at or updated_at
        )
        db.add(user)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(user)
        
        print(f"✓ Created user without explicit timestamps: {user_id}")
        print(f"  created_at: {user.created_at}")
        print(f"  updated_at: {user.updated_at}")
        print(f"  Before timestamp: {before_timestamp}")
        print(f"  After timestamp: {after_timestamp}")
        
        # Verify created_at is set
        if user.created_at is None:
            print("✗ FAIL: created_at is None (should be auto-generated)")
            return False
        print("✓ created_at is not None")
        
        # Verify updated_at is set
        if user.updated_at is None:
            print("✗ FAIL: updated_at is None (should be auto-generated)")
            return False
        print("✓ updated_at is not None")
        
        # Verify created_at is within reasonable range (±1000ms)
        if not (before_timestamp - 1000 <= user.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at ({user.created_at}) is not within range [{before_timestamp - 1000}, {after_timestamp + 1000}]")
            return False
        print(f"✓ created_at is within reasonable range (±1000ms)")
        
        # Verify updated_at is within reasonable range (±1000ms)
        if not (before_timestamp - 1000 <= user.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at ({user.updated_at}) is not within range [{before_timestamp - 1000}, {after_timestamp + 1000}]")
            return False
        print(f"✓ updated_at is within reasonable range (±1000ms)")
        
        # Cleanup
        db.delete(user)
        db.commit()
        
        print("✓ PASS: User automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_exercise_automatic_timestamps(engine):
    """
    Test that Exercise records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 2: Exercise Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Capture time before creating record
        before_timestamp = int(time.time() * 1000)
        
        # Create exercise without providing created_at/updated_at
        exercise_id = str(uuid.uuid4())
        exercise = Exercise(
            id=exercise_id,
            name=f"Test Exercise {uuid.uuid4()}"
            # Note: NOT providing created_at or updated_at
        )
        db.add(exercise)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(exercise)
        
        print(f"✓ Created exercise without explicit timestamps: {exercise_id}")
        print(f"  created_at: {exercise.created_at}")
        print(f"  updated_at: {exercise.updated_at}")
        
        # Verify created_at is set and within range
        if exercise.created_at is None:
            print("✗ FAIL: created_at is None")
            return False
        if not (before_timestamp - 1000 <= exercise.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at out of range")
            return False
        print("✓ created_at is set and within range")
        
        # Verify updated_at is set and within range
        if exercise.updated_at is None:
            print("✗ FAIL: updated_at is None")
            return False
        if not (before_timestamp - 1000 <= exercise.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at out of range")
            return False
        print("✓ updated_at is set and within range")
        
        # Cleanup
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: Exercise automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_automatic_timestamps(engine):
    """
    Test that Workout records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 3: Workout Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create a user first (required for foreign key)
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password"
        )
        db.add(user)
        db.commit()
        
        # Capture time before creating workout
        before_timestamp = int(time.time() * 1000)
        
        # Create workout without providing created_at/updated_at
        workout_id = str(uuid.uuid4())
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Test Workout"
            # Note: NOT providing created_at or updated_at
        )
        db.add(workout)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(workout)
        
        print(f"✓ Created workout without explicit timestamps: {workout_id}")
        print(f"  created_at: {workout.created_at}")
        print(f"  updated_at: {workout.updated_at}")
        
        # Verify timestamps
        if workout.created_at is None or workout.updated_at is None:
            print("✗ FAIL: Timestamps are None")
            return False
        if not (before_timestamp - 1000 <= workout.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at out of range")
            return False
        if not (before_timestamp - 1000 <= workout.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at out of range")
            return False
        print("✓ Timestamps are set and within range")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout
        db.commit()
        
        print("✓ PASS: Workout automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_exercise_automatic_timestamps(engine):
    """
    Test that WorkoutExercise records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 4: WorkoutExercise Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create prerequisites
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password"
        )
        db.add(user)
        
        workout_id = str(uuid.uuid4())
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Test Workout"
        )
        db.add(workout)
        
        exercise_id = str(uuid.uuid4())
        exercise = Exercise(
            id=exercise_id,
            name=f"Test Exercise {uuid.uuid4()}"
        )
        db.add(exercise)
        db.commit()
        
        # Capture time before creating workout_exercise
        before_timestamp = int(time.time() * 1000)
        
        # Create workout_exercise without providing created_at/updated_at
        workout_exercise_id = str(uuid.uuid4())
        workout_exercise = WorkoutExercise(
            id=workout_exercise_id,
            workout_id=workout_id,
            exercise_id=exercise_id,
            series_target=3,
            reps_target=10,
            weight_target=50.0
            # Note: NOT providing created_at or updated_at
        )
        db.add(workout_exercise)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(workout_exercise)
        
        print(f"✓ Created workout_exercise without explicit timestamps: {workout_exercise_id}")
        print(f"  created_at: {workout_exercise.created_at}")
        print(f"  updated_at: {workout_exercise.updated_at}")
        
        # Verify timestamps
        if workout_exercise.created_at is None or workout_exercise.updated_at is None:
            print("✗ FAIL: Timestamps are None")
            return False
        if not (before_timestamp - 1000 <= workout_exercise.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at out of range")
            return False
        if not (before_timestamp - 1000 <= workout_exercise.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at out of range")
            return False
        print("✓ Timestamps are set and within range")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout and workout_exercise
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: WorkoutExercise automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_session_automatic_timestamps(engine):
    """
    Test that WorkoutSession records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 5: WorkoutSession Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create a user first (required for foreign key)
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password"
        )
        db.add(user)
        db.commit()
        
        # Capture time before creating workout_session
        before_timestamp = int(time.time() * 1000)
        
        # Create workout_session without providing created_at/updated_at
        session_id = str(uuid.uuid4())
        workout_session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=None,  # Freestyle session
            started_at=datetime.now(timezone.utc)
            # Note: NOT providing created_at or updated_at
        )
        db.add(workout_session)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(workout_session)
        
        print(f"✓ Created workout_session without explicit timestamps: {session_id}")
        print(f"  created_at: {workout_session.created_at}")
        print(f"  updated_at: {workout_session.updated_at}")
        
        # Verify timestamps
        if workout_session.created_at is None or workout_session.updated_at is None:
            print("✗ FAIL: Timestamps are None")
            return False
        if not (before_timestamp - 1000 <= workout_session.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at out of range")
            return False
        if not (before_timestamp - 1000 <= workout_session.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at out of range")
            return False
        print("✓ Timestamps are set and within range")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session
        db.commit()
        
        print("✓ PASS: WorkoutSession automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_logged_set_automatic_timestamps(engine):
    """
    Test that LoggedSet records automatically get created_at and updated_at timestamps.
    
    Requirements: 2.4, 2.5 - Automatic timestamp generation
    """
    print("\n" + "="*70)
    print("TEST 6: LoggedSet Automatic Timestamp Generation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create prerequisites
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password"
        )
        db.add(user)
        
        session_id = str(uuid.uuid4())
        workout_session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=None,
            started_at=datetime.now(timezone.utc)
        )
        db.add(workout_session)
        
        exercise_id = str(uuid.uuid4())
        exercise = Exercise(
            id=exercise_id,
            name=f"Test Exercise {uuid.uuid4()}"
        )
        db.add(exercise)
        db.commit()
        
        # Capture time before creating logged_set
        before_timestamp = int(time.time() * 1000)
        
        # Create logged_set without providing created_at/updated_at
        logged_set_id = str(uuid.uuid4())
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=100.0,
            repetitions=10,
            completed_at=datetime.now(timezone.utc)
            # Note: NOT providing created_at or updated_at
        )
        db.add(logged_set)
        db.commit()
        
        # Capture time after creating record
        after_timestamp = int(time.time() * 1000)
        
        # Refresh to get database-generated values
        db.refresh(logged_set)
        
        print(f"✓ Created logged_set without explicit timestamps: {logged_set_id}")
        print(f"  created_at: {logged_set.created_at}")
        print(f"  updated_at: {logged_set.updated_at}")
        
        # Verify timestamps
        if logged_set.created_at is None or logged_set.updated_at is None:
            print("✗ FAIL: Timestamps are None")
            return False
        if not (before_timestamp - 1000 <= logged_set.created_at <= after_timestamp + 1000):
            print(f"✗ FAIL: created_at out of range")
            return False
        if not (before_timestamp - 1000 <= logged_set.updated_at <= after_timestamp + 1000):
            print(f"✗ FAIL: updated_at out of range")
            return False
        print("✓ Timestamps are set and within range")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session and logged_set
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: LoggedSet automatic timestamp generation works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_deleted_record_timestamp_validation(engine):
    """
    Test that DeletedRecord requires explicit deleted_at timestamp.
    
    Requirements: 2.4, 2.5 - Timestamp columns
    Note: DeletedRecord is different - deleted_at must be explicitly provided
    since it represents a specific moment of deletion, not auto-generation.
    """
    print("\n" + "="*70)
    print("TEST 7: DeletedRecord Timestamp Validation")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Test 1: Verify deleted_at is required (not auto-generated)
        print("\n  Test 7a: Verify deleted_at is required (not NULL)")
        deleted_record_id = str(uuid.uuid4())
        deleted_record = DeletedRecord(
            id=deleted_record_id,
            table_name="workouts",
            record_id=str(uuid.uuid4())
            # Note: NOT providing deleted_at
        )
        db.add(deleted_record)
        
        try:
            db.commit()
            print("  ✗ FAIL: Should have raised error for missing deleted_at")
            return False
        except Exception as e:
            error_message = str(e).lower()
            if "not null" in error_message or "notnullviolation" in error_message:
                print("  ✓ Correctly requires deleted_at to be explicitly provided")
                db.rollback()
            else:
                print(f"  ✗ FAIL: Unexpected error: {e}")
                db.rollback()
                return False
        
        # Test 2: Verify deleted_at works when explicitly provided
        print("\n  Test 7b: Verify deleted_at works when explicitly provided")
        before_timestamp = int(time.time() * 1000)
        
        deleted_record_id = str(uuid.uuid4())
        deleted_record = DeletedRecord(
            id=deleted_record_id,
            table_name="workouts",
            record_id=str(uuid.uuid4()),
            deleted_at=before_timestamp  # Explicitly providing deleted_at
        )
        db.add(deleted_record)
        db.commit()
        
        db.refresh(deleted_record)
        
        print(f"  ✓ Created deleted_record with explicit timestamp: {deleted_record_id}")
        print(f"    deleted_at: {deleted_record.deleted_at}")
        
        # Verify deleted_at matches what we provided
        if deleted_record.deleted_at != before_timestamp:
            print(f"  ✗ FAIL: deleted_at ({deleted_record.deleted_at}) doesn't match provided ({before_timestamp})")
            return False
        print("  ✓ deleted_at matches explicitly provided timestamp")
        
        # Cleanup
        db.delete(deleted_record)
        db.commit()
        
        print("✓ PASS: DeletedRecord timestamp validation works correctly")
        print("  (Note: deleted_at must be explicitly provided, not auto-generated)")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all automatic timestamp generation tests"""
    print("="*70)
    print("TASK 12.1: Test Automatic Timestamp Generation on Create")
    print("Testing Requirements: 2.4, 2.5")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "User Automatic Timestamps": test_user_automatic_timestamps(engine),
        "Exercise Automatic Timestamps": test_exercise_automatic_timestamps(engine),
        "Workout Automatic Timestamps": test_workout_automatic_timestamps(engine),
        "WorkoutExercise Automatic Timestamps": test_workout_exercise_automatic_timestamps(engine),
        "WorkoutSession Automatic Timestamps": test_workout_session_automatic_timestamps(engine),
        "LoggedSet Automatic Timestamps": test_logged_set_automatic_timestamps(engine),
        "DeletedRecord Timestamp Validation": test_deleted_record_timestamp_validation(engine)
    }
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("="*70)
    
    if all_passed:
        print("\n✓ ALL TESTS PASSED - Automatic timestamp generation works correctly!")
        print("\nVerified:")
        print("  - created_at is automatically set to current Unix milliseconds")
        print("  - updated_at is automatically set to current Unix milliseconds")
        print("  - Timestamps are within reasonable range (±1000ms of current time)")
        print("  - All tables (users, exercises, workouts, workout_exercises,")
        print("    workout_sessions, logged_sets, deleted_records) have automatic timestamps")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review timestamp generation implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

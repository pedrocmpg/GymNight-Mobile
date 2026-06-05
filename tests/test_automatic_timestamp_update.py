#!/usr/bin/env python3
"""
Task 12.2: Test Automatic Timestamp Update on Modify
Test automatic timestamp update on record modification

Requirements Tested: 2.5
- Create record, note original updated_at value
- Modify record field and commit
- Verify updated_at has changed to a newer timestamp
- Verify created_at remains unchanged
"""

import sys
import uuid
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
from app.core.config import DATABASE_URL
from app.database.models import (
    Base,
    User,
    Exercise,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    LoggedSet,
    current_timestamp_ms
)


def test_user_timestamp_update(engine):
    """
    Test that User records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 1: User Automatic Timestamp Update on Modify")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create user
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Original Name",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="original_hash"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        original_created_at = user.created_at
        original_updated_at = user.updated_at
        
        print(f"✓ Created user: {user_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify user
        user.name = "Modified Name"
        db.commit()
        db.refresh(user)
        
        new_created_at = user.created_at
        new_updated_at = user.updated_at
        
        print(f"\n✓ Modified user name")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed from {original_created_at} to {new_created_at}")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed to a newer timestamp
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at ({new_updated_at}) is not newer than original ({original_updated_at})")
            return False
        print(f"✓ updated_at changed from {original_updated_at} to {new_updated_at}")
        
        # Cleanup
        db.delete(user)
        db.commit()
        
        print("✓ PASS: User automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_exercise_timestamp_update(engine):
    """
    Test that Exercise records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 2: Exercise Automatic Timestamp Update on Modify")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create exercise
        exercise_id = str(uuid.uuid4())
        exercise = Exercise(
            id=exercise_id,
            name=f"Original Exercise {uuid.uuid4()}"
        )
        db.add(exercise)
        db.commit()
        db.refresh(exercise)
        
        original_created_at = exercise.created_at
        original_updated_at = exercise.updated_at
        
        print(f"✓ Created exercise: {exercise_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify exercise
        exercise.name = f"Modified Exercise {uuid.uuid4()}"
        db.commit()
        db.refresh(exercise)
        
        new_created_at = exercise.created_at
        new_updated_at = exercise.updated_at
        
        print(f"\n✓ Modified exercise name")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at is not newer")
            return False
        print("✓ updated_at changed to newer timestamp")
        
        # Cleanup
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: Exercise automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_timestamp_update(engine):
    """
    Test that Workout records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 3: Workout Automatic Timestamp Update on Modify")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create user first
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hash"
        )
        db.add(user)
        db.commit()
        
        # Create workout
        workout_id = str(uuid.uuid4())
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Original Workout"
        )
        db.add(workout)
        db.commit()
        db.refresh(workout)
        
        original_created_at = workout.created_at
        original_updated_at = workout.updated_at
        
        print(f"✓ Created workout: {workout_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify workout
        workout.name = "Modified Workout"
        db.commit()
        db.refresh(workout)
        
        new_created_at = workout.created_at
        new_updated_at = workout.updated_at
        
        print(f"\n✓ Modified workout name")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at is not newer")
            return False
        print("✓ updated_at changed to newer timestamp")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout
        db.commit()
        
        print("✓ PASS: Workout automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_exercise_timestamp_update(engine):
    """
    Test that WorkoutExercise records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 4: WorkoutExercise Automatic Timestamp Update on Modify")
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
            password_hash="hash"
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
        
        # Create workout_exercise
        workout_exercise_id = str(uuid.uuid4())
        workout_exercise = WorkoutExercise(
            id=workout_exercise_id,
            workout_id=workout_id,
            exercise_id=exercise_id,
            series_target=3,
            reps_target=10,
            weight_target=50.0
        )
        db.add(workout_exercise)
        db.commit()
        db.refresh(workout_exercise)
        
        original_created_at = workout_exercise.created_at
        original_updated_at = workout_exercise.updated_at
        
        print(f"✓ Created workout_exercise: {workout_exercise_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify workout_exercise
        workout_exercise.reps_target = 12
        workout_exercise.weight_target = 55.0
        db.commit()
        db.refresh(workout_exercise)
        
        new_created_at = workout_exercise.created_at
        new_updated_at = workout_exercise.updated_at
        
        print(f"\n✓ Modified workout_exercise (reps_target and weight_target)")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at is not newer")
            return False
        print("✓ updated_at changed to newer timestamp")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout and workout_exercise
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: WorkoutExercise automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_session_timestamp_update(engine):
    """
    Test that WorkoutSession records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 5: WorkoutSession Automatic Timestamp Update on Modify")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create user first
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hash"
        )
        db.add(user)
        db.commit()
        
        # Create workout_session
        session_id = str(uuid.uuid4())
        workout_session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=None,  # Freestyle session
            started_at=datetime.now(timezone.utc)
        )
        db.add(workout_session)
        db.commit()
        db.refresh(workout_session)
        
        original_created_at = workout_session.created_at
        original_updated_at = workout_session.updated_at
        
        print(f"✓ Created workout_session: {session_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify workout_session (end the session)
        workout_session.ended_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(workout_session)
        
        new_created_at = workout_session.created_at
        new_updated_at = workout_session.updated_at
        
        print(f"\n✓ Modified workout_session (set ended_at)")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at is not newer")
            return False
        print("✓ updated_at changed to newer timestamp")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session
        db.commit()
        
        print("✓ PASS: WorkoutSession automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_logged_set_timestamp_update(engine):
    """
    Test that LoggedSet records automatically update updated_at on modification.
    
    Requirements: 2.5 - Automatic timestamp update on modify
    """
    print("\n" + "="*70)
    print("TEST 6: LoggedSet Automatic Timestamp Update on Modify")
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
            password_hash="hash"
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
        
        # Create logged_set
        logged_set_id = str(uuid.uuid4())
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=100.0,
            repetitions=10,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        original_created_at = logged_set.created_at
        original_updated_at = logged_set.updated_at
        
        print(f"✓ Created logged_set: {logged_set_id}")
        print(f"  Original created_at: {original_created_at}")
        print(f"  Original updated_at: {original_updated_at}")
        
        # Wait a bit to ensure timestamp difference
        time.sleep(0.1)
        
        # Modify logged_set
        logged_set.weight = 105.0
        logged_set.repetitions = 11
        db.commit()
        db.refresh(logged_set)
        
        new_created_at = logged_set.created_at
        new_updated_at = logged_set.updated_at
        
        print(f"\n✓ Modified logged_set (weight and repetitions)")
        print(f"  New created_at: {new_created_at}")
        print(f"  New updated_at: {new_updated_at}")
        
        # Verify created_at remains unchanged
        if new_created_at != original_created_at:
            print(f"✗ FAIL: created_at changed")
            return False
        print("✓ created_at remains unchanged")
        
        # Verify updated_at has changed
        if new_updated_at <= original_updated_at:
            print(f"✗ FAIL: updated_at is not newer")
            return False
        print("✓ updated_at changed to newer timestamp")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session and logged_set
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: LoggedSet automatic timestamp update works correctly")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all automatic timestamp update tests"""
    print("="*70)
    print("TASK 12.2: Test Automatic Timestamp Update on Modify")
    print("Testing Requirements: 2.5")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "User Timestamp Update": test_user_timestamp_update(engine),
        "Exercise Timestamp Update": test_exercise_timestamp_update(engine),
        "Workout Timestamp Update": test_workout_timestamp_update(engine),
        "WorkoutExercise Timestamp Update": test_workout_exercise_timestamp_update(engine),
        "WorkoutSession Timestamp Update": test_workout_session_timestamp_update(engine),
        "LoggedSet Timestamp Update": test_logged_set_timestamp_update(engine),
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
        print("\n✓ ALL TESTS PASSED - Automatic timestamp update works correctly!")
        print("\nVerified:")
        print("  - updated_at automatically changes to newer timestamp on modification")
        print("  - created_at remains unchanged when record is modified")
        print("  - All tables (users, exercises, workouts, workout_exercises,")
        print("    workout_sessions, logged_sets) have automatic timestamp updates")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review timestamp update implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

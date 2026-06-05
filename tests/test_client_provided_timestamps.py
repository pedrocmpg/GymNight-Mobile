#!/usr/bin/env python3
"""
Task 12.3: Test Client-Provided Timestamp Acceptance
Test that server accepts and stores client-provided timestamps exactly

Requirements Tested: 2.4, 2.5
- Verify server accepts client-provided created_at and updated_at timestamps
- Verify no server-side timestamp override occurs
- Verify timestamps are stored exactly as provided by client
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
    current_timestamp_ms
)


def test_user_client_timestamp_acceptance(engine):
    """
    Test that User records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 1: User Client-Provided Timestamp Acceptance")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Client provides specific timestamps (simulating offline creation)
        client_created_at = 1609459200000  # 2021-01-01 00:00:00 UTC
        client_updated_at = 1609459200500  # 2021-01-01 00:00:00.5 UTC
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create user with explicit client timestamps
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{uuid.uuid4()}@example.com",
            password_hash="hashed_password",
            created_at=client_created_at,  # Client provides explicit timestamp
            updated_at=client_updated_at   # Client provides explicit timestamp
        )
        db.add(user)
        db.commit()
        
        # Refresh to get database-stored values
        db.refresh(user)
        
        print(f"✓ Created user with client timestamps: {user_id}")
        print(f"  Database created_at: {user.created_at}")
        print(f"  Database updated_at: {user.updated_at}")
        
        # Verify created_at matches exactly what client provided
        if user.created_at != client_created_at:
            print(f"✗ FAIL: created_at was overridden!")
            print(f"  Expected: {client_created_at}")
            print(f"  Got: {user.created_at}")
            return False
        print("✓ created_at matches client-provided value exactly (no override)")
        
        # Verify updated_at matches exactly what client provided
        if user.updated_at != client_updated_at:
            print(f"✗ FAIL: updated_at was overridden!")
            print(f"  Expected: {client_updated_at}")
            print(f"  Got: {user.updated_at}")
            return False
        print("✓ updated_at matches client-provided value exactly (no override)")
        
        # Cleanup
        db.delete(user)
        db.commit()
        
        print("✓ PASS: User accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_exercise_client_timestamp_acceptance(engine):
    """
    Test that Exercise records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 2: Exercise Client-Provided Timestamp Acceptance")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Client provides specific timestamps from offline creation
        client_created_at = 1609459300000  # Different timestamp
        client_updated_at = 1609459300500
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create exercise with explicit client timestamps
        exercise_id = str(uuid.uuid4())
        exercise = Exercise(
            id=exercise_id,
            name=f"Test Exercise {uuid.uuid4()}",
            created_at=client_created_at,
            updated_at=client_updated_at
        )
        db.add(exercise)
        db.commit()
        db.refresh(exercise)
        
        print(f"✓ Created exercise with client timestamps: {exercise_id}")
        
        # Verify timestamps match exactly
        if exercise.created_at != client_created_at:
            print(f"✗ FAIL: created_at was overridden! Expected {client_created_at}, got {exercise.created_at}")
            return False
        if exercise.updated_at != client_updated_at:
            print(f"✗ FAIL: updated_at was overridden! Expected {client_updated_at}, got {exercise.updated_at}")
            return False
        
        print("✓ Both timestamps match client-provided values exactly")
        
        # Cleanup
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: Exercise accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_client_timestamp_acceptance(engine):
    """
    Test that Workout records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 3: Workout Client-Provided Timestamp Acceptance")
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
        db.commit()
        
        # Client provides specific timestamps
        client_created_at = 1609459400000
        client_updated_at = 1609459400500
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create workout with explicit client timestamps
        workout_id = str(uuid.uuid4())
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Test Workout",
            created_at=client_created_at,
            updated_at=client_updated_at
        )
        db.add(workout)
        db.commit()
        db.refresh(workout)
        
        print(f"✓ Created workout with client timestamps: {workout_id}")
        
        # Verify timestamps match exactly
        if workout.created_at != client_created_at or workout.updated_at != client_updated_at:
            print(f"✗ FAIL: Timestamps were overridden!")
            print(f"  created_at - Expected: {client_created_at}, Got: {workout.created_at}")
            print(f"  updated_at - Expected: {client_updated_at}, Got: {workout.updated_at}")
            return False
        
        print("✓ Both timestamps match client-provided values exactly")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout
        db.commit()
        
        print("✓ PASS: Workout accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_exercise_client_timestamp_acceptance(engine):
    """
    Test that WorkoutExercise records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 4: WorkoutExercise Client-Provided Timestamp Acceptance")
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
        
        # Client provides specific timestamps
        client_created_at = 1609459500000
        client_updated_at = 1609459500500
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create workout_exercise with explicit client timestamps
        workout_exercise_id = str(uuid.uuid4())
        workout_exercise = WorkoutExercise(
            id=workout_exercise_id,
            workout_id=workout_id,
            exercise_id=exercise_id,
            series_target=3,
            reps_target=10,
            weight_target=50.0,
            created_at=client_created_at,
            updated_at=client_updated_at
        )
        db.add(workout_exercise)
        db.commit()
        db.refresh(workout_exercise)
        
        print(f"✓ Created workout_exercise with client timestamps: {workout_exercise_id}")
        
        # Verify timestamps match exactly
        if workout_exercise.created_at != client_created_at or workout_exercise.updated_at != client_updated_at:
            print(f"✗ FAIL: Timestamps were overridden!")
            return False
        
        print("✓ Both timestamps match client-provided values exactly")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout and workout_exercise
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: WorkoutExercise accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_workout_session_client_timestamp_acceptance(engine):
    """
    Test that WorkoutSession records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 5: WorkoutSession Client-Provided Timestamp Acceptance")
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
        db.commit()
        
        # Client provides specific timestamps
        client_created_at = 1609459600000
        client_updated_at = 1609459600500
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create workout_session with explicit client timestamps
        session_id = str(uuid.uuid4())
        workout_session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=None,  # Freestyle session
            started_at=datetime.now(timezone.utc),
            created_at=client_created_at,
            updated_at=client_updated_at
        )
        db.add(workout_session)
        db.commit()
        db.refresh(workout_session)
        
        print(f"✓ Created workout_session with client timestamps: {session_id}")
        
        # Verify timestamps match exactly
        if workout_session.created_at != client_created_at or workout_session.updated_at != client_updated_at:
            print(f"✗ FAIL: Timestamps were overridden!")
            return False
        
        print("✓ Both timestamps match client-provided values exactly")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session
        db.commit()
        
        print("✓ PASS: WorkoutSession accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_logged_set_client_timestamp_acceptance(engine):
    """
    Test that LoggedSet records accept and store client-provided timestamps exactly.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 6: LoggedSet Client-Provided Timestamp Acceptance")
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
        
        # Client provides specific timestamps
        client_created_at = 1609459700000
        client_updated_at = 1609459700500
        
        print(f"Client-provided created_at: {client_created_at}")
        print(f"Client-provided updated_at: {client_updated_at}")
        
        # Create logged_set with explicit client timestamps
        logged_set_id = str(uuid.uuid4())
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=100.0,
            repetitions=10,
            completed_at=datetime.now(timezone.utc),
            created_at=client_created_at,
            updated_at=client_updated_at
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        print(f"✓ Created logged_set with client timestamps: {logged_set_id}")
        
        # Verify timestamps match exactly
        if logged_set.created_at != client_created_at or logged_set.updated_at != client_updated_at:
            print(f"✗ FAIL: Timestamps were overridden!")
            return False
        
        print("✓ Both timestamps match client-provided values exactly")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session and logged_set
        db.delete(exercise)
        db.commit()
        
        print("✓ PASS: LoggedSet accepts client-provided timestamps without override")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_multiple_records_different_timestamps(engine):
    """
    Test creating multiple records with different client-provided timestamps.
    
    This simulates a real offline-first sync scenario where a mobile client
    created multiple records offline at different times, then syncs them all
    to the server. The server must preserve each record's exact timestamp.
    
    Requirements: 2.4, 2.5 - Client timestamp acceptance for offline-first sync
    """
    print("\n" + "="*70)
    print("TEST 7: Multiple Records with Different Client Timestamps")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Simulate client creating 3 users offline at different times
        timestamps = [
            (1609459800000, 1609459800500),  # User 1: 2021-01-01 00:10:00
            (1609459900000, 1609459900500),  # User 2: 2021-01-01 00:11:40
            (1609460000000, 1609460000500),  # User 3: 2021-01-01 00:13:20
        ]
        
        users = []
        for i, (created, updated) in enumerate(timestamps):
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name=f"Test User {i+1}",
                email=f"test_{user_id}@example.com",
                password_hash="hashed_password",
                created_at=created,
                updated_at=updated
            )
            db.add(user)
            users.append((user, created, updated))
        
        db.commit()
        
        print(f"✓ Created {len(users)} users with different client timestamps")
        
        # Verify each user retained its exact timestamps
        all_correct = True
        for user, expected_created, expected_updated in users:
            db.refresh(user)
            
            if user.created_at != expected_created:
                print(f"✗ FAIL: User {user.id} created_at was overridden!")
                print(f"  Expected: {expected_created}, Got: {user.created_at}")
                all_correct = False
            
            if user.updated_at != expected_updated:
                print(f"✗ FAIL: User {user.id} updated_at was overridden!")
                print(f"  Expected: {expected_updated}, Got: {user.updated_at}")
                all_correct = False
        
        if not all_correct:
            return False
        
        print("✓ All users retained their exact client-provided timestamps")
        
        # Verify timestamps are different from each other (not collapsed to same value)
        created_timestamps = [user[0].created_at for user in users]
        if len(set(created_timestamps)) != len(timestamps):
            print("✗ FAIL: Timestamps were collapsed to same value!")
            return False
        
        print("✓ Each record has distinct timestamps (no collapsing)")
        
        # Cleanup
        for user, _, _ in users:
            db.delete(user)
        db.commit()
        
        print("✓ PASS: Multiple records preserve distinct client timestamps")
        return True
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all client-provided timestamp acceptance tests"""
    print("="*70)
    print("TASK 12.3: Test Client-Provided Timestamp Acceptance")
    print("Testing Requirements: 2.4, 2.5")
    print("="*70)
    print("\nCRITICAL FOR OFFLINE-FIRST SYNC:")
    print("Mobile clients create records offline with their own timestamps.")
    print("When syncing, the server MUST accept and store these exact values.")
    print("Server-side timestamp overrides would break sync protocol!")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "User Client Timestamp Acceptance": test_user_client_timestamp_acceptance(engine),
        "Exercise Client Timestamp Acceptance": test_exercise_client_timestamp_acceptance(engine),
        "Workout Client Timestamp Acceptance": test_workout_client_timestamp_acceptance(engine),
        "WorkoutExercise Client Timestamp Acceptance": test_workout_exercise_client_timestamp_acceptance(engine),
        "WorkoutSession Client Timestamp Acceptance": test_workout_session_client_timestamp_acceptance(engine),
        "LoggedSet Client Timestamp Acceptance": test_logged_set_client_timestamp_acceptance(engine),
        "Multiple Records Different Timestamps": test_multiple_records_different_timestamps(engine)
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
        print("\n✓ ALL TESTS PASSED - Server accepts client timestamps correctly!")
        print("\nVerified:")
        print("  - Server accepts client-provided created_at values without override")
        print("  - Server accepts client-provided updated_at values without override")
        print("  - Timestamps are stored exactly as provided by client")
        print("  - Multiple records can have different client timestamps")
        print("  - All tables (users, exercises, workouts, workout_exercises,")
        print("    workout_sessions, logged_sets) support client timestamp acceptance")
        print("\n✓ OFFLINE-FIRST SYNC COMPATIBILITY CONFIRMED!")
        print("  Mobile clients can safely provide their own timestamps during sync")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review timestamp acceptance implementation")
        print("\n⚠ CRITICAL: Client timestamp acceptance is REQUIRED for offline-first sync!")
        print("  If server overrides client timestamps, sync protocol will break:")
        print("  - Clients won't be able to detect which records changed")
        print("  - Conflict resolution will fail")
        print("  - Data created offline will lose its original creation time")
        return 1


if __name__ == "__main__":
    sys.exit(main())

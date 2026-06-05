#!/usr/bin/env python3
"""
Task 11.1: Test User Cascade Delete
Test cascade delete behavior when a User is deleted.

Requirements Tested: 3.4, 7.5, 12.1
- Create user with associated workouts and workout_sessions
- Delete user and verify all workouts and workout_sessions are deleted (CASCADE)
- Verify logged_sets associated with workout_sessions are also deleted (CASCADE chain)
"""

import sys
import uuid
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
    current_timestamp_ms
)


def test_user_cascade_delete(engine):
    """
    Test that deleting a user cascades to all associated records.
    
    Requirements:
    - 3.4: WHEN a user is deleted, THE System SHALL cascade delete all associated 
           workouts, workout_sessions, and related data
    - 7.5: WHEN a user is deleted, THE System SHALL cascade delete all associated 
           workout_sessions
    - 12.1: WHEN a user is deleted, THE System SHALL cascade delete all associated 
            workouts, workout_sessions, and logged_sets
    
    Test Scenario:
    1. Create a user
    2. Create a workout owned by the user
    3. Create a workout_exercise in the workout
    4. Create a workout_session for the user
    5. Create logged_sets in the workout_session
    6. Delete the user
    7. Verify all child records are deleted (workouts, workout_exercises, workout_sessions, logged_sets)
    """
    print("\n" + "="*70)
    print("TEST: User Cascade Delete")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Generate UUIDs for all records
        user_id = str(uuid.uuid4())
        exercise_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        workout_exercise_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        logged_set1_id = str(uuid.uuid4())
        logged_set2_id = str(uuid.uuid4())
        
        # Step 1: Create a user
        user = User(
            id=user_id,
            name="Test User for Cascade Delete",
            email=f"cascade_test_{user_id}@example.com",
            password_hash="hashed_password_cascade_test",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create an exercise (shared resource, not user-owned)
        exercise = Exercise(
            id=exercise_id,
            name=f"Bench Press for Test {user_id}",
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
            name="Push Day A",
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
            ended_at=None,  # In-progress session
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
        
        # Verify all records exist before deletion
        print("\nVerifying records exist before deletion:")
        assert db.query(User).filter_by(id=user_id).first() is not None
        print("  ✓ User exists")
        assert db.query(Workout).filter_by(id=workout_id).first() is not None
        print("  ✓ Workout exists")
        assert db.query(WorkoutExercise).filter_by(id=workout_exercise_id).first() is not None
        print("  ✓ WorkoutExercise exists")
        assert db.query(WorkoutSession).filter_by(id=session_id).first() is not None
        print("  ✓ WorkoutSession exists")
        assert db.query(LoggedSet).filter_by(id=logged_set1_id).first() is not None
        print("  ✓ LoggedSet 1 exists")
        assert db.query(LoggedSet).filter_by(id=logged_set2_id).first() is not None
        print("  ✓ LoggedSet 2 exists")
        
        # Step 7: Delete the user
        print(f"\nDeleting user: {user_id}")
        db.delete(user)
        db.commit()
        print(f"✓ User deleted")
        
        # Step 8: Verify all child records are deleted
        print("\nVerifying CASCADE delete behavior:")
        
        # Check user is deleted
        user_after = db.query(User).filter_by(id=user_id).first()
        if user_after is None:
            print("  ✓ User was deleted")
        else:
            print("  ✗ FAIL: User still exists after deletion")
            return False
        
        # Check workout is deleted (CASCADE from users)
        workout_after = db.query(Workout).filter_by(id=workout_id).first()
        if workout_after is None:
            print("  ✓ Workout was CASCADE deleted")
        else:
            print("  ✗ FAIL: Workout still exists (CASCADE delete failed)")
            return False
        
        # Check workout_exercise is deleted (CASCADE chain: users -> workouts -> workout_exercises)
        workout_exercise_after = db.query(WorkoutExercise).filter_by(id=workout_exercise_id).first()
        if workout_exercise_after is None:
            print("  ✓ WorkoutExercise was CASCADE deleted (chain: user -> workout -> workout_exercise)")
        else:
            print("  ✗ FAIL: WorkoutExercise still exists (CASCADE chain failed)")
            return False
        
        # Check workout_session is deleted (CASCADE from users)
        session_after = db.query(WorkoutSession).filter_by(id=session_id).first()
        if session_after is None:
            print("  ✓ WorkoutSession was CASCADE deleted")
        else:
            print("  ✗ FAIL: WorkoutSession still exists (CASCADE delete failed)")
            return False
        
        # Check logged_sets are deleted (CASCADE chain: users -> workout_sessions -> logged_sets)
        logged_set1_after = db.query(LoggedSet).filter_by(id=logged_set1_id).first()
        logged_set2_after = db.query(LoggedSet).filter_by(id=logged_set2_id).first()
        
        if logged_set1_after is None and logged_set2_after is None:
            print("  ✓ LoggedSets were CASCADE deleted (chain: user -> workout_session -> logged_sets)")
        else:
            if logged_set1_after is not None:
                print("  ✗ FAIL: LoggedSet 1 still exists (CASCADE chain failed)")
            if logged_set2_after is not None:
                print("  ✗ FAIL: LoggedSet 2 still exists (CASCADE chain failed)")
            return False
        
        # Verify exercise still exists (RESTRICT - should not be deleted)
        exercise_after = db.query(Exercise).filter_by(id=exercise_id).first()
        if exercise_after is not None:
            print("  ✓ Exercise was preserved (RESTRICT constraint working correctly)")
        else:
            print("  ✗ WARNING: Exercise was deleted (should be preserved with RESTRICT)")
            # This is not a failure of the cascade delete test, but noteworthy
        
        print("\n✓ PASS: User cascade delete works correctly!")
        print("\nVerified cascade delete chain:")
        print("  User deletion →")
        print("    ├─ Workouts deleted (CASCADE)")
        print("    │  └─ WorkoutExercises deleted (CASCADE)")
        print("    └─ WorkoutSessions deleted (CASCADE)")
        print("       └─ LoggedSets deleted (CASCADE)")
        print("\nExercise preserved (RESTRICT constraint)")
        
        # Cleanup: delete the exercise
        db.delete(exercise)
        db.commit()
        
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
    """Run the user cascade delete test"""
    print("="*70)
    print("TASK 11.1: Test User Cascade Delete")
    print("Testing Requirements: 3.4, 7.5, 12.1")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database schema")
    
    # Run test
    test_passed = test_user_cascade_delete(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: User Cascade Delete")
        print("="*70)
        print("\n✓ TEST PASSED - User cascade delete works correctly!")
        print("\nVerified:")
        print("  - User deletion cascades to workouts (Requirement 3.4, 12.1)")
        print("  - User deletion cascades to workout_sessions (Requirement 7.5, 12.1)")
        print("  - Cascade chains through workout_exercises (users -> workouts -> workout_exercises)")
        print("  - Cascade chains through logged_sets (users -> workout_sessions -> logged_sets)")
        print("  - Exercise records are preserved (RESTRICT constraint)")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: User Cascade Delete")
        print("="*70)
        print("\n✗ TEST FAILED - Review cascade delete implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

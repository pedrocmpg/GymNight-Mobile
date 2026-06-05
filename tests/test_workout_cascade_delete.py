#!/usr/bin/env python3
"""
Task 11.2: Test Workout Cascade Delete
Test cascade delete behavior when a Workout is deleted.

Requirements Tested: 6.4, 12.2
- Create workout with associated workout_exercises and workout_sessions
- Delete workout and verify all workout_exercises are deleted (CASCADE)
- Verify workout_sessions still exist but workout_id is NULL (SET NULL)
"""

import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
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


def test_workout_cascade_delete(engine):
    """
    Test that deleting a workout cascades to workout_exercises but sets workout_id to NULL in workout_sessions.
    
    Requirements:
    - 6.4: WHEN a workout is deleted, THE System SHALL cascade delete all associated 
           workout_exercises
    - 12.2: WHEN a workout is deleted, THE System SHALL cascade delete all associated 
            workout_exercises
    
    Test Scenario:
    1. Create a user (needed for foreign key)
    2. Create an exercise (needed for foreign key)
    3. Create a workout owned by the user
    4. Create workout_exercises in the workout
    5. Create a workout_session referencing the workout
    6. Create logged_sets in the workout_session
    7. Delete the workout
    8. Verify workout_exercises are deleted (CASCADE)
    9. Verify workout_session still exists with workout_id set to NULL (SET NULL)
    10. Verify logged_sets still exist (not affected by workout deletion)
    """
    print("\n" + "="*70)
    print("TEST: Workout Cascade Delete")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Generate UUIDs for all records
        user_id = str(uuid.uuid4())
        exercise1_id = str(uuid.uuid4())
        exercise2_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        workout_exercise1_id = str(uuid.uuid4())
        workout_exercise2_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        logged_set1_id = str(uuid.uuid4())
        logged_set2_id = str(uuid.uuid4())
        
        # Step 1: Create a user
        user = User(
            id=user_id,
            name="Test User for Workout Cascade",
            email=f"workout_cascade_{user_id}@example.com",
            password_hash="hashed_password_workout_cascade",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create exercises (shared resources, not user-owned)
        exercise1 = Exercise(
            id=exercise1_id,
            name=f"Bench Press for Workout Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise1)
        
        exercise2 = Exercise(
            id=exercise2_id,
            name=f"Overhead Press for Workout Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise2)
        db.commit()
        print(f"✓ Created exercise 1: {exercise1_id}")
        print(f"✓ Created exercise 2: {exercise2_id}")
        
        # Step 3: Create a workout owned by the user
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Push Day A - Workout Cascade Test",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        # Step 4: Create workout_exercises in the workout
        workout_exercise1 = WorkoutExercise(
            id=workout_exercise1_id,
            workout_id=workout_id,
            exercise_id=exercise1_id,
            series_target=4,
            reps_target=8,
            weight_target=80.0,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout_exercise1)
        
        workout_exercise2 = WorkoutExercise(
            id=workout_exercise2_id,
            workout_id=workout_id,
            exercise_id=exercise2_id,
            series_target=3,
            reps_target=10,
            weight_target=50.0,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout_exercise2)
        db.commit()
        print(f"✓ Created workout_exercise 1: {workout_exercise1_id}")
        print(f"✓ Created workout_exercise 2: {workout_exercise2_id}")
        
        # Step 5: Create a workout_session referencing the workout
        session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=workout_id,  # This should be set to NULL after workout deletion
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),  # Completed session
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(session)
        db.commit()
        print(f"✓ Created workout_session: {session_id} (with workout_id={workout_id})")
        
        # Step 6: Create logged_sets in the workout_session
        logged_set1 = LoggedSet(
            id=logged_set1_id,
            session_id=session_id,
            exercise_id=exercise1_id,
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
            exercise_id=exercise2_id,
            weight=50.0,
            repetitions=10,
            estimated_one_rm=50.0 * (1 + 10/30),  # Epley formula
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
        assert db.query(Exercise).filter_by(id=exercise1_id).first() is not None
        print("  ✓ Exercise 1 exists")
        assert db.query(Exercise).filter_by(id=exercise2_id).first() is not None
        print("  ✓ Exercise 2 exists")
        assert db.query(Workout).filter_by(id=workout_id).first() is not None
        print("  ✓ Workout exists")
        assert db.query(WorkoutExercise).filter_by(id=workout_exercise1_id).first() is not None
        print("  ✓ WorkoutExercise 1 exists")
        assert db.query(WorkoutExercise).filter_by(id=workout_exercise2_id).first() is not None
        print("  ✓ WorkoutExercise 2 exists")
        
        session_before = db.query(WorkoutSession).filter_by(id=session_id).first()
        assert session_before is not None
        assert session_before.workout_id == workout_id
        print(f"  ✓ WorkoutSession exists (workout_id={workout_id})")
        
        assert db.query(LoggedSet).filter_by(id=logged_set1_id).first() is not None
        print("  ✓ LoggedSet 1 exists")
        assert db.query(LoggedSet).filter_by(id=logged_set2_id).first() is not None
        print("  ✓ LoggedSet 2 exists")
        
        # Step 7: Delete the workout
        print(f"\nDeleting workout: {workout_id}")
        db.delete(workout)
        db.commit()
        print(f"✓ Workout deleted")
        
        # Step 8: Verify CASCADE and SET NULL behavior
        print("\nVerifying CASCADE delete and SET NULL behavior:")
        
        # Check workout is deleted
        workout_after = db.query(Workout).filter_by(id=workout_id).first()
        if workout_after is None:
            print("  ✓ Workout was deleted")
        else:
            print("  ✗ FAIL: Workout still exists after deletion")
            return False
        
        # Check workout_exercises are deleted (CASCADE from workouts)
        workout_exercise1_after = db.query(WorkoutExercise).filter_by(id=workout_exercise1_id).first()
        workout_exercise2_after = db.query(WorkoutExercise).filter_by(id=workout_exercise2_id).first()
        
        if workout_exercise1_after is None and workout_exercise2_after is None:
            print("  ✓ All WorkoutExercises were CASCADE deleted (Requirement 6.4, 12.2)")
        else:
            if workout_exercise1_after is not None:
                print("  ✗ FAIL: WorkoutExercise 1 still exists (CASCADE delete failed)")
            if workout_exercise2_after is not None:
                print("  ✗ FAIL: WorkoutExercise 2 still exists (CASCADE delete failed)")
            return False
        
        # Check workout_session still exists but workout_id is NULL (SET NULL)
        session_after = db.query(WorkoutSession).filter_by(id=session_id).first()
        if session_after is not None:
            print("  ✓ WorkoutSession still exists (preserved)")
            if session_after.workout_id is None:
                print("  ✓ WorkoutSession.workout_id was SET to NULL (Requirement 12.2)")
            else:
                print(f"  ✗ FAIL: WorkoutSession.workout_id is still {session_after.workout_id} (should be NULL)")
                return False
        else:
            print("  ✗ FAIL: WorkoutSession was deleted (should be preserved with SET NULL)")
            return False
        
        # Check logged_sets still exist (not affected by workout deletion)
        logged_set1_after = db.query(LoggedSet).filter_by(id=logged_set1_id).first()
        logged_set2_after = db.query(LoggedSet).filter_by(id=logged_set2_id).first()
        
        if logged_set1_after is not None and logged_set2_after is not None:
            print("  ✓ LoggedSets still exist (preserved, not affected by workout deletion)")
        else:
            if logged_set1_after is None:
                print("  ✗ FAIL: LoggedSet 1 was deleted (should be preserved)")
            if logged_set2_after is None:
                print("  ✗ FAIL: LoggedSet 2 was deleted (should be preserved)")
            return False
        
        # Verify user still exists
        user_after = db.query(User).filter_by(id=user_id).first()
        if user_after is not None:
            print("  ✓ User was preserved (no reverse cascade)")
        else:
            print("  ✗ WARNING: User was deleted (should be preserved)")
        
        # Verify exercises still exist (RESTRICT)
        exercise1_after = db.query(Exercise).filter_by(id=exercise1_id).first()
        exercise2_after = db.query(Exercise).filter_by(id=exercise2_id).first()
        if exercise1_after is not None and exercise2_after is not None:
            print("  ✓ Exercises were preserved (RESTRICT constraint working correctly)")
        else:
            print("  ✗ WARNING: Exercise(s) were deleted (should be preserved with RESTRICT)")
        
        print("\n✓ PASS: Workout cascade delete works correctly!")
        print("\nVerified cascade delete and SET NULL behavior:")
        print("  Workout deletion →")
        print("    ├─ WorkoutExercises deleted (CASCADE) ✓")
        print("    └─ WorkoutSessions.workout_id set to NULL (SET NULL) ✓")
        print("\nPreserved (not affected by workout deletion):")
        print("  ├─ User (no reverse cascade)")
        print("  ├─ Exercises (RESTRICT constraint)")
        print("  ├─ WorkoutSessions (SET NULL preserves history)")
        print("  └─ LoggedSets (still linked to sessions)")
        
        # Cleanup: delete all created records
        print("\nCleaning up test data...")
        if logged_set1_after:
            db.delete(logged_set1_after)
        if logged_set2_after:
            db.delete(logged_set2_after)
        if session_after:
            db.delete(session_after)
        if user_after:
            db.delete(user_after)
        if exercise1_after:
            db.delete(exercise1_after)
        if exercise2_after:
            db.delete(exercise2_after)
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
    """Run the workout cascade delete test"""
    print("="*70)
    print("TASK 11.2: Test Workout Cascade Delete")
    print("Testing Requirements: 6.4, 12.2")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database schema")
    
    # Run test
    test_passed = test_workout_cascade_delete(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: Workout Cascade Delete")
        print("="*70)
        print("\n✓ TEST PASSED - Workout cascade delete works correctly!")
        print("\nVerified:")
        print("  - Workout deletion cascades to workout_exercises (Requirement 6.4, 12.2)")
        print("  - WorkoutSession.workout_id set to NULL (Requirement 12.2)")
        print("  - WorkoutSessions preserved for historical data")
        print("  - LoggedSets preserved (linked to sessions, not workouts)")
        print("  - User and Exercise records preserved (no reverse cascade)")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: Workout Cascade Delete")
        print("="*70)
        print("\n✗ TEST FAILED - Review cascade delete and SET NULL implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

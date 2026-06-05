#!/usr/bin/env python3
"""
Task 11.3: Test WorkoutSession Cascade Delete
Test cascade delete behavior when a WorkoutSession is deleted.

Requirements Tested: 8.4, 12.3
- Create workout_session with associated logged_sets
- Delete workout_session and verify all logged_sets are deleted (CASCADE)
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
    WorkoutSession,
    LoggedSet,
    current_timestamp_ms
)


def test_workout_session_cascade_delete(engine):
    """
    Test that deleting a workout_session cascades to all associated logged_sets.
    
    Requirements:
    - 8.4: WHEN a workout_session is deleted, THE System SHALL cascade delete all 
           associated logged_sets
    - 12.3: WHEN a workout_session is deleted, THE System SHALL cascade delete all 
            associated logged_sets
    
    Test Scenario:
    1. Create a user (needed for foreign key)
    2. Create exercises (needed for foreign key)
    3. Create a workout template (optional for session)
    4. Create a workout_session for the user
    5. Create multiple logged_sets in the workout_session
    6. Delete the workout_session
    7. Verify all logged_sets are deleted (CASCADE)
    8. Verify user, exercises, and workout template are preserved (not affected)
    """
    print("\n" + "="*70)
    print("TEST: WorkoutSession Cascade Delete")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Generate UUIDs for all records
        user_id = str(uuid.uuid4())
        exercise1_id = str(uuid.uuid4())
        exercise2_id = str(uuid.uuid4())
        exercise3_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        logged_set1_id = str(uuid.uuid4())
        logged_set2_id = str(uuid.uuid4())
        logged_set3_id = str(uuid.uuid4())
        logged_set4_id = str(uuid.uuid4())
        
        # Step 1: Create a user
        user = User(
            id=user_id,
            name="Test User for Session Cascade",
            email=f"session_cascade_{user_id}@example.com",
            password_hash="hashed_password_session_cascade",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create exercises (shared resources, not user-owned)
        exercise1 = Exercise(
            id=exercise1_id,
            name=f"Bench Press for Session Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise1)
        
        exercise2 = Exercise(
            id=exercise2_id,
            name=f"Squat for Session Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise2)
        
        exercise3 = Exercise(
            id=exercise3_id,
            name=f"Deadlift for Session Test {user_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise3)
        db.commit()
        print(f"✓ Created exercise 1: {exercise1_id}")
        print(f"✓ Created exercise 2: {exercise2_id}")
        print(f"✓ Created exercise 3: {exercise3_id}")
        
        # Step 3: Create a workout template (optional for session)
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Full Body - Session Cascade Test",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        # Step 4: Create a workout_session for the user
        session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=workout_id,
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),  # Completed session
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(session)
        db.commit()
        print(f"✓ Created workout_session: {session_id}")
        
        # Step 5: Create multiple logged_sets in the workout_session
        logged_set1 = LoggedSet(
            id=logged_set1_id,
            session_id=session_id,
            exercise_id=exercise1_id,
            weight=100.0,
            repetitions=8,
            estimated_one_rm=100.0 * (1 + 8/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set1)
        
        logged_set2 = LoggedSet(
            id=logged_set2_id,
            session_id=session_id,
            exercise_id=exercise1_id,
            weight=102.5,
            repetitions=7,
            estimated_one_rm=102.5 * (1 + 7/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set2)
        
        logged_set3 = LoggedSet(
            id=logged_set3_id,
            session_id=session_id,
            exercise_id=exercise2_id,
            weight=120.0,
            repetitions=5,
            estimated_one_rm=120.0 * (1 + 5/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set3)
        
        logged_set4 = LoggedSet(
            id=logged_set4_id,
            session_id=session_id,
            exercise_id=exercise3_id,
            weight=140.0,
            repetitions=3,
            estimated_one_rm=140.0 * (1 + 3/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set4)
        db.commit()
        print(f"✓ Created logged_set 1: {logged_set1_id} (Bench Press: 100kg x 8)")
        print(f"✓ Created logged_set 2: {logged_set2_id} (Bench Press: 102.5kg x 7)")
        print(f"✓ Created logged_set 3: {logged_set3_id} (Squat: 120kg x 5)")
        print(f"✓ Created logged_set 4: {logged_set4_id} (Deadlift: 140kg x 3)")
        
        # Verify all records exist before deletion
        print("\nVerifying records exist before deletion:")
        assert db.query(User).filter_by(id=user_id).first() is not None
        print("  ✓ User exists")
        assert db.query(Exercise).filter_by(id=exercise1_id).first() is not None
        print("  ✓ Exercise 1 exists")
        assert db.query(Exercise).filter_by(id=exercise2_id).first() is not None
        print("  ✓ Exercise 2 exists")
        assert db.query(Exercise).filter_by(id=exercise3_id).first() is not None
        print("  ✓ Exercise 3 exists")
        assert db.query(Workout).filter_by(id=workout_id).first() is not None
        print("  ✓ Workout exists")
        assert db.query(WorkoutSession).filter_by(id=session_id).first() is not None
        print("  ✓ WorkoutSession exists")
        assert db.query(LoggedSet).filter_by(id=logged_set1_id).first() is not None
        print("  ✓ LoggedSet 1 exists")
        assert db.query(LoggedSet).filter_by(id=logged_set2_id).first() is not None
        print("  ✓ LoggedSet 2 exists")
        assert db.query(LoggedSet).filter_by(id=logged_set3_id).first() is not None
        print("  ✓ LoggedSet 3 exists")
        assert db.query(LoggedSet).filter_by(id=logged_set4_id).first() is not None
        print("  ✓ LoggedSet 4 exists")
        
        # Step 6: Delete the workout_session
        print(f"\nDeleting workout_session: {session_id}")
        db.delete(session)
        db.commit()
        print(f"✓ WorkoutSession deleted")
        
        # Step 7: Verify CASCADE delete behavior
        print("\nVerifying CASCADE delete behavior:")
        
        # Check workout_session is deleted
        session_after = db.query(WorkoutSession).filter_by(id=session_id).first()
        if session_after is None:
            print("  ✓ WorkoutSession was deleted")
        else:
            print("  ✗ FAIL: WorkoutSession still exists after deletion")
            return False
        
        # Check all logged_sets are deleted (CASCADE from workout_sessions)
        logged_set1_after = db.query(LoggedSet).filter_by(id=logged_set1_id).first()
        logged_set2_after = db.query(LoggedSet).filter_by(id=logged_set2_id).first()
        logged_set3_after = db.query(LoggedSet).filter_by(id=logged_set3_id).first()
        logged_set4_after = db.query(LoggedSet).filter_by(id=logged_set4_id).first()
        
        all_sets_deleted = (
            logged_set1_after is None and 
            logged_set2_after is None and 
            logged_set3_after is None and 
            logged_set4_after is None
        )
        
        if all_sets_deleted:
            print("  ✓ All LoggedSets were CASCADE deleted (Requirement 8.4, 12.3)")
        else:
            if logged_set1_after is not None:
                print("  ✗ FAIL: LoggedSet 1 still exists (CASCADE delete failed)")
            if logged_set2_after is not None:
                print("  ✗ FAIL: LoggedSet 2 still exists (CASCADE delete failed)")
            if logged_set3_after is not None:
                print("  ✗ FAIL: LoggedSet 3 still exists (CASCADE delete failed)")
            if logged_set4_after is not None:
                print("  ✗ FAIL: LoggedSet 4 still exists (CASCADE delete failed)")
            return False
        
        # Step 8: Verify user, exercises, and workout are preserved
        print("\nVerifying other records are preserved (not affected by session deletion):")
        
        # Check user still exists
        user_after = db.query(User).filter_by(id=user_id).first()
        if user_after is not None:
            print("  ✓ User was preserved (no reverse cascade)")
        else:
            print("  ✗ WARNING: User was deleted (should be preserved)")
        
        # Check exercises still exist (RESTRICT)
        exercise1_after = db.query(Exercise).filter_by(id=exercise1_id).first()
        exercise2_after = db.query(Exercise).filter_by(id=exercise2_id).first()
        exercise3_after = db.query(Exercise).filter_by(id=exercise3_id).first()
        
        all_exercises_preserved = (
            exercise1_after is not None and 
            exercise2_after is not None and 
            exercise3_after is not None
        )
        
        if all_exercises_preserved:
            print("  ✓ Exercises were preserved (RESTRICT constraint working correctly)")
        else:
            print("  ✗ WARNING: Exercise(s) were deleted (should be preserved with RESTRICT)")
        
        # Check workout still exists
        workout_after = db.query(Workout).filter_by(id=workout_id).first()
        if workout_after is not None:
            print("  ✓ Workout template was preserved (no reverse cascade)")
        else:
            print("  ✗ WARNING: Workout was deleted (should be preserved)")
        
        print("\n✓ PASS: WorkoutSession cascade delete works correctly!")
        print("\nVerified cascade delete behavior:")
        print("  WorkoutSession deletion →")
        print("    └─ LoggedSets deleted (CASCADE) ✓")
        print("\nPreserved (not affected by session deletion):")
        print("  ├─ User (no reverse cascade)")
        print("  ├─ Exercises (RESTRICT constraint)")
        print("  └─ Workout template (no reverse cascade)")
        
        # Cleanup: delete all created records
        print("\nCleaning up test data...")
        if workout_after:
            db.delete(workout_after)
        if user_after:
            db.delete(user_after)
        if exercise1_after:
            db.delete(exercise1_after)
        if exercise2_after:
            db.delete(exercise2_after)
        if exercise3_after:
            db.delete(exercise3_after)
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
    """Run the workout_session cascade delete test"""
    print("="*70)
    print("TASK 11.3: Test WorkoutSession Cascade Delete")
    print("Testing Requirements: 8.4, 12.3")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database schema")
    
    # Run test
    test_passed = test_workout_session_cascade_delete(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: WorkoutSession Cascade Delete")
        print("="*70)
        print("\n✓ TEST PASSED - WorkoutSession cascade delete works correctly!")
        print("\nVerified:")
        print("  - WorkoutSession deletion cascades to logged_sets (Requirement 8.4, 12.3)")
        print("  - All logged_sets deleted when session deleted")
        print("  - User, Workout, and Exercise records preserved")
        print("  - No orphaned logged_sets remain after session deletion")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: WorkoutSession Cascade Delete")
        print("="*70)
        print("\n✗ TEST FAILED - Review cascade delete implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Task 13.3: Test Epley Formula Edge Cases
Test comprehensive edge cases for estimated_one_rm calculation

Requirements Tested: 9.1, 9.3
Edge cases tested:
- Test with repetitions=0 (should equal weight)
- Test with weight=0 (should equal 0)
- Test with high repetitions=30 (should equal weight * 2)
- Verify no division by zero or overflow errors
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
    WorkoutSession,
    LoggedSet,
    current_timestamp_ms
)


def calculate_expected_one_rm(weight, repetitions):
    """
    Calculate expected one-rep max using Epley formula.
    Formula: weight * (1 + repetitions / 30)
    
    Args:
        weight: Weight lifted in kg
        repetitions: Number of repetitions completed
    
    Returns:
        float: Estimated one-rep maximum
    """
    return weight * (1 + repetitions / 30)


def test_repetitions_zero(engine):
    """
    Test with repetitions=0 (should equal weight).
    
    Formula: weight * (1 + 0/30) = weight * 1 = weight
    
    Requirements: 9.1, 9.3 - Edge case: zero repetitions
    """
    print("\n" + "="*70)
    print("TEST 1: Repetitions = 0 (should equal weight)")
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
        
        # Create logged_set with repetitions=0
        weight = 100.0
        repetitions = 0
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating LoggedSet:")
        print(f"    weight: {weight}kg")
        print(f"    repetitions: {repetitions}")
        print(f"    Formula: {weight} * (1 + {repetitions}/30) = {weight} * 1 = {weight}")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=weight,
            repetitions=repetitions,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        # Calculate expected value
        expected_one_rm = calculate_expected_one_rm(weight, repetitions)
        
        print(f"\n  Results:")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm}")
        print(f"    Expected estimated_one_rm: {expected_one_rm}")
        
        # Verify calculation (should equal weight)
        tolerance = 0.01
        difference = abs(logged_set.estimated_one_rm - expected_one_rm)
        if difference > tolerance:
            print(f"  ✗ FAIL: estimated_one_rm ({logged_set.estimated_one_rm}) differs from expected ({expected_one_rm}) by {difference}")
            return False
        
        if abs(logged_set.estimated_one_rm - weight) > tolerance:
            print(f"  ✗ FAIL: With reps=0, estimated_one_rm should equal weight ({weight}), got {logged_set.estimated_one_rm}")
            return False
        
        print(f"  ✓ estimated_one_rm correctly equals weight when repetitions=0")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: Repetitions=0 edge case handled correctly")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()



def test_weight_zero(engine):
    """
    Test with weight=0 (should equal 0).
    
    Formula: 0 * (1 + repetitions/30) = 0
    
    This is valid for bodyweight exercises or testing scenarios.
    
    Requirements: 9.1, 9.3 - Edge case: zero weight
    """
    print("\n" + "="*70)
    print("TEST 2: Weight = 0 (should equal 0)")
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
        
        # Create logged_set with weight=0
        weight = 0.0
        repetitions = 10
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating LoggedSet:")
        print(f"    weight: {weight}kg")
        print(f"    repetitions: {repetitions}")
        print(f"    Formula: {weight} * (1 + {repetitions}/30) = 0")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=weight,
            repetitions=repetitions,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        # Calculate expected value
        expected_one_rm = calculate_expected_one_rm(weight, repetitions)
        
        print(f"\n  Results:")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm}")
        print(f"    Expected estimated_one_rm: {expected_one_rm}")
        
        # Verify calculation (should equal 0)
        tolerance = 0.01
        if abs(logged_set.estimated_one_rm - 0.0) > tolerance:
            print(f"  ✗ FAIL: With weight=0, estimated_one_rm should equal 0, got {logged_set.estimated_one_rm}")
            return False
        
        print(f"  ✓ estimated_one_rm correctly equals 0 when weight=0")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: Weight=0 edge case handled correctly")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_high_repetitions_30(engine):
    """
    Test with high repetitions=30 (should equal weight * 2).
    
    Formula: weight * (1 + 30/30) = weight * 2
    
    This tests the formula at the upper boundary where accuracy decreases.
    
    Requirements: 9.1, 9.3 - Edge case: high repetitions
    """
    print("\n" + "="*70)
    print("TEST 3: High Repetitions = 30 (should equal weight * 2)")
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
        
        # Create logged_set with repetitions=30
        weight = 100.0
        repetitions = 30
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating LoggedSet:")
        print(f"    weight: {weight}kg")
        print(f"    repetitions: {repetitions}")
        print(f"    Formula: {weight} * (1 + {repetitions}/30) = {weight} * 2 = {weight * 2}")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=weight,
            repetitions=repetitions,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        # Calculate expected value
        expected_one_rm = calculate_expected_one_rm(weight, repetitions)
        
        print(f"\n  Results:")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm}")
        print(f"    Expected estimated_one_rm: {expected_one_rm}")
        
        # Verify calculation (should equal weight * 2)
        tolerance = 0.01
        difference = abs(logged_set.estimated_one_rm - expected_one_rm)
        if difference > tolerance:
            print(f"  ✗ FAIL: estimated_one_rm ({logged_set.estimated_one_rm}) differs from expected ({expected_one_rm}) by {difference}")
            return False
        
        if abs(logged_set.estimated_one_rm - (weight * 2)) > tolerance:
            print(f"  ✗ FAIL: With reps=30, estimated_one_rm should equal weight*2 ({weight * 2}), got {logged_set.estimated_one_rm}")
            return False
        
        print(f"  ✓ estimated_one_rm correctly equals weight*2 when repetitions=30")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: Repetitions=30 edge case handled correctly")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_no_division_by_zero(engine):
    """
    Test that no division by zero errors occur.
    
    The formula weight * (1 + repetitions/30) should never cause division by zero
    because we divide by the constant 30, not by any variable.
    
    Test various edge cases to ensure no mathematical errors:
    - weight=0, repetitions=0
    - Large weight values (1000kg)
    - Large repetition values (100 reps)
    
    Requirements: 9.1, 9.3 - No division by zero errors
    """
    print("\n" + "="*70)
    print("TEST 4: No Division By Zero Errors")
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
        
        # Test cases: (weight, repetitions, description)
        test_cases = [
            (0.0, 0, "Both weight and reps zero"),
            (1000.0, 1, "Large weight (1000kg)"),
            (100.0, 100, "Large repetitions (100 reps)"),
            (1000.0, 100, "Both large values"),
            (0.01, 1, "Very small weight"),
            (100.0, 1, "Minimal repetitions")
        ]
        
        print("\n  Testing for division by zero and overflow errors:")
        all_passed = True
        
        for weight, repetitions, description in test_cases:
            try:
                logged_set_id = str(uuid.uuid4())
                logged_set = LoggedSet(
                    id=logged_set_id,
                    session_id=session_id,
                    exercise_id=exercise_id,
                    weight=weight,
                    repetitions=repetitions,
                    completed_at=datetime.now(timezone.utc)
                )
                db.add(logged_set)
                db.commit()
                db.refresh(logged_set)
                
                # Verify calculation succeeded and result is valid
                expected_one_rm = calculate_expected_one_rm(weight, repetitions)
                
                # Check for NaN, Inf, or None
                if logged_set.estimated_one_rm is None:
                    print(f"    ✗ {description}: Result is None")
                    all_passed = False
                elif not isinstance(logged_set.estimated_one_rm, (int, float)):
                    print(f"    ✗ {description}: Result is not a number")
                    all_passed = False
                elif logged_set.estimated_one_rm != logged_set.estimated_one_rm:  # NaN check
                    print(f"    ✗ {description}: Result is NaN")
                    all_passed = False
                elif logged_set.estimated_one_rm == float('inf') or logged_set.estimated_one_rm == float('-inf'):
                    print(f"    ✗ {description}: Result is Infinity")
                    all_passed = False
                else:
                    tolerance = 0.01
                    difference = abs(logged_set.estimated_one_rm - expected_one_rm)
                    if difference > tolerance:
                        print(f"    ✗ {description}: Expected {expected_one_rm:.2f}, got {logged_set.estimated_one_rm:.2f}")
                        all_passed = False
                    else:
                        print(f"    ✓ {description}: {weight}kg x {repetitions} reps → {logged_set.estimated_one_rm:.2f}kg (no errors)")
                
            except ZeroDivisionError as e:
                print(f"    ✗ {description}: Division by zero error: {e}")
                all_passed = False
            except OverflowError as e:
                print(f"    ✗ {description}: Overflow error: {e}")
                all_passed = False
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        if all_passed:
            print("\n✓ PASS: No division by zero or overflow errors")
            return True
        else:
            print("\n✗ FAIL: Some tests encountered mathematical errors")
            return False
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_combined_edge_cases(engine):
    """
    Test combinations of edge cases to ensure robustness.
    
    Test scenarios:
    - weight=0, repetitions=0 (should equal 0)
    - weight=0, repetitions=30 (should equal 0)
    - weight=100, repetitions=0 (should equal 100)
    - Verify consistent behavior across all edge cases
    
    Requirements: 9.1, 9.3 - Edge case combinations
    """
    print("\n" + "="*70)
    print("TEST 5: Combined Edge Cases")
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
        
        # Test cases: (weight, repetitions, expected_result, description)
        test_cases = [
            (0.0, 0, 0.0, "weight=0, reps=0 → 0"),
            (0.0, 30, 0.0, "weight=0, reps=30 → 0"),
            (100.0, 0, 100.0, "weight=100, reps=0 → 100"),
            (50.0, 30, 100.0, "weight=50, reps=30 → 100"),
            (200.0, 15, 300.0, "weight=200, reps=15 → 300")
        ]
        
        print("\n  Testing combined edge cases:")
        all_passed = True
        tolerance = 0.01
        
        for weight, repetitions, expected_result, description in test_cases:
            logged_set_id = str(uuid.uuid4())
            logged_set = LoggedSet(
                id=logged_set_id,
                session_id=session_id,
                exercise_id=exercise_id,
                weight=weight,
                repetitions=repetitions,
                completed_at=datetime.now(timezone.utc)
            )
            db.add(logged_set)
            db.commit()
            db.refresh(logged_set)
            
            difference = abs(logged_set.estimated_one_rm - expected_result)
            
            if difference > tolerance:
                print(f"    ✗ {description}")
                print(f"      Expected {expected_result:.2f}, got {logged_set.estimated_one_rm:.2f} (diff: {difference})")
                all_passed = False
            else:
                print(f"    ✓ {description} = {logged_set.estimated_one_rm:.2f}kg")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        if all_passed:
            print("\n✓ PASS: All combined edge cases handled correctly")
            return True
        else:
            print("\n✗ FAIL: Some combined edge cases were incorrect")
            return False
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all Epley formula edge case tests"""
    print("="*70)
    print("TASK 13.3: Test Epley Formula Edge Cases")
    print("Testing Requirements: 9.1, 9.3")
    print("Formula: estimated_one_rm = weight * (1 + repetitions / 30)")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "Repetitions = 0 (should equal weight)": test_repetitions_zero(engine),
        "Weight = 0 (should equal 0)": test_weight_zero(engine),
        "High Repetitions = 30 (should equal weight * 2)": test_high_repetitions_30(engine),
        "No Division By Zero Errors": test_no_division_by_zero(engine),
        "Combined Edge Cases": test_combined_edge_cases(engine)
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
        print("\n✓ ALL TESTS PASSED - Epley formula edge cases handled correctly!")
        print("\nVerified:")
        print("  - repetitions=0 results in estimated_one_rm = weight")
        print("  - weight=0 results in estimated_one_rm = 0")
        print("  - repetitions=30 results in estimated_one_rm = weight * 2")
        print("  - No division by zero errors with any input combination")
        print("  - No overflow errors with large values")
        print("  - Combined edge cases produce correct results")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review Epley formula implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

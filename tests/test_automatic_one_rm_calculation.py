#!/usr/bin/env python3
"""
Task 13.1: Test Automatic 1RM Calculation When Not Provided
Test automatic estimated_one_rm calculation using Epley formula

Requirements Tested: 9.1, 9.2, 9.3
- Verify estimated_one_rm is automatically calculated when not provided
- Verify formula accuracy: weight * (1 + repetitions/30)
- Test with multiple weight/rep combinations
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


def test_basic_one_rm_calculation(engine):
    """
    Test basic automatic 1RM calculation with weight=100, repetitions=10.
    
    Expected: 100 * (1 + 10/30) = 100 * 1.333... ≈ 133.33
    
    Requirements: 9.1, 9.2, 9.3 - Automatic 1RM calculation
    """
    print("\n" + "="*70)
    print("TEST 1: Basic 1RM Calculation (100kg x 10 reps)")
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
        
        # Create logged_set WITHOUT providing estimated_one_rm
        weight = 100.0
        repetitions = 10
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating LoggedSet:")
        print(f"    weight: {weight}kg")
        print(f"    repetitions: {repetitions}")
        print(f"    estimated_one_rm: NOT PROVIDED (should auto-calculate)")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=weight,
            repetitions=repetitions,
            completed_at=datetime.now(timezone.utc)
            # Note: NOT providing estimated_one_rm
        )
        db.add(logged_set)
        db.commit()
        
        # Refresh to get calculated values
        db.refresh(logged_set)
        
        # Calculate expected value
        expected_one_rm = calculate_expected_one_rm(weight, repetitions)
        
        print(f"\n  Results:")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm}")
        print(f"    Expected estimated_one_rm: {expected_one_rm}")
        print(f"    Formula: {weight} * (1 + {repetitions}/30) = {weight} * {1 + repetitions/30} = {expected_one_rm}")
        
        # Verify estimated_one_rm was calculated
        if logged_set.estimated_one_rm is None:
            print("  ✗ FAIL: estimated_one_rm is None (should be auto-calculated)")
            return False
        print("  ✓ estimated_one_rm is not None")
        
        # Verify calculation accuracy (allow small floating-point tolerance)
        tolerance = 0.01
        difference = abs(logged_set.estimated_one_rm - expected_one_rm)
        if difference > tolerance:
            print(f"  ✗ FAIL: estimated_one_rm ({logged_set.estimated_one_rm}) differs from expected ({expected_one_rm}) by {difference}")
            return False
        print(f"  ✓ estimated_one_rm matches expected value (within {tolerance} tolerance)")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session and logged_set
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: Basic 1RM calculation works correctly")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_multiple_weight_rep_combinations(engine):
    """
    Test 1RM calculation with multiple weight/rep combinations.
    
    Test cases:
    - 80kg x 5 reps → 80 * (1 + 5/30) = 93.33kg
    - 100kg x 8 reps → 100 * (1 + 8/30) = 126.67kg
    - 110kg x 12 reps → 110 * (1 + 12/30) = 154.00kg
    - 50kg x 15 reps → 50 * (1 + 15/30) = 75.00kg
    - 120kg x 1 rep → 120 * (1 + 1/30) = 124.00kg
    
    Requirements: 9.1, 9.2, 9.3 - Formula accuracy across different inputs
    """
    print("\n" + "="*70)
    print("TEST 2: Multiple Weight/Rep Combinations")
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
        
        # Test cases: (weight, repetitions, expected_one_rm)
        test_cases = [
            (80.0, 5, 93.33),
            (100.0, 8, 126.67),
            (110.0, 12, 154.00),
            (50.0, 15, 75.00),
            (120.0, 1, 124.00)
        ]
        
        print("\n  Testing multiple weight/rep combinations:")
        all_passed = True
        tolerance = 0.01
        
        for weight, repetitions, expected_one_rm in test_cases:
            # Create logged_set WITHOUT providing estimated_one_rm
            logged_set_id = str(uuid.uuid4())
            logged_set = LoggedSet(
                id=logged_set_id,
                session_id=session_id,
                exercise_id=exercise_id,
                weight=weight,
                repetitions=repetitions,
                completed_at=datetime.now(timezone.utc)
                # Note: NOT providing estimated_one_rm
            )
            db.add(logged_set)
            db.commit()
            db.refresh(logged_set)
            
            # Verify calculation
            difference = abs(logged_set.estimated_one_rm - expected_one_rm)
            if difference > tolerance:
                print(f"    ✗ {weight}kg x {repetitions} reps: Expected {expected_one_rm}, got {logged_set.estimated_one_rm} (diff: {difference})")
                all_passed = False
            else:
                print(f"    ✓ {weight}kg x {repetitions} reps → {logged_set.estimated_one_rm:.2f}kg (expected {expected_one_rm:.2f}kg)")
        
        # Cleanup
        db.delete(user)  # Cascade will delete workout_session and logged_sets
        db.delete(exercise)
        db.commit()
        
        if all_passed:
            print("\n✓ PASS: All weight/rep combinations calculated correctly")
            return True
        else:
            print("\n✗ FAIL: Some calculations were incorrect")
            return False
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_client_provided_one_rm_override(engine):
    """
    Test that client can provide explicit estimated_one_rm value (override).
    
    The validator should accept client-provided value without recalculation.
    
    Requirements: 9.1, 9.2 - Client can override automatic calculation
    """
    print("\n" + "="*70)
    print("TEST 3: Client-Provided 1RM Override")
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
        
        # Create logged_set WITH explicit estimated_one_rm
        weight = 100.0
        repetitions = 10
        client_provided_one_rm = 140.0  # Different from calculated value (133.33)
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating LoggedSet:")
        print(f"    weight: {weight}kg")
        print(f"    repetitions: {repetitions}")
        print(f"    estimated_one_rm: {client_provided_one_rm}kg (CLIENT PROVIDED)")
        
        expected_calculated = calculate_expected_one_rm(weight, repetitions)
        print(f"    Note: Auto-calculated would be {expected_calculated:.2f}kg")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=weight,
            repetitions=repetitions,
            estimated_one_rm=client_provided_one_rm,  # Explicitly providing
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        print(f"\n  Results:")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm}")
        print(f"    Client provided: {client_provided_one_rm}")
        
        # Verify that client's value was accepted (not recalculated)
        if logged_set.estimated_one_rm != client_provided_one_rm:
            print(f"  ✗ FAIL: estimated_one_rm ({logged_set.estimated_one_rm}) doesn't match client-provided ({client_provided_one_rm})")
            return False
        print("  ✓ Client-provided estimated_one_rm was accepted without recalculation")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: Client can override automatic 1RM calculation")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_one_rm_recalculation_on_update(engine):
    """
    Test that estimated_one_rm is recalculated when weight or reps are updated.
    
    Requirements: 9.1, 9.2, 9.3 - Automatic recalculation on modification
    """
    print("\n" + "="*70)
    print("TEST 4: 1RM Recalculation on Update")
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
        
        # Create initial logged_set
        initial_weight = 100.0
        initial_reps = 10
        logged_set_id = str(uuid.uuid4())
        
        print(f"\n  Creating initial LoggedSet:")
        print(f"    weight: {initial_weight}kg")
        print(f"    repetitions: {initial_reps}")
        
        logged_set = LoggedSet(
            id=logged_set_id,
            session_id=session_id,
            exercise_id=exercise_id,
            weight=initial_weight,
            repetitions=initial_reps,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(logged_set)
        db.commit()
        db.refresh(logged_set)
        
        initial_one_rm = logged_set.estimated_one_rm
        print(f"    Initial estimated_one_rm: {initial_one_rm:.2f}kg")
        
        # Update weight
        new_weight = 110.0
        print(f"\n  Updating weight to {new_weight}kg (keeping reps at {initial_reps})")
        
        logged_set.weight = new_weight
        db.commit()
        db.refresh(logged_set)
        
        expected_one_rm = calculate_expected_one_rm(new_weight, initial_reps)
        print(f"    Expected estimated_one_rm: {expected_one_rm:.2f}kg")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm:.2f}kg")
        
        # Verify recalculation
        tolerance = 0.01
        difference = abs(logged_set.estimated_one_rm - expected_one_rm)
        if difference > tolerance:
            print(f"  ✗ FAIL: estimated_one_rm not recalculated correctly (diff: {difference})")
            return False
        print("  ✓ estimated_one_rm recalculated correctly after weight update")
        
        # Update repetitions
        new_reps = 12
        print(f"\n  Updating repetitions to {new_reps} (keeping weight at {new_weight}kg)")
        
        logged_set.repetitions = new_reps
        db.commit()
        db.refresh(logged_set)
        
        expected_one_rm = calculate_expected_one_rm(new_weight, new_reps)
        print(f"    Expected estimated_one_rm: {expected_one_rm:.2f}kg")
        print(f"    Actual estimated_one_rm: {logged_set.estimated_one_rm:.2f}kg")
        
        # Verify recalculation
        difference = abs(logged_set.estimated_one_rm - expected_one_rm)
        if difference > tolerance:
            print(f"  ✗ FAIL: estimated_one_rm not recalculated correctly (diff: {difference})")
            return False
        print("  ✓ estimated_one_rm recalculated correctly after repetitions update")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        print("\n✓ PASS: 1RM recalculation on update works correctly")
        return True
        
    except Exception as e:
        print(f"\n✗ FAIL: Unexpected error during test: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def test_edge_cases(engine):
    """
    Test edge cases for 1RM calculation.
    
    Edge cases:
    - Zero repetitions: weight * (1 + 0/30) = weight
    - Zero weight: 0 * (1 + reps/30) = 0
    - Very high repetitions: 100kg x 30 reps → 200kg
    
    Requirements: 9.1, 9.2, 9.3 - Formula works for edge cases
    """
    print("\n" + "="*70)
    print("TEST 5: Edge Cases")
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
            (100.0, 0, "Zero repetitions"),
            (0.0, 10, "Zero weight"),
            (100.0, 30, "Very high repetitions (30)"),
            (50.5, 7, "Fractional weight")
        ]
        
        print("\n  Testing edge cases:")
        all_passed = True
        tolerance = 0.01
        
        for weight, repetitions, description in test_cases:
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
            
            expected_one_rm = calculate_expected_one_rm(weight, repetitions)
            difference = abs(logged_set.estimated_one_rm - expected_one_rm)
            
            if difference > tolerance:
                print(f"    ✗ {description}: {weight}kg x {repetitions} reps")
                print(f"      Expected {expected_one_rm:.2f}, got {logged_set.estimated_one_rm:.2f} (diff: {difference})")
                all_passed = False
            else:
                print(f"    ✓ {description}: {weight}kg x {repetitions} reps → {logged_set.estimated_one_rm:.2f}kg")
        
        # Cleanup
        db.delete(user)
        db.delete(exercise)
        db.commit()
        
        if all_passed:
            print("\n✓ PASS: All edge cases handled correctly")
            return True
        else:
            print("\n✗ FAIL: Some edge cases were incorrect")
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
    """Run all automatic 1RM calculation tests"""
    print("="*70)
    print("TASK 13.1: Test Automatic 1RM Calculation When Not Provided")
    print("Testing Requirements: 9.1, 9.2, 9.3")
    print("Formula: estimated_one_rm = weight * (1 + repetitions / 30)")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "Basic 1RM Calculation (100kg x 10 reps)": test_basic_one_rm_calculation(engine),
        "Multiple Weight/Rep Combinations": test_multiple_weight_rep_combinations(engine),
        "Client-Provided 1RM Override": test_client_provided_one_rm_override(engine),
        "1RM Recalculation on Update": test_one_rm_recalculation_on_update(engine),
        "Edge Cases": test_edge_cases(engine)
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
        print("\n✓ ALL TESTS PASSED - Automatic 1RM calculation works correctly!")
        print("\nVerified:")
        print("  - estimated_one_rm is automatically calculated when not provided")
        print("  - Formula accuracy: weight * (1 + repetitions/30)")
        print("  - Calculation works across multiple weight/rep combinations")
        print("  - Client can override with explicit estimated_one_rm value")
        print("  - estimated_one_rm recalculates when weight or reps updated")
        print("  - Edge cases handled correctly (zero values, high reps, fractional weights)")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review 1RM calculation implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

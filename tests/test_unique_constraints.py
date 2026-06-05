#!/usr/bin/env python3
"""
Task 10.2: Test Unique Constraints
Test unique constraints on User.email and Exercise.name

Requirements Tested: 3.2, 4.2
- Test that inserting duplicate email in User raises IntegrityError
- Test that inserting duplicate name in Exercise raises IntegrityError
- Verify error messages contain "unique constraint" text
"""

import sys
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from app.core.config import DATABASE_URL
from app.database.connection import Base
from app.database.models import (
    User,
    Exercise,
    current_timestamp_ms
)


def test_user_email_unique_constraint(engine):
    """
    Test that inserting duplicate email in User raises IntegrityError.
    
    Requirements: 3.2 - THE System SHALL enforce unique constraint on the email column
    """
    print("\n" + "="*70)
    print("TEST 1: User Email Unique Constraint")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create first user with email
        user1_id = str(uuid.uuid4())
        user1 = User(
            id=user1_id,
            name="Alice Johnson",
            email="alice@example.com",
            password_hash="hashed_password_1",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user1)
        db.commit()
        print(f"✓ Created first user with email 'alice@example.com': {user1_id}")
        
        # Attempt to create second user with same email (should fail)
        user2_id = str(uuid.uuid4())
        user2 = User(
            id=user2_id,
            name="Bob Smith",
            email="alice@example.com",  # Duplicate email
            password_hash="hashed_password_2",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user2)
        
        # This should raise IntegrityError
        try:
            db.commit()
            print("✗ FAIL: Duplicate email was allowed (no IntegrityError raised)")
            return False
        except IntegrityError as e:
            error_message = str(e).lower()
            print(f"✓ IntegrityError raised as expected")
            print(f"  Error message: {e.orig}")
            
            # Verify error message contains "unique constraint" text
            if "unique" in error_message:
                print("✓ Error message contains 'unique' text")
                print("✓ PASS: User email unique constraint is enforced correctly")
                db.rollback()
                
                # Cleanup: delete test user
                db.query(User).filter_by(id=user1_id).delete()
                db.commit()
                return True
            else:
                print(f"✗ FAIL: Error message does not contain 'unique' text")
                print(f"  Actual error: {error_message}")
                db.rollback()
                return False
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_exercise_name_unique_constraint(engine):
    """
    Test that inserting duplicate name in Exercise raises IntegrityError.
    
    Requirements: 4.2 - THE System SHALL enforce unique constraint on the name column
    """
    print("\n" + "="*70)
    print("TEST 2: Exercise Name Unique Constraint")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create first exercise with name
        exercise1_id = str(uuid.uuid4())
        exercise1 = Exercise(
            id=exercise1_id,
            name="Barbell Bench Press",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise1)
        db.commit()
        print(f"✓ Created first exercise with name 'Barbell Bench Press': {exercise1_id}")
        
        # Attempt to create second exercise with same name (should fail)
        exercise2_id = str(uuid.uuid4())
        exercise2 = Exercise(
            id=exercise2_id,
            name="Barbell Bench Press",  # Duplicate name
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise2)
        
        # This should raise IntegrityError
        try:
            db.commit()
            print("✗ FAIL: Duplicate exercise name was allowed (no IntegrityError raised)")
            return False
        except IntegrityError as e:
            error_message = str(e).lower()
            print(f"✓ IntegrityError raised as expected")
            print(f"  Error message: {e.orig}")
            
            # Verify error message contains "unique constraint" text
            if "unique" in error_message:
                print("✓ Error message contains 'unique' text")
                print("✓ PASS: Exercise name unique constraint is enforced correctly")
                db.rollback()
                
                # Cleanup: delete test exercise
                db.query(Exercise).filter_by(id=exercise1_id).delete()
                db.commit()
                return True
            else:
                print(f"✗ FAIL: Error message does not contain 'unique' text")
                print(f"  Actual error: {error_message}")
                db.rollback()
                return False
        
    except Exception as e:
        print(f"✗ FAIL: Unexpected error during test: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all unique constraint tests"""
    print("="*70)
    print("TASK 10.2: Test Unique Constraints")
    print("Testing Requirements: 3.2 (User.email), 4.2 (Exercise.name)")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables should already exist from previous tasks
    # We'll just verify we can connect to the database
    print("✓ Using existing database tables")
    
    # Run tests
    results = {
        "User Email Unique Constraint": test_user_email_unique_constraint(engine),
        "Exercise Name Unique Constraint": test_exercise_name_unique_constraint(engine)
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
        print("\n✓ ALL TESTS PASSED - Unique constraints work correctly!")
        print("\nVerified:")
        print("  - User.email unique constraint prevents duplicate emails")
        print("  - Exercise.name unique constraint prevents duplicate exercise names")
        print("  - IntegrityError messages contain 'unique' text")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review unique constraint implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

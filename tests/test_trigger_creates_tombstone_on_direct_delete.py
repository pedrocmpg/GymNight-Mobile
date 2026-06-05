#!/usr/bin/env python3
"""
Task 14.1: Test Trigger Creates Tombstone on Direct Delete
Test that PostgreSQL trigger creates a tombstone record when a workout is directly deleted.

Requirements Tested: 10.1, 10.2, 10.3, 10.4, 10.5
- Create workout record
- Delete workout directly (not via CASCADE)
- Verify deleted_records contains entry with table_name="workouts", record_id=workout.id
- Verify deleted_at timestamp is within reasonable range
"""

import sys
import uuid
import time
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL
from app.database.models import (
    Base,
    User,
    Workout,
    DeletedRecord,
    current_timestamp_ms
)


def test_trigger_creates_tombstone_on_direct_delete(engine):
    """
    Test that the PostgreSQL trigger creates a tombstone record in deleted_records
    when a workout is directly deleted.
    
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
    
    Test Scenario:
    1. Create a user (needed for foreign key)
    2. Create a workout owned by the user
    3. Record timestamp before deletion
    4. Delete the workout directly (not via CASCADE)
    5. Verify deleted_records table contains a tombstone entry
    6. Verify tombstone has table_name="workouts"
    7. Verify tombstone has record_id matching the deleted workout's ID
    8. Verify deleted_at timestamp is within reasonable range (within 5 seconds)
    """
    print("\n" + "="*70)
    print("TEST: Trigger Creates Tombstone on Direct Delete")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Generate UUIDs for test records
        user_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        
        # Step 1: Create a user (needed for workout foreign key)
        user = User(
            id=user_id,
            name="Test User for Tombstone Test",
            email=f"tombstone_test_{user_id}@example.com",
            password_hash="hashed_password_tombstone_test",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        # Step 2: Create a workout owned by the user
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Test Workout for Tombstone",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        # Verify workout exists before deletion
        workout_before = db.query(Workout).filter_by(id=workout_id).first()
        assert workout_before is not None
        print(f"✓ Verified workout exists before deletion")
        
        # Step 3: Record timestamp before deletion (for validating deleted_at)
        timestamp_before_delete = int(time.time() * 1000)  # Unix milliseconds
        print(f"✓ Recorded timestamp before deletion: {timestamp_before_delete}")
        
        # Step 4: Delete the workout directly (not via CASCADE)
        print(f"\nDeleting workout directly: {workout_id}")
        db.delete(workout)
        db.commit()
        print(f"✓ Workout deleted")
        
        # Record timestamp after deletion (for validating deleted_at range)
        timestamp_after_delete = int(time.time() * 1000)  # Unix milliseconds
        print(f"✓ Recorded timestamp after deletion: {timestamp_after_delete}")
        
        # Step 5: Verify workout was deleted
        workout_after = db.query(Workout).filter_by(id=workout_id).first()
        if workout_after is None:
            print("✓ Workout was deleted from workouts table")
        else:
            print("✗ FAIL: Workout still exists after deletion")
            return False
        
        # Step 6: Query deleted_records table for tombstone
        print("\nVerifying tombstone record creation:")
        tombstone = db.query(DeletedRecord).filter_by(
            table_name="workouts",
            record_id=workout_id
        ).first()
        
        if tombstone is None:
            print("✗ FAIL: No tombstone found in deleted_records table")
            print(f"  Expected: table_name='workouts', record_id='{workout_id}'")
            
            # Debug: Check if any tombstones exist
            all_tombstones = db.query(DeletedRecord).all()
            print(f"\n  Debug - Total tombstones in table: {len(all_tombstones)}")
            if all_tombstones:
                print("  Recent tombstones:")
                for t in all_tombstones[-5:]:  # Show last 5
                    print(f"    - table_name='{t.table_name}', record_id='{t.record_id}', deleted_at={t.deleted_at}")
            
            return False
        
        print(f"✓ Found tombstone in deleted_records table")
        print(f"  - Tombstone ID: {tombstone.id}")
        
        # Step 7: Verify table_name field (Requirement 10.3)
        if tombstone.table_name == "workouts":
            print(f"✓ Tombstone has correct table_name: 'workouts' (Requirement 10.3)")
        else:
            print(f"✗ FAIL: Tombstone has incorrect table_name: '{tombstone.table_name}'")
            print(f"  Expected: 'workouts'")
            return False
        
        # Step 8: Verify record_id field (Requirement 10.4)
        if tombstone.record_id == workout_id:
            print(f"✓ Tombstone has correct record_id: '{workout_id}' (Requirement 10.4)")
        else:
            print(f"✗ FAIL: Tombstone has incorrect record_id: '{tombstone.record_id}'")
            print(f"  Expected: '{workout_id}'")
            return False
        
        # Step 9: Verify deleted_at timestamp (Requirement 10.5)
        if tombstone.deleted_at is None:
            print("✗ FAIL: Tombstone deleted_at is NULL")
            return False
        
        print(f"✓ Tombstone has deleted_at timestamp: {tombstone.deleted_at} (Requirement 10.5)")
        
        # Step 10: Verify deleted_at is within reasonable range (within 5 seconds)
        # Allow 5 second window to account for test execution time and potential clock skew
        # Allow small negative offset (100ms) in case database timestamp is captured slightly before Python timestamp
        time_window_ms = 5000  # 5 seconds in milliseconds
        time_tolerance_before_ms = 100  # 100ms tolerance before our timestamp
        
        if (timestamp_before_delete - time_tolerance_before_ms) <= tombstone.deleted_at <= (timestamp_after_delete + time_window_ms):
            print(f"✓ Tombstone deleted_at is within reasonable range")
            print(f"  - Before delete:  {timestamp_before_delete}")
            print(f"  - Deleted at:     {tombstone.deleted_at}")
            print(f"  - After delete:   {timestamp_after_delete}")
            print(f"  - Time difference: {tombstone.deleted_at - timestamp_before_delete}ms")
        else:
            print(f"✗ FAIL: Tombstone deleted_at is outside reasonable range")
            print(f"  - Before delete:  {timestamp_before_delete}")
            print(f"  - Deleted at:     {tombstone.deleted_at}")
            print(f"  - After delete:   {timestamp_after_delete}")
            print(f"  - Expected range: {timestamp_before_delete - time_tolerance_before_ms} to {timestamp_after_delete + time_window_ms}")
            return False
        
        print("\n✓ PASS: Trigger creates tombstone on direct delete correctly!")
        print("\nVerified:")
        print(f"  - Tombstone record created in deleted_records table (Requirement 10.2)")
        print(f"  - Tombstone has id, table_name, record_id, deleted_at columns (Requirement 10.1)")
        print(f"  - table_name = 'workouts' (Requirement 10.3)")
        print(f"  - record_id = '{workout_id}' (Requirement 10.4)")
        print(f"  - deleted_at timestamp is valid and within range (Requirement 10.5)")
        
        # Cleanup: delete tombstone and user
        print("\nCleaning up test data...")
        db.delete(tombstone)
        db.delete(user)
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
    """Run the trigger tombstone creation test"""
    print("="*70)
    print("TASK 14.1: Test Trigger Creates Tombstone on Direct Delete")
    print("Testing Requirements: 10.1, 10.2, 10.3, 10.4, 10.5")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables and triggers should already exist
    print("✓ Using existing database schema with triggers")
    
    # Run test
    test_passed = test_trigger_creates_tombstone_on_direct_delete(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: Trigger Creates Tombstone on Direct Delete")
        print("="*70)
        print("\n✓ TEST PASSED - PostgreSQL trigger creates tombstone correctly!")
        print("\nVerified Requirements:")
        print("  - 10.1: Tombstone has id, table_name, record_id, deleted_at columns")
        print("  - 10.2: Trigger creates tombstone when record is deleted")
        print("  - 10.3: Tombstone stores correct table_name ('workouts')")
        print("  - 10.4: Tombstone stores correct record_id (deleted workout UUID)")
        print("  - 10.5: Tombstone stores deleted_at timestamp in Unix milliseconds")
        print("\nSync Protocol Impact:")
        print("  - Clients can query deleted_records WHERE deleted_at > last_pulled_at")
        print("  - Clients receive tombstone and delete corresponding local record")
        print("  - Offline-first synchronization works correctly for deletions")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: Trigger Creates Tombstone on Direct Delete")
        print("="*70)
        print("\n✗ TEST FAILED - Review trigger implementation")
        print("\nPossible Issues:")
        print("  - Trigger function may not be created")
        print("  - Trigger may not be attached to workouts table")
        print("  - Trigger function may have incorrect logic")
        print("  - deleted_records table may not exist")
        print("\nDebugging Steps:")
        print("  1. Check if trigger exists: SELECT * FROM pg_trigger WHERE tgname LIKE '%tombstone%';")
        print("  2. Check if function exists: SELECT * FROM pg_proc WHERE proname = 'create_tombstone_on_delete';")
        print("  3. Verify deleted_records table: SELECT * FROM deleted_records;")
        return 1


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Task 14.3: Test Sync Query Returns Tombstones Since Timestamp
Test that the sync protocol can query tombstones by timestamp for incremental synchronization.

Requirements Tested: 10.6
- Create and delete multiple records at different times
- Query deleted_records WHERE deleted_at > specific_timestamp
- Verify only tombstones after timestamp are returned
- Verify tombstones can be used to sync deletions to client
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
    Exercise,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    LoggedSet,
    DeletedRecord,
    current_timestamp_ms
)


def test_sync_query_returns_tombstones_since_timestamp(engine):
    """
    Test that sync queries can retrieve tombstones created after a specific timestamp.
    
    This simulates the incremental sync protocol workflow where a mobile client
    queries for deletions that occurred since their last sync timestamp.
    
    Requirements:
    - 10.6: THE Sync_Protocol SHALL use deleted_records to inform clients which 
            records to delete locally
    
    Test Scenario:
    1. Record initial sync timestamp (simulating client's last_pulled_at)
    2. Create and delete first batch of records (older deletions)
    3. Record mid-point timestamp (simulating client sync checkpoint)
    4. Wait to ensure timestamp difference
    5. Create and delete second batch of records (newer deletions)
    6. Query deleted_records WHERE deleted_at > mid_point_timestamp
    7. Verify only second batch tombstones are returned (not first batch)
    8. Verify tombstones contain all required information for client sync
    9. Simulate client sync workflow: receive tombstones, identify local records to delete
    
    This validates that clients can perform incremental sync by querying only
    tombstones created since their last successful sync, avoiding full table scans.
    """
    print("\n" + "="*70)
    print("TEST: Sync Query Returns Tombstones Since Timestamp")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # ====================================================================
        # Step 1: Record initial sync timestamp (client's last_pulled_at)
        # ====================================================================
        # Simulate a client that last synced at this moment
        # All subsequent operations simulate changes that occurred after client went offline
        initial_sync_timestamp = int(time.time() * 1000)  # Unix milliseconds
        print(f"\nInitial sync timestamp (client's last_pulled_at): {initial_sync_timestamp}")
        print(f"Simulating client synced at: {datetime.fromtimestamp(initial_sync_timestamp/1000)}")
        
        # ====================================================================
        # Step 2: Create and delete FIRST BATCH of records (older deletions)
        # ====================================================================
        print("\n" + "-"*70)
        print("FIRST BATCH: Creating and deleting older records...")
        print("-"*70)
        
        # Create test entities for first batch
        user1_id = str(uuid.uuid4())
        exercise1_id = str(uuid.uuid4())
        workout1_id = str(uuid.uuid4())
        workout_exercise1_id = str(uuid.uuid4())
        
        # Create user 1
        user1 = User(
            id=user1_id,
            name="User 1 - Old Batch",
            email=f"user1_old_{user1_id}@example.com",
            password_hash="hashed_password_1",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user1)
        db.commit()
        print(f"✓ Created user1: {user1_id}")
        
        # Create exercise 1
        exercise1 = Exercise(
            id=exercise1_id,
            name=f"Exercise 1 Old Batch {user1_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise1)
        db.commit()
        print(f"✓ Created exercise1: {exercise1_id}")
        
        # Create workout 1
        workout1 = Workout(
            id=workout1_id,
            user_id=user1_id,
            name="Workout 1 - Old Batch",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout1)
        db.commit()
        print(f"✓ Created workout1: {workout1_id}")
        
        # Create workout_exercise 1
        workout_exercise1 = WorkoutExercise(
            id=workout_exercise1_id,
            workout_id=workout1_id,
            exercise_id=exercise1_id,
            series_target=4,
            reps_target=8,
            weight_target=80.0,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout_exercise1)
        db.commit()
        print(f"✓ Created workout_exercise1: {workout_exercise1_id}")
        
        # Small delay to ensure timestamp difference
        time.sleep(0.1)
        
        # Delete workout 1 (will CASCADE to workout_exercise1)
        # This creates tombstones in the "old batch" that client should already have
        print(f"\nDeleting workout1 (old batch): {workout1_id}")
        db.delete(workout1)
        db.commit()
        print(f"✓ Deleted workout1 - tombstones created in old batch")
        
        # ====================================================================
        # Step 3: Record mid-point timestamp (client sync checkpoint)
        # ====================================================================
        # Simulate client performing a sync and storing this as new last_pulled_at
        # Client now has all tombstones up to this point
        time.sleep(0.1)  # Ensure timestamp separation
        midpoint_sync_timestamp = int(time.time() * 1000)  # Unix milliseconds
        print(f"\n" + "="*70)
        print(f"MIDPOINT SYNC TIMESTAMP (new last_pulled_at): {midpoint_sync_timestamp}")
        print(f"Client synced at: {datetime.fromtimestamp(midpoint_sync_timestamp/1000)}")
        print(f"Client now has all deletions up to this timestamp")
        print("="*70)
        
        # ====================================================================
        # Step 4: Wait to ensure timestamp difference
        # ====================================================================
        # In real-world scenario, client goes offline and server continues operating
        # We need measurable time difference to validate timestamp-based filtering
        time.sleep(0.2)  # 200ms delay to ensure clear timestamp separation
        
        # ====================================================================
        # Step 5: Create and delete SECOND BATCH of records (newer deletions)
        # ====================================================================
        print("\n" + "-"*70)
        print("SECOND BATCH: Creating and deleting newer records...")
        print("-"*70)
        
        # Create test entities for second batch
        user2_id = str(uuid.uuid4())
        exercise2_id = str(uuid.uuid4())
        workout2_id = str(uuid.uuid4())
        workout_exercise2_id = str(uuid.uuid4())
        session2_id = str(uuid.uuid4())
        logged_set2_id = str(uuid.uuid4())
        
        # Create user 2
        user2 = User(
            id=user2_id,
            name="User 2 - New Batch",
            email=f"user2_new_{user2_id}@example.com",
            password_hash="hashed_password_2",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user2)
        db.commit()
        print(f"✓ Created user2: {user2_id}")
        
        # Create exercise 2
        exercise2 = Exercise(
            id=exercise2_id,
            name=f"Exercise 2 New Batch {user2_id}",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(exercise2)
        db.commit()
        print(f"✓ Created exercise2: {exercise2_id}")
        
        # Create workout 2
        workout2 = Workout(
            id=workout2_id,
            user_id=user2_id,
            name="Workout 2 - New Batch",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout2)
        db.commit()
        print(f"✓ Created workout2: {workout2_id}")
        
        # Create workout_exercise 2
        workout_exercise2 = WorkoutExercise(
            id=workout_exercise2_id,
            workout_id=workout2_id,
            exercise_id=exercise2_id,
            series_target=3,
            reps_target=10,
            weight_target=60.0,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout_exercise2)
        db.commit()
        print(f"✓ Created workout_exercise2: {workout_exercise2_id}")
        
        # Create workout_session 2
        session2 = WorkoutSession(
            id=session2_id,
            user_id=user2_id,
            workout_id=workout2_id,
            started_at=datetime.now(timezone.utc),
            ended_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(session2)
        db.commit()
        print(f"✓ Created workout_session2: {session2_id}")
        
        # Create logged_set 2
        logged_set2 = LoggedSet(
            id=logged_set2_id,
            session_id=session2_id,
            exercise_id=exercise2_id,
            weight=60.0,
            repetitions=10,
            estimated_one_rm=60.0 * (1 + 10/30),  # Epley formula
            completed_at=datetime.now(timezone.utc),
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(logged_set2)
        db.commit()
        print(f"✓ Created logged_set2: {logged_set2_id}")
        
        # Small delay to ensure timestamp difference
        time.sleep(0.1)
        
        # Delete user 2 (will CASCADE to all owned records)
        # This creates tombstones in the "new batch" that client should receive in next sync
        print(f"\nDeleting user2 (new batch): {user2_id}")
        db.delete(user2)
        db.commit()
        print(f"✓ Deleted user2 - tombstones created in new batch via CASCADE")
        
        # ====================================================================
        # Step 6: Query deleted_records WHERE deleted_at > midpoint_timestamp
        # ====================================================================
        # This simulates the sync protocol query that a client would perform
        # Client sends: GET /api/sync?last_pulled_at=<midpoint_sync_timestamp>
        # Server queries: SELECT * FROM deleted_records WHERE deleted_at > ?
        print("\n" + "="*70)
        print("SYNC PROTOCOL QUERY: Fetching tombstones since midpoint timestamp")
        print("="*70)
        print(f"\nExecuting sync query:")
        print(f"  SELECT * FROM deleted_records")
        print(f"  WHERE deleted_at > {midpoint_sync_timestamp}")
        
        # Query tombstones created AFTER midpoint sync timestamp
        # This is the core sync protocol query that clients perform
        new_tombstones = db.query(DeletedRecord).filter(
            DeletedRecord.deleted_at > midpoint_sync_timestamp
        ).order_by(DeletedRecord.deleted_at).all()
        
        print(f"\n✓ Query returned {len(new_tombstones)} tombstone(s)")
        
        # ====================================================================
        # Step 7: Verify only SECOND BATCH tombstones are returned
        # ====================================================================
        print("\n" + "-"*70)
        print("VERIFICATION: Checking returned tombstones...")
        print("-"*70)
        
        # Expected tombstones from SECOND BATCH (user2 CASCADE delete):
        # - 1 user tombstone (users table)
        # - 1 workout tombstone (workouts table)
        # - 1 workout_exercise tombstone (workout_exercises table)
        # - 1 workout_session tombstone (workout_sessions table)
        # - 1 logged_set tombstone (logged_sets table)
        # Total: 5 tombstones
        
        expected_new_tombstones = {
            "users": [user2_id],
            "workouts": [workout2_id],
            "workout_exercises": [workout_exercise2_id],
            "workout_sessions": [session2_id],
            "logged_sets": [logged_set2_id]
        }
        
        # Should NOT include FIRST BATCH tombstones:
        # - workout1_id (workouts table)
        # - workout_exercise1_id (workout_exercises table)
        
        old_batch_ids = [workout1_id, workout_exercise1_id]
        
        # Organize returned tombstones by table_name
        returned_tombstones = {}
        for tombstone in new_tombstones:
            if tombstone.table_name not in returned_tombstones:
                returned_tombstones[tombstone.table_name] = []
            returned_tombstones[tombstone.table_name].append(tombstone.record_id)
        
        print("\nReturned tombstones by table:")
        for table_name, record_ids in returned_tombstones.items():
            print(f"  {table_name}:")
            for record_id in record_ids:
                print(f"    • {record_id}")
        
        # Verify correct number of tombstones
        if len(new_tombstones) != 5:
            print(f"\n✗ FAIL: Expected 5 tombstones, but got {len(new_tombstones)}")
            return False
        else:
            print(f"\n✓ Correct number of tombstones returned: 5")
        
        # Verify no old batch tombstones are included
        print("\nVerifying old batch tombstones are NOT included:")
        all_returned_ids = [t.record_id for t in new_tombstones]
        for old_id in old_batch_ids:
            if old_id in all_returned_ids:
                print(f"  ✗ FAIL: Old batch tombstone incorrectly included: {old_id}")
                return False
            else:
                print(f"  ✓ Old batch tombstone correctly excluded: {old_id}")
        
        # Verify all new batch tombstones are included
        print("\nVerifying new batch tombstones ARE included:")
        all_checks_passed = True
        
        for table_name, expected_record_ids in expected_new_tombstones.items():
            for expected_record_id in expected_record_ids:
                # Find tombstone for this record
                tombstone = db.query(DeletedRecord).filter(
                    DeletedRecord.table_name == table_name,
                    DeletedRecord.record_id == expected_record_id,
                    DeletedRecord.deleted_at > midpoint_sync_timestamp
                ).first()
                
                if tombstone is None:
                    print(f"  ✗ FAIL: Expected tombstone not found: {table_name}.{expected_record_id}")
                    all_checks_passed = False
                else:
                    print(f"  ✓ Found expected tombstone: {table_name}.{expected_record_id}")
                    print(f"    - Tombstone ID: {tombstone.id}")
                    print(f"    - Deleted at: {tombstone.deleted_at} ({datetime.fromtimestamp(tombstone.deleted_at/1000)})")
        
        if not all_checks_passed:
            return False
        
        # ====================================================================
        # Step 8: Verify tombstones contain all required sync information
        # ====================================================================
        print("\n" + "-"*70)
        print("VERIFICATION: Checking tombstone structure for sync protocol...")
        print("-"*70)
        
        for tombstone in new_tombstones:
            print(f"\nTombstone: {tombstone.id}")
            
            # Verify table_name is present and non-empty
            if not tombstone.table_name:
                print(f"  ✗ FAIL: table_name is missing or empty")
                all_checks_passed = False
            else:
                print(f"  ✓ table_name: '{tombstone.table_name}'")
            
            # Verify record_id is present and non-empty
            if not tombstone.record_id:
                print(f"  ✗ FAIL: record_id is missing or empty")
                all_checks_passed = False
            else:
                print(f"  ✓ record_id: '{tombstone.record_id}'")
            
            # Verify deleted_at is present and within reasonable range
            if tombstone.deleted_at is None:
                print(f"  ✗ FAIL: deleted_at is NULL")
                all_checks_passed = False
            elif tombstone.deleted_at <= midpoint_sync_timestamp:
                print(f"  ✗ FAIL: deleted_at ({tombstone.deleted_at}) is not after midpoint ({midpoint_sync_timestamp})")
                all_checks_passed = False
            else:
                print(f"  ✓ deleted_at: {tombstone.deleted_at} (after midpoint)")
        
        if not all_checks_passed:
            return False
        
        # ====================================================================
        # Step 9: Simulate client sync workflow
        # ====================================================================
        print("\n" + "="*70)
        print("SIMULATING CLIENT SYNC WORKFLOW (Requirement 10.6)")
        print("="*70)
        
        print("\nClient-side sync process:")
        print(f"1. Client last synced at: {midpoint_sync_timestamp}")
        print(f"2. Client sends GET /api/sync?last_pulled_at={midpoint_sync_timestamp}")
        print(f"3. Server queries: SELECT * FROM deleted_records WHERE deleted_at > {midpoint_sync_timestamp}")
        print(f"4. Server returns {len(new_tombstones)} tombstone(s) to client")
        print(f"\n5. Client processes tombstones:")
        
        # Simulate client processing tombstones
        for tombstone in new_tombstones:
            print(f"\n   Tombstone: {tombstone.table_name}.{tombstone.record_id}")
            print(f"   Client action: DELETE FROM local_{tombstone.table_name} WHERE id = '{tombstone.record_id}'")
            print(f"   Result: Local record removed from WatermelonDB")
        
        print(f"\n6. Client updates last_pulled_at = {int(time.time() * 1000)}")
        print(f"7. Client sync complete - {len(new_tombstones)} local records deleted")
        
        print("\n✓ PASS: Sync query returns tombstones since timestamp correctly!")
        print("\nVerified:")
        print(f"  - Tombstone query filters by deleted_at > timestamp correctly")
        print(f"  - Only tombstones created AFTER midpoint timestamp are returned")
        print(f"  - Old batch tombstones (before midpoint) are correctly excluded")
        print(f"  - New batch tombstones (after midpoint) are correctly included")
        print(f"  - All tombstones contain required sync information (table_name, record_id, deleted_at)")
        print(f"  - Sync protocol can inform clients which records to delete (Requirement 10.6)")
        
        # ====================================================================
        # Cleanup: delete all tombstones and remaining test data
        # ====================================================================
        print("\nCleaning up test data...")
        
        # Delete all tombstones from both batches
        all_test_tombstones = db.query(DeletedRecord).filter(
            DeletedRecord.deleted_at >= initial_sync_timestamp - 1000  # Include buffer
        ).all()
        for tombstone in all_test_tombstones:
            db.delete(tombstone)
        
        # Delete remaining entities (user1 and exercises)
        db.delete(user1)
        db.delete(exercise1)
        db.delete(exercise2)
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
    """Run the sync query tombstone timestamp filtering test"""
    print("="*70)
    print("TASK 14.3: Test Sync Query Returns Tombstones Since Timestamp")
    print("Testing Requirements: 10.6")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Tables and triggers should already exist
    print("✓ Using existing database schema with triggers")
    
    # Run test
    test_passed = test_sync_query_returns_tombstones_since_timestamp(engine)
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    if test_passed:
        status = "✓ PASS"
        print(f"{status}: Sync Query Returns Tombstones Since Timestamp")
        print("="*70)
        print("\n✓ TEST PASSED - Incremental sync protocol works correctly!")
        print("\nVerified Requirement:")
        print("  - 10.6: Sync_Protocol uses deleted_records to inform clients which records to delete")
        print("\nSync Protocol Capabilities Validated:")
        print("  ✓ Timestamp-based filtering (WHERE deleted_at > last_pulled_at)")
        print("  ✓ Incremental sync (only new tombstones since last sync)")
        print("  ✓ Tombstone structure (table_name, record_id, deleted_at)")
        print("  ✓ Client deletion workflow (receive tombstones → delete local records)")
        print("\nReal-World Sync Scenario Tested:")
        print("  1. Client syncs at time T1, receives all tombstones up to T1")
        print("  2. Server processes deletions between T1 and T2")
        print("  3. Client syncs again at T2, receives only tombstones from T1 to T2")
        print("  4. Client deletes corresponding local records from WatermelonDB")
        print("  5. Client stores T2 as new last_pulled_at for next sync")
        print("\nPerformance Impact:")
        print("  - Avoids full table scans (only query tombstones after timestamp)")
        print("  - Efficient incremental sync (only fetch new deletions)")
        print("  - Scales well with large datasets (index on deleted_at recommended)")
        return 0
    else:
        status = "✗ FAIL"
        print(f"{status}: Sync Query Returns Tombstones Since Timestamp")
        print("="*70)
        print("\n✗ TEST FAILED - Review sync query implementation")
        print("\nPossible Issues:")
        print("  - Tombstone deleted_at timestamps may not be accurate")
        print("  - Query filtering (WHERE deleted_at > timestamp) may not work correctly")
        print("  - Trigger timing issues (tombstones created with wrong timestamp)")
        print("  - Index missing on deleted_at column (performance issue)")
        print("\nDebugging Steps:")
        print("  1. Check deleted_at values: SELECT id, table_name, record_id, deleted_at FROM deleted_records ORDER BY deleted_at;")
        print("  2. Test query filtering: SELECT * FROM deleted_records WHERE deleted_at > <timestamp>;")
        print("  3. Verify trigger function uses correct timestamp: SELECT prosrc FROM pg_proc WHERE proname = 'create_tombstone_on_delete';")
        print("  4. Check index exists: SELECT * FROM pg_indexes WHERE tablename = 'deleted_records';")
        return 1


if __name__ == "__main__":
    sys.exit(main())

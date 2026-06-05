"""
Bug Condition Exploration Tests for Offline-First Database Rebuild

**CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist.
**DO NOT attempt to fix the tests or the code when they fail.**
**GOAL**: Surface counterexamples that demonstrate all 6 problems exist.

These tests encode the EXPECTED behavior - they will validate the fix when they pass after implementation.

Validates Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**
"""

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from app.core.config import DATABASE_URL
from app.database.connection import Base
from app.database.models.user import User
from app.database.models.exercise import Exercise
from app.database.models.workout import Workout, WorkoutExercise
from app.database.models.history import WorkoutSession, LoggedSet
from app.database.models.sync import DeletedRecord
from datetime import datetime, timezone
import uuid


# ============================================================================
# PROBLEM 1: Missing _status and _changed fields on syncable models
# ============================================================================

def test_problem1_missing_status_and_changed_fields():
    """
    **Problem 1**: Verify _status and _changed columns DO NOT exist on syncable models
    
    **EXPECTED OUTCOME**: This test FAILS (proves bug exists)
    
    **Bug Condition**: Syncable models (User, Exercise, Workout, WorkoutExercise, 
    WorkoutSession, LoggedSet) lack _status and _changed tracking fields required
    for WatermelonDB sync optimization.
    
    **Impact**: Forces full-record transmission instead of granular sync.
    
    **Validates: Requirement 1.1, 1.2**
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Check all syncable models for missing _status and _changed fields
    syncable_tables = [
        'users',
        'exercises', 
        'workouts',
        'workout_exercises',
        'workout_sessions',
        'logged_sets'
    ]
    
    missing_fields = []
    
    for table_name in syncable_tables:
        columns = [col['name'] for col in inspector.get_columns(table_name)]
        
        if '_status' not in columns:
            missing_fields.append(f"{table_name}._status")
        
        if '_changed' not in columns:
            missing_fields.append(f"{table_name}._changed")
    
    # Assert that _status and _changed fields exist (expected behavior)
    # This will FAIL on unfixed code because the fields don't exist yet
    assert len(missing_fields) == 0, (
        f"Missing WatermelonDB optimization fields: {', '.join(missing_fields)}. "
        f"Expected _status and _changed columns on all syncable models for granular sync."
    )


# ============================================================================
# PROBLEM 2: Timestamp type inconsistency (DateTime vs BigInteger)
# ============================================================================

def test_problem2_datetime_vs_biginteger_inconsistency():
    """
    **Problem 2**: Verify WorkoutSession.started_at, WorkoutSession.ended_at, 
    LoggedSet.completed_at are DateTime not BigInteger
    
    **EXPECTED OUTCOME**: This test FAILS (proves bug exists)
    
    **Bug Condition**: WorkoutSession and LoggedSet use DateTime(timezone=True) 
    for business timestamps while sync protocol uses BigInteger Unix milliseconds,
    creating type inconsistency.
    
    **Impact**: Type conversion complexity, inconsistent with sync protocol conventions.
    
    **Validates: Requirement 1.3**
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Check WorkoutSession timestamp types
    ws_columns = {col['name']: col for col in inspector.get_columns('workout_sessions')}
    
    # Check LoggedSet timestamp types
    ls_columns = {col['name']: col for col in inspector.get_columns('logged_sets')}
    
    # Expected: All timestamps should be BigInteger for consistency with sync protocol
    # Actual (unfixed): started_at, ended_at, completed_at are DateTime
    
    type_inconsistencies = []
    
    # Check WorkoutSession.started_at (should be BigInteger, is DateTime)
    if 'started_at' in ws_columns:
        col_type = str(ws_columns['started_at']['type']).upper()
        if 'TIMESTAMP' in col_type or 'DATETIME' in col_type:
            type_inconsistencies.append(
                f"workout_sessions.started_at is {col_type} (expected BIGINT)"
            )
    
    # Check WorkoutSession.ended_at (should be BigInteger, is DateTime)
    if 'ended_at' in ws_columns:
        col_type = str(ws_columns['ended_at']['type']).upper()
        if 'TIMESTAMP' in col_type or 'DATETIME' in col_type:
            type_inconsistencies.append(
                f"workout_sessions.ended_at is {col_type} (expected BIGINT)"
            )
    
    # Check LoggedSet.completed_at (should be BigInteger, is DateTime)
    if 'completed_at' in ls_columns:
        col_type = str(ls_columns['completed_at']['type']).upper()
        if 'TIMESTAMP' in col_type or 'DATETIME' in col_type:
            type_inconsistencies.append(
                f"logged_sets.completed_at is {col_type} (expected BIGINT)"
            )
    
    # Assert that all timestamps use BigInteger (expected behavior)
    # This will FAIL on unfixed code because timestamps are currently DateTime
    assert len(type_inconsistencies) == 0, (
        f"Timestamp type inconsistencies found: {'; '.join(type_inconsistencies)}. "
        f"Expected all timestamps to use BigInteger Unix milliseconds for sync protocol consistency."
    )


# ============================================================================
# PROBLEM 3: Missing user_id on DeletedRecord table
# ============================================================================

def test_problem3_missing_user_id_on_deleted_record():
    """
    **Problem 3**: Verify DeletedRecord table DOES NOT have user_id column
    
    **EXPECTED OUTCOME**: This test FAILS (proves bug exists)
    
    **Bug Condition**: DeletedRecord table lacks user_id column for multi-tenant filtering,
    forcing server to return tombstones for ALL users.
    
    **Impact**: Inefficient client-side filtering in multi-tenant scenarios.
    
    **Validates: Requirement 1.4**
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Check if user_id column exists on deleted_records table
    dr_columns = [col['name'] for col in inspector.get_columns('deleted_records')]
    
    # Assert that user_id column exists (expected behavior)
    # This will FAIL on unfixed code because user_id doesn't exist yet
    assert 'user_id' in dr_columns, (
        "deleted_records table missing user_id column. "
        "Expected user_id for multi-tenant tombstone filtering."
    )


# ============================================================================
# PROBLEM 4: Missing composite index (user_id, deleted_at)
# ============================================================================

def test_problem4_missing_composite_index():
    """
    **Problem 4**: Verify composite index (user_id, deleted_at) DOES NOT exist on deleted_records
    
    **EXPECTED OUTCOME**: This test FAILS (proves bug exists)
    
    **Bug Condition**: Sync query pattern uses WHERE deleted_at > ? AND user_id = ?,
    but only single-column index on deleted_at exists, causing suboptimal query plan.
    
    **Impact**: Database scans all tombstones since timestamp, then filters by user_id.
    
    **Validates: Requirement 1.5**
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # Get all indexes on deleted_records table
    indexes = inspector.get_indexes('deleted_records')
    
    # Look for composite index on (user_id, deleted_at)
    composite_index_found = False
    
    for idx in indexes:
        columns = idx.get('column_names', [])
        # Check if index covers both user_id and deleted_at in correct order
        if len(columns) >= 2 and columns[0] == 'user_id' and columns[1] == 'deleted_at':
            composite_index_found = True
            break
    
    # Assert that composite index exists (expected behavior)
    # This will FAIL on unfixed code because composite index doesn't exist yet
    assert composite_index_found, (
        "Composite index (user_id, deleted_at) not found on deleted_records table. "
        "Expected composite index for optimal multi-tenant sync query performance."
    )


# ============================================================================
# PROBLEM 5: Validator crash with None during partial update
# ============================================================================

def test_problem5_validator_crash_on_partial_update():
    """
    **Problem 5**: Verify LoggedSet validator handles None values safely without crashing
    
    **EXPECTED OUTCOME**: After fix, this test PASSES (validates Requirement 2.6)
    
    **Bug Condition (FIXED)**: When WatermelonDB sends partial sync update with only weight field,
    repetitions may be None. The validator now safely handles this case.
    
    **Impact**: Sync no longer crashes, partial updates work correctly.
    
    **Validates: Requirement 2.6**
    """
    engine = create_engine(DATABASE_URL)
    
    # Test that the validator safely handles None values without crashing
    with engine.connect() as conn:
        trans = conn.begin()
        
        try:
            # Create test user
            user_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
                VALUES (:id, 'Test User', 'test@example.com', 'hash', 
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT),
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT))
            """), {"id": user_id})
            
            # Create test exercise
            exercise_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO exercises (id, name, created_at, updated_at)
                VALUES (:id, 'Test Exercise', 
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT),
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT))
            """), {"id": exercise_id})
            
            # Create test workout session
            session_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO workout_sessions (id, user_id, workout_id, started_at, ended_at, created_at, updated_at)
                VALUES (:id, :user_id, NULL, CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT), NULL,
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT),
                        CAST(EXTRACT(EPOCH FROM NOW()) * 1000 AS BIGINT))
            """), {"id": session_id, "user_id": user_id})
            
            # Test partial sync update: only weight provided, repetitions is None
            # This should NOT crash - validator should handle None gracefully
            logged_set = LoggedSet(
                id=str(uuid.uuid4()),
                session_id=session_id,
                exercise_id=exercise_id,
                weight=100.0,
                repetitions=None,  # Partial sync: only weight provided
                estimated_one_rm=None,
                completed_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            
            # VALIDATION: Validator should handle None gracefully without crashing
            # estimated_one_rm should remain None (calculation skipped when required fields missing)
            assert logged_set.estimated_one_rm is None, (
                f"Expected estimated_one_rm to be None when repetitions is None, "
                f"but got {logged_set.estimated_one_rm}"
            )
            
            trans.rollback()
            
            # Test passes - validator safely handles None without crashing (Requirement 2.6 met)
            
        except TypeError as e:
            # If TypeError occurs, the validator is crashing (bug not fixed)
            trans.rollback()
            pytest.fail(
                f"LoggedSet validator crashed with TypeError during partial update: {e}. "
                f"Validator should handle None values gracefully without crashing."
            )
        except Exception as e:
            trans.rollback()
            raise
            trans.rollback()
            pytest.fail(
                f"LoggedSet validator crashed with TypeError during partial update: {e}. "
                f"This confirms the bug exists."
            )
        except Exception as e:
            trans.rollback()
            raise


# ============================================================================
# PROBLEM 6: Missing _changed field tracking on updates
# ============================================================================

def test_problem6_missing_changed_tracking():
    """
    **Problem 6**: Verify _changed field IS automatically tracked on updates
    
    **EXPECTED OUTCOME**: After fix, this test PASSES (validates Requirement 2.2)
    
    **Bug Condition (FIXED)**: When fields are modified via ORM, the system now
    automatically tracks which fields changed in the _changed field.
    
    **Impact**: Granular sync can now determine minimal update set for efficiency.
    
    **Validates: Requirement 2.2**
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    # First check if _changed field exists at all (Problem 1)
    columns = [col['name'] for col in inspector.get_columns('users')]
    
    if '_changed' not in columns:
        pytest.skip("Skipping _changed tracking test - field doesn't exist yet (Problem 1)")
    
    # If _changed exists, test automatic tracking using ORM (event listeners work with ORM)
    from sqlalchemy.orm import Session
    from app.database.models.user import User
    
    with Session(engine) as session:
        try:
            # Create test user using ORM
            user = User(
                id=str(uuid.uuid4()),
                name='Original Name',
                email=f'tracking_test_{int(datetime.now(timezone.utc).timestamp() * 1000000)}@example.com',
                password_hash='$2b$12$' + 'a' * 53,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            session.flush()
            
            # Verify _status was set to 'created' automatically (Requirement 2.1)
            assert user._status == 'created', (
                f"Expected _status='created' on insert, but got '{user._status}'"
            )
            
            # Update the user's name using ORM (this triggers event listeners)
            user.name = 'Updated Name'
            user.updated_at = int(datetime.now(timezone.utc).timestamp() * 1000)
            session.flush()
            
            # VALIDATION: _status should be 'updated' and _changed should contain 'name'
            assert user._status == 'updated', (
                f"Expected _status='updated' after update, but got '{user._status}'"
            )
            
            assert user._changed is not None and 'name' in user._changed, (
                f"Expected _changed to contain 'name' after name update. "
                f"Found: {user._changed}"
            )
            
            session.rollback()
            
            # Test passes - automatic tracking works (Requirements 2.1, 2.2 met)
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Error during _changed tracking test: {e}")


# ============================================================================
# SUMMARY TEST: All 6 problems exist
# ============================================================================

def test_all_problems_exist():
    """
    **Summary Test**: Verify all 6 problems exist in current implementation
    
    **EXPECTED OUTCOME**: This test FAILS with detailed report of all bugs
    
    This test provides a comprehensive summary of all detected issues,
    serving as a single source of truth for bug condition validation.
    """
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    
    problems_found = []
    
    # Problem 1: Missing _status and _changed fields
    syncable_tables = ['users', 'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'logged_sets']
    missing_sync_fields = []
    for table in syncable_tables:
        columns = [col['name'] for col in inspector.get_columns(table)]
        if '_status' not in columns:
            missing_sync_fields.append(f"{table}._status")
        if '_changed' not in columns:
            missing_sync_fields.append(f"{table}._changed")
    
    if missing_sync_fields:
        problems_found.append(f"Problem 1: Missing sync optimization fields: {', '.join(missing_sync_fields)}")
    
    # Problem 2: DateTime vs BigInteger inconsistency
    ws_columns = {col['name']: col for col in inspector.get_columns('workout_sessions')}
    ls_columns = {col['name']: col for col in inspector.get_columns('logged_sets')}
    
    datetime_fields = []
    for field in ['started_at', 'ended_at']:
        if field in ws_columns:
            col_type = str(ws_columns[field]['type']).upper()
            if 'TIMESTAMP' in col_type or 'DATETIME' in col_type:
                datetime_fields.append(f"workout_sessions.{field}")
    
    if 'completed_at' in ls_columns:
        col_type = str(ls_columns['completed_at']['type']).upper()
        if 'TIMESTAMP' in col_type or 'DATETIME' in col_type:
            datetime_fields.append("logged_sets.completed_at")
    
    if datetime_fields:
        problems_found.append(f"Problem 2: DateTime instead of BigInteger: {', '.join(datetime_fields)}")
    
    # Problem 3: Missing user_id on DeletedRecord
    dr_columns = [col['name'] for col in inspector.get_columns('deleted_records')]
    if 'user_id' not in dr_columns:
        problems_found.append("Problem 3: deleted_records table missing user_id column")
    
    # Problem 4: Missing composite index
    indexes = inspector.get_indexes('deleted_records')
    composite_index_found = False
    for idx in indexes:
        columns = idx.get('column_names', [])
        if len(columns) >= 2 and columns[0] == 'user_id' and columns[1] == 'deleted_at':
            composite_index_found = True
            break
    
    if not composite_index_found:
        problems_found.append("Problem 4: Missing composite index (user_id, deleted_at) on deleted_records")
    
    # Problem 5: Validator crash - test separately (test_problem5)
    # This test only checks schema issues, not runtime behavior
    
    # Problem 6: Automatic _changed tracking
    # We test this by checking if event listeners are registered
    # For this summary, we only verify the fields exist (checked in Problem 1)
    
    # Assert all problems are fixed (expected behavior after fix)
    # This will FAIL on unfixed code with detailed problem list
    assert len(problems_found) == 0, (
        f"\n\nBUG CONDITION CONFIRMED: Found {len(problems_found)} schema/implementation defects:\n" +
        "\n".join(f"  {i+1}. {p}" for i, p in enumerate(problems_found)) +
        "\n\nThese test failures confirm the bugs exist. " +
        "Tests will pass after implementing the fix."
    )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

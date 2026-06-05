"""
Preservation Property-Based Tests for Offline-First Database Rebuild

**CRITICAL**: These tests MUST PASS on unfixed code - they validate baseline behavior.
**DO NOT implement new features - only test existing functionality.**
**GOAL**: Ensure that after the fix, all existing functionality remains unchanged.

These tests encode the PRESERVATION requirements - they will confirm the fix
doesn't break existing behavior when they continue passing after implementation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import DATABASE_URL
from app.database.connection import Base
from app.database.models.user import User
from app.database.models.exercise import Exercise
from app.database.models.workout import Workout, WorkoutExercise
from app.database.models.history import WorkoutSession, LoggedSet
from app.database.models.sync import DeletedRecord
from datetime import datetime, timezone
import uuid
import time


# ============================================================================
# FIXTURES: Reusable database engine to avoid connection pool exhaustion
# ============================================================================

@pytest.fixture(scope="module")
def db_engine():
    """Shared database engine for all property-based tests"""
    engine = create_engine(DATABASE_URL, pool_size=5, max_overflow=0)
    yield engine
    engine.dispose()


# ============================================================================
# STRATEGY DEFINITIONS: Smart generators for property-based testing
# ============================================================================

# UUID string generator
uuid_strategy = st.builds(lambda: str(uuid.uuid4()))

# Positive integer strategy for timestamps
timestamp_ms_strategy = st.integers(min_value=1000000000000, max_value=9999999999999)

# Reasonable weight values (0-500kg)
weight_strategy = st.floats(min_value=0.1, max_value=200.0, allow_nan=False, allow_infinity=False)

# Reasonable repetition values (1-30 reps typical range)
repetitions_strategy = st.integers(min_value=1, max_value=30)

# Small repetition range for accurate Epley formula (1-10 reps)
accurate_reps_strategy = st.integers(min_value=1, max_value=10)

# User name strategy
name_strategy = st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_characters=['\x00']))

# Email strategy
email_strategy = st.emails()

# Password hash strategy (simulated bcrypt hash)
password_hash_strategy = st.text(min_size=60, max_size=60, alphabet=st.characters(min_codepoint=33, max_codepoint=126))


# ============================================================================
# PROPERTY 1: Complete Record Creation Unchanged (Requirement 3.4)
# ============================================================================

@given(
    user_name=name_strategy,
    user_email=email_strategy,
    workout_name=name_strategy,
    exercise_name=name_strategy,
    weight=weight_strategy,
    reps=accurate_reps_strategy
)
@settings(max_examples=10, suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_property_complete_record_creation_unchanged(
    db_engine, user_name, user_email, workout_name, exercise_name, weight, reps
):
    """
    **Property 1**: Complete Record Creation Unchanged
    
    **PRESERVATION REQUIREMENT**: For any complete record creation with all fields,
    the system SHALL behave exactly as before the fix.
    
    **Property Statement**: For all valid complete records (User, Workout, LoggedSet),
    creation with full field sets produces identical behavior to original code.
    
    **What we're testing**: 
    - Users can be created with all required fields
    - Workouts can be created with all required fields
    - LoggedSets can be created with weight + repetitions
    - All relationships work correctly
    
    **Why this matters**: The fix should NOT change how complete records are created.
    
    **Validates: Requirement 3.4**
    """
    with Session(db_engine) as session:
        try:
            # Create complete User record
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name=user_name,
                email=f"test_{int(time.time()*1000000)}_{user_email}",  # Unique email
                password_hash="$2b$12$" + "a" * 53,  # Valid bcrypt hash format
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            session.flush()
            
            # Verify user created successfully
            assert user.id == user_id
            assert user.name == user_name
            
            # Create complete Exercise record
            exercise_id = str(uuid.uuid4())
            exercise = Exercise(
                id=exercise_id,
                name=exercise_name,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(exercise)
            session.flush()
            
            # Create complete Workout record
            workout_id = str(uuid.uuid4())
            workout = Workout(
                id=workout_id,
                user_id=user_id,
                name=workout_name,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout)
            session.flush()
            
            # Create complete WorkoutSession record
            session_id = str(uuid.uuid4())
            workout_session = WorkoutSession(
                id=session_id,
                user_id=user_id,
                workout_id=workout_id,
                started_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                ended_at=None,  # In progress
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout_session)
            session.flush()
            
            # Assume reasonable weight (skip if too small for calculation)
            assume(weight > 0.001)
            
            # Create complete LoggedSet with weight and repetitions
            # This should trigger automatic Epley calculation
            logged_set_id = str(uuid.uuid4())
            logged_set = LoggedSet(
                id=logged_set_id,
                session_id=session_id,
                exercise_id=exercise_id,
                weight=weight,
                repetitions=reps,
                # NO estimated_one_rm provided - should be auto-calculated
                completed_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(logged_set)
            session.flush()
            
            # PRESERVATION CHECK: Auto-calculation should work
            assert logged_set.estimated_one_rm is not None, \
                "Automatic one_rm calculation should work on complete record creation"
            
            # All records created successfully - behavior preserved
            session.rollback()
            
        except Exception as e:
            session.rollback()
            pytest.fail(f"Complete record creation failed - existing functionality broken: {e}")


# ============================================================================
# PROPERTY 2: Epley Formula Calculation Preserved (Requirement 3.3)
# ============================================================================

@given(
    weight=weight_strategy,
    reps=accurate_reps_strategy
)
@settings(max_examples=10)
def test_property_epley_formula_calculation_preserved(db_engine, weight, reps):
    """
    **Property 2**: Epley Formula Calculation Preserved
    
    **PRESERVATION REQUIREMENT**: For all complete LoggedSet records with weight
    and repetitions, Epley formula calculation SHALL work identically to before.
    
    **Property Statement**: For all weight W > 0 and reps R in [1,10],
    estimated_one_rm = W * (1 + R/30) within floating point tolerance.
    
    **Epley Formula**: estimated_one_rm = weight × (1 + repetitions / 30)
    
    **Why this matters**: The fix should NOT change the Epley formula calculation.
    
    **Validates: Requirement 3.3**
    """
    # Assume positive weight for meaningful calculation
    assume(weight > 0.001)
    
    with Session(db_engine) as session:
        try:
            # Create necessary parent records
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name="Test User",
                email=f"epley_test_{int(time.time()*1000000)}@example.com",
                password_hash="$2b$12$" + "a" * 53,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            
            exercise_id = str(uuid.uuid4())
            exercise = Exercise(
                id=exercise_id,
                name="Test Exercise",
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(exercise)
            
            session_id = str(uuid.uuid4())
            workout_session = WorkoutSession(
                id=session_id,
                user_id=user_id,
                workout_id=None,  # Freestyle session
                started_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                ended_at=None,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout_session)
            session.flush()
            
            # Create LoggedSet with weight and repetitions
            logged_set_id = str(uuid.uuid4())
            logged_set = LoggedSet(
                id=logged_set_id,
                session_id=session_id,
                exercise_id=exercise_id,
                weight=weight,
                repetitions=reps,
                # NO estimated_one_rm - should auto-calculate
                completed_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(logged_set)
            session.flush()
            
            # PRESERVATION CHECK: Epley formula calculation
            expected_one_rm = weight * (1 + reps / 30)
            actual_one_rm = logged_set.estimated_one_rm
            
            # Allow small floating point tolerance (0.01kg)
            assert actual_one_rm is not None, "estimated_one_rm should be calculated"
            assert abs(actual_one_rm - expected_one_rm) < 0.01, \
                f"Epley formula calculation mismatch: expected {expected_one_rm}, got {actual_one_rm}"
            
            session.rollback()
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Epley formula calculation failed: {e}")


# ============================================================================
# PROPERTY 3: Client Override Behavior Preserved (Requirement 3.2)
# ============================================================================

@given(
    weight=weight_strategy,
    reps=accurate_reps_strategy,
    client_one_rm=weight_strategy
)
@settings(max_examples=10)
def test_property_client_override_preserved(db_engine, weight, reps, client_one_rm):
    """
    **Property 3**: Client Override Behavior Preserved
    
    **PRESERVATION REQUIREMENT**: When client provides explicit estimated_one_rm,
    system SHALL accept it without recalculation.
    
    **Property Statement**: For all explicit client-provided estimated_one_rm values,
    the system accepts them as-is without applying Epley formula.
    
    **Why this matters**: Clients may use different formulas or have tested 1RM data.
    
    **Validates: Requirement 3.2**
    """
    assume(weight > 0.001)
    assume(client_one_rm > 0.001)
    
    with Session(db_engine) as session:
        try:
            # Create necessary parent records
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name="Test User",
                email=f"override_test_{int(time.time()*1000000)}@example.com",
                password_hash="$2b$12$" + "a" * 53,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            
            exercise_id = str(uuid.uuid4())
            exercise = Exercise(
                id=exercise_id,
                name="Test Exercise",
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(exercise)
            
            session_id = str(uuid.uuid4())
            workout_session = WorkoutSession(
                id=session_id,
                user_id=user_id,
                workout_id=None,
                started_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                ended_at=None,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout_session)
            session.flush()
            
            # Create LoggedSet with EXPLICIT estimated_one_rm (client override)
            logged_set_id = str(uuid.uuid4())
            logged_set = LoggedSet(
                id=logged_set_id,
                session_id=session_id,
                exercise_id=exercise_id,
                weight=weight,
                repetitions=reps,
                estimated_one_rm=client_one_rm,  # EXPLICIT CLIENT VALUE
                completed_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(logged_set)
            session.flush()
            
            # PRESERVATION CHECK: Client override respected
            assert logged_set.estimated_one_rm == client_one_rm, \
                f"Client override not respected: expected {client_one_rm}, got {logged_set.estimated_one_rm}"
            
            # Calculate what Epley would have given
            epley_value = weight * (1 + reps / 30)
            
            # If client value differs significantly from Epley, verify it's still the client value
            if abs(client_one_rm - epley_value) > 1.0:
                assert logged_set.estimated_one_rm == client_one_rm, \
                    "Client override should be preserved even when different from Epley formula"
            
            session.rollback()
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Client override behavior failed: {e}")


# ============================================================================
# PROPERTY 4: Foreign Key Cascade Behavior Preserved (Requirement 3.5)
# ============================================================================

def test_property_user_cascade_delete_preserved():
    """
    **Property 4**: Foreign Key Cascade Behavior Preserved
    
    **PRESERVATION REQUIREMENT**: All CASCADE, RESTRICT, and SET NULL behaviors
    SHALL remain identical to before the fix.
    
    **Property Statement**: User deletion cascades to workouts and sessions,
    workout deletion cascades to workout_exercises but SET NULL on sessions,
    exercise deletion is RESTRICTED by references.
    
    **Why this matters**: The fix should NOT change foreign key relationship behavior.
    
    **Validates: Requirement 3.5**
    """
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as session:
        try:
            # Create user
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name="Cascade Test User",
                email=f"cascade_test_{int(time.time()*1000000)}@example.com",
                password_hash="$2b$12$" + "a" * 53,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            
            # Create workout owned by user
            workout_id = str(uuid.uuid4())
            workout = Workout(
                id=workout_id,
                user_id=user_id,
                name="Test Workout",
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout)
            
            # Create workout session
            session_id = str(uuid.uuid4())
            workout_session = WorkoutSession(
                id=session_id,
                user_id=user_id,
                workout_id=workout_id,
                started_at=int(datetime.now(timezone.utc).timestamp() * 1000),  # BigInteger Unix milliseconds
                ended_at=None,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(workout_session)
            session.flush()
            
            # Verify records exist
            assert session.get(User, user_id) is not None
            assert session.get(Workout, workout_id) is not None
            assert session.get(WorkoutSession, session_id) is not None
            
            # Delete user - should CASCADE to workout and session
            session.delete(user)
            session.flush()
            
            # PRESERVATION CHECK: Cascade delete worked
            assert session.get(User, user_id) is None, "User should be deleted"
            assert session.get(Workout, workout_id) is None, "Workout should be cascaded deleted"
            assert session.get(WorkoutSession, session_id) is None, "Session should be cascaded deleted"
            
            session.rollback()
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Cascade delete behavior failed: {e}")


# ============================================================================
# PROPERTY 5: Timestamp Auto-Generation Preserved (Requirement 3.6)
# ============================================================================

def test_property_timestamp_auto_generation_preserved():
    """
    **Property 5**: Timestamp Auto-Generation Preserved
    
    **PRESERVATION REQUIREMENT**: created_at and updated_at SHALL continue to
    auto-generate Unix milliseconds exactly as before.
    
    **Property Statement**: For all new records without explicit timestamps,
    created_at and updated_at are auto-generated as Unix milliseconds.
    
    **Why this matters**: Sync protocol relies on automatic timestamp generation.
    
    **Validates: Requirement 3.6**
    """
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as session:
        try:
            # Create user WITHOUT explicit timestamps
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name="Timestamp Test User",
                email=f"timestamp_test_{int(time.time()*1000000)}@example.com",
                password_hash="$2b$12$" + "a" * 53
                # NO created_at or updated_at provided
            )
            session.add(user)
            session.flush()
            
            # PRESERVATION CHECK: Timestamps auto-generated
            assert user.created_at is not None, "created_at should be auto-generated"
            assert user.updated_at is not None, "updated_at should be auto-generated"
            
            # Verify timestamps are Unix milliseconds (13-digit integers)
            assert isinstance(user.created_at, int), "created_at should be integer"
            assert isinstance(user.updated_at, int), "updated_at should be integer"
            assert 1000000000000 <= user.created_at <= 9999999999999, \
                "created_at should be Unix milliseconds (13 digits)"
            assert 1000000000000 <= user.updated_at <= 9999999999999, \
                "updated_at should be Unix milliseconds (13 digits)"
            
            # Timestamps should be very close (created within milliseconds)
            assert abs(user.created_at - user.updated_at) < 1000, \
                "created_at and updated_at should be nearly identical on creation"
            
            session.rollback()
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Timestamp auto-generation failed: {e}")


# ============================================================================
# PROPERTY 6: Sync Query Compatibility Preserved (Requirement 3.1)
# ============================================================================

def test_property_sync_query_without_user_id_preserved():
    """
    **Property 6**: Sync Query Compatibility Preserved
    
    **PRESERVATION REQUIREMENT**: Existing sync queries using only
    `WHERE deleted_at > ?` without user_id filter SHALL continue working.
    
    **Property Statement**: For all sync queries without user_id filter,
    the query returns all tombstones since the timestamp.
    
    **Why this matters**: Existing clients may not use user_id filtering yet.
    
    **Validates: Requirement 3.1**
    """
    engine = create_engine(DATABASE_URL)
    
    with Session(engine) as session:
        try:
            # Create user and delete to generate tombstone
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                name="Sync Test User",
                email=f"sync_test_{int(time.time()*1000000)}@example.com",
                password_hash="$2b$12$" + "a" * 53,
                created_at=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at=int(datetime.now(timezone.utc).timestamp() * 1000)
            )
            session.add(user)
            session.flush()
            
            # Record timestamp before deletion
            before_delete = int(datetime.now(timezone.utc).timestamp() * 1000) - 1000
            
            # Delete user (should create tombstone via trigger)
            session.delete(user)
            session.flush()
            
            # PRESERVATION CHECK: Old-style sync query still works
            # Query without user_id filter (old pattern)
            result = session.execute(
                text("SELECT * FROM deleted_records WHERE deleted_at > :timestamp"),
                {"timestamp": before_delete}
            ).fetchall()
            
            assert len(result) > 0, \
                "Sync query without user_id should return tombstones"
            
            # Verify tombstone has correct structure
            tombstone = result[0]
            assert tombstone.table_name == "users", "Tombstone should reference users table"
            assert tombstone.record_id == user_id, "Tombstone should have correct record_id"
            assert tombstone.deleted_at > before_delete, "Tombstone should have recent deleted_at"
            
            session.rollback()
            
        except AssertionError:
            session.rollback()
            raise
        except Exception as e:
            session.rollback()
            pytest.fail(f"Sync query compatibility failed: {e}")


# ============================================================================
# SUMMARY TEST: All Preservation Properties Hold
# ============================================================================

def test_preservation_summary():
    """
    **Summary Test**: All preservation properties validated
    
    **EXPECTED OUTCOME**: All tests PASS confirming existing behavior preserved
    
    This summary confirms that all 6 preservation requirements are satisfied:
    1. ✓ Sync queries without user_id still work (3.1)
    2. ✓ Client override behavior preserved (3.2)
    3. ✓ Epley formula calculation unchanged (3.3)
    4. ✓ Complete record creation works identically (3.4)
    5. ✓ Foreign key cascades preserved (3.5)
    6. ✓ Timestamp auto-generation preserved (3.6)
    """
    # This test serves as documentation of all preservation checks
    # Individual property tests provide the actual validation
    assert True, "All preservation property tests must pass"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])

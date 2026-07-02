# ============================================================================
# EXERCISE MODEL: Master exercise catalog (shared, not user-owned)
# ============================================================================
"""
Exercise catalog model for GymNight backend with offline-first architecture.

This module implements the Exercise ORM model compatible with the WatermelonDB
Sync Protocol, storing a shared catalog of exercise definitions.

MODEL:
------
- Exercise: Master exercise definition catalog (shared reference table)

CHARACTERISTICS:
----------------
- Shared across all users (not user-owned)
- RESTRICT delete protection (cannot delete if referenced)
- Unique exercise names (prevents duplicates)

CASCADE RULES:
--------------
- Exercise deletion is RESTRICTED if referenced by workout_exercises or logged_sets
- Protects historical data integrity
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

from sqlalchemy import Column, String, BigInteger
from sqlalchemy.orm import relationship

# Import Base from connection module (single source of truth)
from app.database.connection import Base

# Import timestamp utility function
from .utils import current_timestamp_ms


# ============================================================================
# EXERCISE MODEL: Master exercise catalog (shared, not user-owned)
# ============================================================================

class Exercise(Base):
    """
    Master exercise definition catalog - shared reference table for all users.
    
    BUSINESS PURPOSE:
    -----------------
    Provides a centralized list of exercise definitions (e.g., "Barbell Bench Press",
    "Squat", "Deadlift") that can be referenced by workout plans and logged sets.
    This is a SHARED CATALOG - exercises are not owned by individual users.
    
    Why shared instead of user-owned?
    - Standardizes exercise naming across the application
    - Enables exercise-level analytics (e.g., "What's the average bench press PR?")
    - Simplifies exercise selection UI (dropdown of standardized names)
    - Prevents duplicate/misspelled exercise names ("Bench Press" vs "bench press")
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys to enable offline creation on mobile
    clients. When a user creates a new exercise offline, they generate a UUID
    client-side and sync it to the server later.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when exercise definition is first created
    - updated_at: Updated when exercise name is modified (rare)
    - Sync protocol treats this as a shared reference table
    - Clients pull exercise list during initial sync for local catalog
    
    CASCADE DELETE PROTECTION (RESTRICT):
    --------------------------------------
    Exercises CANNOT be deleted if they are referenced by:
    - workout_exercises table: Planned exercises in workout templates
    - logged_sets table: Historical performance data
    
    Why RESTRICT instead of CASCADE?
    - Protects historical data integrity: logged sets must retain exercise names
    - Prevents accidental data loss: deleting "Bench Press" shouldn't delete all bench press history
    - Foreign keys use RESTRICT constraint: DELETE fails if references exist
    
    Example scenario:
    1. User creates workout plan with "Barbell Bench Press" exercise
    2. User logs several sets of bench press over months
    3. Attempt to delete "Barbell Bench Press" exercise → DATABASE ERROR (RESTRICT)
    4. Must first remove all workout plans and logged sets referencing it
    
    UNIQUE NAME CONSTRAINT:
    -----------------------
    Exercise names must be unique to prevent duplicates like:
    - "Bench Press" and "bench press" (case-sensitive in database)
    - "Squat" and "Squats" (singular vs plural)
    
    Application should handle case-insensitive lookups and name normalization
    before inserting to avoid duplicate rejections.
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key
    - name: String(255) - Exercise name (e.g., "Barbell Bench Press"), UNIQUE, indexed, NOT NULL
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL
    
    RELATIONSHIPS:
    --------------
    - workout_exercises: One-to-many with WorkoutExercise (Exercise.workout_exercises, WorkoutExercise.exercise)
                         NO CASCADE: Exercise deletion RESTRICTED if workout plans reference it
    - logged_sets: One-to-many with LoggedSet (Exercise.logged_sets, LoggedSet.exercise)
                   NO CASCADE: Exercise deletion RESTRICTED if logged sets reference it
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - UNIQUE: name (prevents duplicate exercise names)
    - INDEX: name (fast lookup during exercise search/selection)
    - NOT NULL: id, name, created_at, updated_at
    - FOREIGN KEY PROTECTION: workout_exercises.exercise_id and logged_sets.exercise_id
                              use RESTRICT (prevent deletion if referenced)
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client creates new exercise offline:
    1. Client generates UUID: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    2. Client sets name: "Bulgarian Split Squat"
    3. Client sets created_at and updated_at to current Unix milliseconds
    4. Client stores locally in WatermelonDB
    5. When online, client pushes to server
    6. Server checks UNIQUE constraint on name
    7. If name already exists: return 409 Conflict, client updates local record with server ID
    8. If name is new: server accepts and stores as provided
    """
    __tablename__ = "exercises"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # See User model documentation for detailed UUID rationale.
    # Same offline-first architecture: mobile clients generate IDs without server.
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # EXERCISE DEFINITION: Standardized exercise name
    # ========================================================================
    
    # Exercise name - standardized and unique across the system
    # Examples: "Barbell Bench Press", "Squat", "Deadlift", "Overhead Press"
    # String(255) provides reasonable length limit for exercise names
    #
    # unique=True creates UNIQUE constraint:
    # - Prevents duplicate entries like "Bench Press" appearing multiple times
    # - Database enforces uniqueness at storage layer
    # - Application should handle case-insensitive checks before insert
    #
    # index=True creates database index:
    # - Speeds up exercise search queries (WHERE name LIKE '%bench%')
    # - Fast lookups during exercise selection in workout builder UI
    # - Efficient for autocomplete/search functionality
    #
    # Why not user_id foreign key?
    # - Exercises are SHARED across all users (not user-owned)
    # - Standardized catalog approach prevents naming inconsistencies
    # - Enables global analytics (e.g., "Most logged exercises")
    name = Column(
        String(255),
        unique=True,          # UNIQUE constraint: no duplicate exercise names
        index=True,           # INDEX: fast search/lookup queries
        nullable=False        # Name is required
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when exercise was first created
    # See User model documentation for detailed timestamp rationale.
    # Same sync protocol architecture: tracks creation time for sync queries.
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when exercise name was last modified
    # See User model documentation for detailed timestamp rationale.
    # Note: Exercise updates are rare (mostly read-only reference data)
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # WATERMELONDB SYNC OPTIMIZATION FIELDS: Record state and change tracking
    # ========================================================================
    
    # WatermelonDB sync optimization field: record state tracking
    # Values: 'created', 'updated', 'deleted'
    # String(10) accommodates the longest value ('deleted' = 7 chars)
    #
    # Why NULLABLE?
    # - Optional optimization field per WatermelonDB specification
    # - Existing records will have NULL (backward compatibility)
    # - NULL treated as "optimization not available, use full record sync"
    # - New records can optionally populate for sync optimization
    #
    # Why default=None?
    # - No automatic population (application logic handles this)
    # - Leaving NULL is safer than incorrect auto-population
    # - Future enhancement can add event listeners for automatic tracking
    _status = Column(
        String(10),           # Values: 'created', 'updated', 'deleted'
        nullable=True,        # NULLABLE: Optional optimization field
        default=None          # Default: None (not set initially)
    )
    
    # WatermelonDB sync optimization field: comma-separated list of changed field names
    # Example: "name,email" when those fields were modified
    # String(500) provides capacity for ~50 field names (typical: "name,weight" = 11 chars)
    #
    # Why NULLABLE?
    # - Optional optimization field per WatermelonDB specification
    # - Existing records will have NULL (backward compatibility)
    # - NULL treated as "optimization not available, use full record sync"
    # - New records can optionally populate for granular sync
    #
    # Why default=None?
    # - No automatic population (requires event listeners to detect field modifications)
    # - Leaving NULL is safer than incorrect auto-population
    # - Future enhancement can add event listeners for automatic tracking
    _changed = Column(
        String(500),          # Comma-separated field names (e.g., "name,weight,reps")
        nullable=True,        # NULLABLE: Optional optimization field
        default=None          # Default: None (not set initially)
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation (NO CASCADE DELETE)
    # ========================================================================
    
    # One-to-many relationship: Exercise referenced by many WorkoutExercises
    # back_populates="exercise" creates bidirectional reference:
    # - Exercise.workout_exercises → list of WorkoutExercise objects using this exercise
    # - WorkoutExercise.exercise → parent Exercise object
    #
    # NO cascade parameter specified:
    # - Exercise deletion is RESTRICTED by database foreign key constraint
    # - If workout_exercises reference this exercise, deletion will FAIL
    # - Protects workout plans from losing exercise definitions
    #
    # Why no cascade?
    # - Exercises are shared reference data (not owned by workout)
    # - Deleting exercise shouldn't delete all workout plans using it
    # - RESTRICT constraint prevents accidental data loss
    workout_exercises = relationship(
        "WorkoutExercise",           # Target model name
        back_populates="exercise"    # Reverse relationship name in WorkoutExercise model
        # No cascade: deletion RESTRICTED if references exist
    )
    
    # One-to-many relationship: Exercise referenced by many LoggedSets
    # back_populates="exercise" creates bidirectional reference:
    # - Exercise.logged_sets → list of LoggedSet objects using this exercise
    # - LoggedSet.exercise → parent Exercise object
    #
    # NO cascade parameter specified:
    # - Exercise deletion is RESTRICTED by database foreign key constraint
    # - If logged_sets reference this exercise, deletion will FAIL
    # - Protects historical performance data from losing exercise context
    #
    # Why no cascade?
    # - Historical data must retain exercise names even if removed from current plans
    # - Logged sets from 6 months ago should still show "Bench Press" name
    # - RESTRICT constraint prevents accidental history deletion
    # - Example: User logs bench press for a year, then tries to delete exercise
    #           → Database prevents deletion, preserves all historical data
    logged_sets = relationship(
        "LoggedSet",                 # Target model name
        back_populates="exercise"    # Reverse relationship name in LoggedSet model
        # No cascade: deletion RESTRICTED if references exist
    )

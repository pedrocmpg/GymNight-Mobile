# ============================================================================
# OFFLINE-FIRST DATABASE MODELS FOR WATERMELONDB SYNC PROTOCOL
# ============================================================================
"""
SQLAlchemy ORM models for GymNight backend with offline-first architecture.

ARCHITECTURAL OVERVIEW:
-----------------------
This module implements database models compatible with the WatermelonDB Sync
Protocol, enabling reliable bidirectional synchronization between mobile clients
and the PostgreSQL backend. The architecture supports offline-first mobile apps
where users can create, modify, and delete data while disconnected, then sync
changes when connectivity is restored.

KEY ARCHITECTURAL DECISIONS:

1. UUID STRING PRIMARY KEYS (String(36) instead of Integer auto-increment):
   - Mobile clients can generate valid UUIDs offline without server coordination
   - Eliminates the need for temporary IDs and ID remapping after sync
   - Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
   - Uses String type instead of PostgreSQL UUID type for broader compatibility

2. UNIX MILLISECOND TIMESTAMPS (BigInteger instead of DateTime defaults):
   - created_at: Timestamp when record was first created (Unix ms)
   - updated_at: Timestamp when record was last modified (Unix ms)
   - Sync protocol uses updated_at to identify changes since last sync
   - Format: 1234567890000 (13-digit integer representing milliseconds since epoch)
   - Allows efficient querying: SELECT * WHERE updated_at > last_sync_timestamp

3. TOMBSTONE DELETION TRACKING (deleted_records table):
   - Soft deletion architecture where deletes create tombstone records
   - Mobile clients need to know which records were deleted while offline
   - deleted_records table stores: table_name, record_id, deleted_at timestamp
   - During sync, server sends list of deleted record IDs for client cleanup

4. BIDIRECTIONAL RELATIONSHIPS (back_populates configuration):
   - All relationships use back_populates for two-way navigation
   - Example: User.workouts and Workout.user both accessible
   - Simplifies application code and ORM query patterns

5. CASCADE DELETE RULES:
   - User deletion → cascades to workouts and workout_sessions (orphan cleanup)
   - Workout deletion → cascades to workout_exercises (plan cleanup)
   - WorkoutSession deletion → cascades to logged_sets (session cleanup)
   - Exercise deletion → RESTRICTED (preserves historical data integrity)

SYNC PROTOCOL WORKFLOW:

Client Push (offline changes to server):
1. Client collects all local changes where updated_at > last_push_timestamp
2. Client sends created/modified records with their client-generated UUIDs
3. Server validates and inserts/updates records, preserving client timestamps
4. Server returns success confirmation with server timestamp

Client Pull (server changes to offline client):
1. Client sends last_pulled_at timestamp from previous sync
2. Server queries: SELECT * WHERE updated_at > last_pulled_at
3. Server queries: SELECT * FROM deleted_records WHERE deleted_at > last_pulled_at
4. Server sends modified records and deletion list to client
5. Client applies changes and stores new last_pulled_at timestamp

DATA MODEL STRUCTURE:

Core Entities:
- User: User accounts with authentication credentials
- Exercise: Master list of exercise definitions (shared, not user-owned)
- Workout: Workout templates with planned exercises and targets (user-owned plans)
- WorkoutExercise: Planned exercises within a workout template (what SHOULD be done)
- WorkoutSession: Actual workout instances with timer tracking (what WAS done)
- LoggedSet: Completed exercise sets with performance data and one-RM calculation
- DeletedRecord: Tombstone tracking table for sync protocol

Separation of Planning vs Execution:
- Workouts = Templates/Plans (what you plan to do)
- WorkoutSessions = Actual instances (when you did it)
- LoggedSets = Real performance data (what you actually achieved)

MODULES:
--------
- Column, String, Integer, Float, BigInteger, DateTime, ForeignKey: SQLAlchemy column types
- Index: Database index creation
- event, DDL: SQLAlchemy event system for database triggers
- relationship, validates: ORM relationship mapping and field validation
- time: Unix millisecond timestamp generation
- Base: Declarative base class from app.database.connection

REQUIREMENTS VALIDATION:
------------------------
This implementation satisfies requirements 1.1, 2.1, 2.2, and 2.3 from the
offline-first database rebuild specification:
- 1.1: UUID primary keys for all tables
- 2.1: created_at sync timestamp columns
- 2.2: updated_at sync timestamp columns with automatic updates
- 2.3: BigInteger Unix millisecond timestamp storage
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

# Core SQLAlchemy column types for PostgreSQL compatibility
from sqlalchemy import (
    Column,        # Base class for table columns
    String,        # VARCHAR type for text fields and UUIDs
    Integer,       # INT type for counts and discrete values
    Float,         # FLOAT type for weights and measurements
    BigInteger,    # BIGINT type for Unix millisecond timestamps
    DateTime,      # TIMESTAMP type for datetime fields
    ForeignKey,    # Foreign key constraint definition
    Index,         # Database index creation
    event,         # Event system for triggers and hooks
)

# SQLAlchemy schema utilities for advanced database operations
from sqlalchemy.schema import (
    DDL,           # Data Definition Language for custom SQL
)

# SQLAlchemy ORM relationship and validation utilities
from sqlalchemy.orm import (
    relationship,  # Define relationships between models
    validates,     # Field validation decorators
)

# Python standard library: time module for Unix millisecond timestamp generation
import time

# Application-specific imports: declarative base for ORM models
from app.database.connection import Base


# ============================================================================
# HELPER FUNCTIONS: Timestamp generation for sync protocol
# ============================================================================

def current_timestamp_ms() -> int:
    """
    Generate current Unix timestamp in milliseconds for sync protocol.
    
    Returns the number of milliseconds since Unix epoch (January 1, 1970 UTC).
    This format is required by the WatermelonDB Sync Protocol for tracking
    record creation and modification times.
    
    Why milliseconds instead of seconds?
    - Provides higher precision for conflict resolution in sync scenarios
    - Standard format used by JavaScript Date.now() on mobile clients
    - Allows detecting changes that occur within the same second
    
    Example return value: 1234567890000 (represents a specific moment in 2009)
    
    Returns:
        int: Current Unix timestamp in milliseconds (13-digit integer)
    
    Usage:
        created_at = Column(BigInteger, default=current_timestamp_ms)
        # When record is created, this function is called automatically
    
    Technical implementation:
        time.time() returns seconds since epoch as float: 1234567890.123
        Multiply by 1000 to get milliseconds: 1234567890123.456
        Cast to int to truncate decimal: 1234567890123
    """
    return int(time.time() * 1000)


# ============================================================================
# USER MODEL: User accounts with authentication and sync support
# ============================================================================

class User(Base):
    """
    User account model with profile information and authentication credentials.
    
    BUSINESS PURPOSE:
    -----------------
    Stores user accounts for the GymNight application. Each user owns workout
    templates (workouts table) and workout sessions (workout_sessions table).
    User deletion cascades to all owned records to maintain data integrity.
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys (not integer auto-increment) to
    enable offline record creation on mobile clients without server coordination.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when record is first created (Unix milliseconds)
    - updated_at: Automatically updated on every modification (Unix milliseconds)
    - Sync protocol uses updated_at to identify records modified since last sync
    - Client can provide created_at/updated_at explicitly for offline-created records
    
    CASCADE DELETE RULES:
    ---------------------
    When a user is deleted, ALL owned records are automatically deleted:
    - workouts table: All workout templates owned by this user (CASCADE)
    - workout_sessions table: All workout sessions performed by this user (CASCADE)
    - logged_sets table: Indirectly deleted via workout_sessions CASCADE (CASCADE chain)
    
    This ensures no orphaned records remain after user account deletion.
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key (e.g., "550e8400-e29b-41d4-a716-446655440000")
    - name: String(255) - User's full name, NOT NULL
    - email: String(255) - Unique email for authentication, indexed for fast login queries, NOT NULL
    - password_hash: String(255) - Bcrypt hashed password (NEVER store plaintext), NOT NULL
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL, auto-generated if not provided
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL, auto-updated on changes
    
    RELATIONSHIPS:
    --------------
    - workouts: One-to-many with Workout model (User.workouts, Workout.user)
                CASCADE: When user deleted, all workouts are deleted
    - workout_sessions: One-to-many with WorkoutSession model (User.workout_sessions, WorkoutSession.user)
                        CASCADE: When user deleted, all workout sessions are deleted
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - UNIQUE: email (prevents duplicate accounts)
    - INDEX: email (fast lookup during login)
    - NOT NULL: id, name, email, password_hash, created_at, updated_at
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client creates user offline:
    1. Client generates UUID: "550e8400-e29b-41d4-a716-446655440000"
    2. Client sets created_at and updated_at to current Unix milliseconds
    3. Client stores locally in WatermelonDB
    4. When online, client pushes to server with client-generated ID and timestamps
    5. Server accepts and stores exactly as provided (no ID remapping needed)
    """
    __tablename__ = "users"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # Why String(36) instead of Integer auto-increment?
    # - Mobile clients can generate valid UUIDs offline using standard libraries
    # - No server roundtrip needed to get an ID during offline creation
    # - No temporary ID or ID remapping logic required
    # - Format: "550e8400-e29b-41d4-a716-446655440000" (36 chars with hyphens)
    #
    # Why String instead of PostgreSQL UUID type?
    # - Broader database compatibility (works on SQLite for testing)
    # - Simpler JSON serialization (no custom type handling)
    # - WatermelonDB uses string IDs, so direct compatibility
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # USER PROFILE FIELDS: Basic account information
    # ========================================================================
    
    # User's full name (e.g., "Alice Johnson")
    # String(255) provides reasonable length limit (255 characters)
    name = Column(
        String(255),
        nullable=False        # Name is required
    )
    
    # User's email address for authentication
    # unique=True creates UNIQUE constraint (no duplicate emails allowed)
    # index=True creates database index for fast lookup during login queries
    # Example: "alice@example.com"
    email = Column(
        String(255),
        unique=True,          # UNIQUE constraint: prevents duplicate accounts
        index=True,           # INDEX: speeds up WHERE email='...' queries
        nullable=False        # Email is required
    )
    
    # Bcrypt hashed password for secure authentication
    # NEVER store plaintext passwords - always use bcrypt.hashpw()
    # Example hash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOeCh4S/KKbqYHqN9xG7rT3..."
    # String(255) accommodates bcrypt hash length (typically 60 chars)
    password_hash = Column(
        String(255),
        nullable=False        # Password hash is required
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when record was first created
    # Example: 1234567890000 (represents a specific moment in 2009)
    # Format: 13-digit integer (milliseconds since Unix epoch)
    #
    # Why BigInteger instead of DateTime?
    # - WatermelonDB uses Unix milliseconds (JavaScript Date.now())
    # - Simpler comparison logic: updated_at > last_sync_timestamp
    # - No timezone conversion issues (always UTC)
    # - Efficient for sync queries (integer comparison faster than datetime)
    #
    # Why default=current_timestamp_ms?
    # - Automatically sets timestamp when record created on server
    # - Client can override by providing explicit value for offline creation
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when record was last modified
    # Automatically updated on every change via onupdate parameter
    # Sync protocol queries: SELECT * WHERE updated_at > last_pulled_at
    #
    # Why onupdate=current_timestamp_ms?
    # - SQLAlchemy automatically updates this field on every modification
    # - Enables incremental sync (only pull changes since last sync)
    # - Client can override for conflict resolution scenarios
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation
    # ========================================================================
    
    # One-to-many relationship: User has many Workouts (workout templates)
    # back_populates="user" creates bidirectional reference:
    # - User.workouts → list of Workout objects
    # - Workout.user → parent User object
    #
    # cascade="all, delete-orphan" means:
    # - "all": When user deleted, delete all related workouts (CASCADE DELETE)
    # - "delete-orphan": When workout removed from user.workouts, delete it from DB
    #
    # Why cascade delete?
    # - Workouts are owned by users (not shared)
    # - Orphaned workouts have no meaning without their owner
    # - Automatic cleanup prevents database pollution
    workouts = relationship(
        "Workout",                   # Target model name (as string for forward reference)
        back_populates="user",       # Reverse relationship name in Workout model
        cascade="all, delete-orphan" # Delete workouts when user deleted
    )
    
    # One-to-many relationship: User has many WorkoutSessions (actual workouts performed)
    # back_populates="user" creates bidirectional reference:
    # - User.workout_sessions → list of WorkoutSession objects
    # - WorkoutSession.user → parent User object
    #
    # cascade="all, delete-orphan" means:
    # - When user deleted, all their workout sessions are deleted (CASCADE)
    # - This also cascades to logged_sets (via WorkoutSession.logged_sets cascade)
    #
    # Why cascade delete?
    # - Workout sessions belong to users (not shared across accounts)
    # - Historical workout data has no meaning after account deletion
    # - Automatic cleanup of entire user history
    workout_sessions = relationship(
        "WorkoutSession",            # Target model name
        back_populates="user",       # Reverse relationship name in WorkoutSession model
        cascade="all, delete-orphan" # Delete sessions when user deleted
    )


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


# ============================================================================
# WORKOUT MODEL: Workout templates (planning structure, not actual sessions)
# ============================================================================

class Workout(Base):
    """
    Workout template model - defines planned workouts with exercise structure.
    
    BUSINESS PURPOSE:
    -----------------
    Stores workout TEMPLATES (also called workout "plans") that define the structure
    of a planned workout. This is NOT an actual workout session - it's the PLAN
    for what exercises should be performed.
    
    Example: A "Push Day A" workout template might specify:
    - Barbell Bench Press: 4 sets x 8 reps @ 80kg
    - Overhead Press: 3 sets x 10 reps @ 50kg
    - Tricep Dips: 3 sets x 12 reps @ bodyweight
    
    When a user actually performs this workout, a WorkoutSession record is created
    that references this template, and LoggedSet records track actual performance.
    
    Separation of concerns:
    - Workout (this model): Template/Plan (what SHOULD be done)
    - WorkoutSession: Actual instance (what WAS done, when, and duration)
    - LoggedSet: Real performance (actual weight/reps achieved)
    
    USER OWNERSHIP:
    ---------------
    Workouts are OWNED by users (not shared like exercises). Each user creates
    their own workout templates tailored to their training program.
    
    Foreign key: workout.user_id → users.id with CASCADE DELETE
    - When user deleted, all their workouts are automatically deleted
    - Orphaned workout templates have no meaning without their owner
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys to enable offline creation on mobile
    clients. When a user creates a new workout plan offline, they generate a UUID
    client-side and sync it to the server later.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when workout template is first created
    - updated_at: Updated when workout is modified (name changed, exercises added/removed)
    - Sync protocol uses updated_at to identify templates modified since last sync
    - Client can provide created_at/updated_at explicitly for offline-created templates
    
    CASCADE DELETE RULES:
    ---------------------
    CASCADE TO workout_exercises (cleanup):
    - When workout deleted, all associated workout_exercises are deleted (CASCADE)
    - Rationale: Planned exercises have no meaning without their parent workout
    - Example: Delete "Push Day A" → also delete all planned exercises in that template
    
    SET NULL for workout_sessions (preserve history):
    - When workout deleted, workout_sessions.workout_id is set to NULL (not deleted)
    - Rationale: Historical workout sessions should be preserved even if template deleted
    - Example: User deletes "Push Day A" template, but past sessions remain in history
    - User can still see they did a workout on 2024-01-15, just no longer linked to template
    
    CASCADE FROM users (ownership):
    - When user deleted, all their workouts are deleted (CASCADE)
    - Rationale: Workout templates belong to users, orphaned templates have no meaning
    - Example: Delete user account → all their workout plans are removed
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key
    - user_id: String(36) - Foreign key to users.id, CASCADE on delete, NOT NULL
    - name: String(255) - Workout template name (e.g., "Push Day A"), NOT NULL
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL
    
    RELATIONSHIPS:
    --------------
    - user: Many-to-one with User (Workout.user, User.workouts)
            CASCADE FROM: When user deleted, workout is deleted
    - workout_exercises: One-to-many with WorkoutExercise (Workout.workout_exercises, WorkoutExercise.workout)
                        CASCADE TO: When workout deleted, all workout_exercises are deleted
    - workout_sessions: One-to-many with WorkoutSession (Workout.workout_sessions, WorkoutSession.workout)
                       SET NULL: When workout deleted, workout_sessions.workout_id becomes NULL (history preserved)
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - FOREIGN KEY: user_id references users.id ON DELETE CASCADE
    - NOT NULL: id, user_id, name, created_at, updated_at
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client creates workout template offline:
    1. Client generates UUID: "w1b2c3d4-e5f6-7890-abcd-ef1234567890"
    2. Client sets user_id (must already exist or be created in same sync batch)
    3. Client sets name: "Push Day A"
    4. Client sets created_at and updated_at to current Unix milliseconds
    5. Client stores locally in WatermelonDB
    6. Client creates associated workout_exercises records
    7. When online, client pushes workout and workout_exercises in dependency order
    8. Server validates user_id exists (foreign key constraint)
    9. Server accepts and stores as provided
    """
    __tablename__ = "workouts"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # See User model documentation for detailed UUID rationale.
    # Same offline-first architecture: mobile clients generate IDs without server.
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # FOREIGN KEY: User ownership (CASCADE DELETE from users)
    # ========================================================================
    
    # Foreign key to users.id - establishes workout ownership by user
    # String(36) matches User.id type (UUID string format)
    #
    # ForeignKey('users.id', ondelete='CASCADE') means:
    # - References the id column in the users table
    # - ondelete='CASCADE': When referenced user is deleted, this workout is deleted too
    #
    # Why CASCADE from users?
    # - Workouts are owned by users (not shared across accounts)
    # - Orphaned workouts without owner have no meaning or access path
    # - Automatic cleanup prevents database pollution
    # - Example: User deletes account → all their workout templates removed
    #
    # Why nullable=False?
    # - Every workout MUST have an owner
    # - Cannot create workout without valid user_id
    # - Enforced at both application and database level
    user_id = Column(
        String(36),                              # UUID string format matching User.id
        ForeignKey('users.id', ondelete='CASCADE'),  # Reference users.id, CASCADE delete
        nullable=False                           # Owner is required
    )
    
    # ========================================================================
    # WORKOUT TEMPLATE INFORMATION: Name and description
    # ========================================================================
    
    # Workout template name - user-defined descriptive name for the workout plan
    # Examples: "Push Day A", "Leg Day", "Upper Body", "5x5 Stronglifts"
    # String(255) provides reasonable length limit for workout names
    #
    # Why NOT unique?
    # - Users might want multiple versions: "Push Day A", "Push Day B"
    # - Same user might have "Leg Day" and later "Leg Day (Modified)"
    # - Different users can have same workout names (user-scoped, not global)
    #
    # Why nullable=False?
    # - Workout templates need names for user recognition in UI
    # - Unnamed workouts would be confusing in workout selection dropdown
    name = Column(
        String(255),
        nullable=False        # Name is required
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when workout template was first created
    # See User model documentation for detailed timestamp rationale.
    # Same sync protocol architecture: tracks creation time for sync queries.
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when workout template was last modified
    # See User model documentation for detailed timestamp rationale.
    # Updates when: name changed, workout_exercises added/removed
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation with cascade rules
    # ========================================================================
    
    # Many-to-one relationship: Workout belongs to one User
    # back_populates="workouts" creates bidirectional reference:
    # - Workout.user → parent User object (who owns this workout)
    # - User.workouts → list of Workout objects (all templates owned by user)
    #
    # NO cascade parameter here:
    # - Cascade is defined on the PARENT side (User.workouts has cascade)
    # - This is the child side, just references parent
    # - CASCADE DELETE configured in users.id foreign key (ondelete='CASCADE')
    user = relationship(
        "User",                      # Target model name
        back_populates="workouts"    # Reverse relationship name in User model
    )
    
    # One-to-many relationship: Workout has many WorkoutExercises (planned exercises)
    # back_populates="workout" creates bidirectional reference:
    # - Workout.workout_exercises → list of WorkoutExercise objects (planned exercises in this template)
    # - WorkoutExercise.workout → parent Workout object (which template this exercise belongs to)
    #
    # cascade="all, delete-orphan" means:
    # - "all": When workout deleted, delete all related workout_exercises (CASCADE DELETE)
    # - "delete-orphan": When workout_exercise removed from workout.workout_exercises, delete it from DB
    #
    # Why cascade delete?
    # - WorkoutExercises define the content of a workout template
    # - Planned exercises have no meaning without their parent workout
    # - Automatic cleanup prevents orphaned workout_exercises
    # - Example: Delete "Push Day A" → also delete "Bench Press (4x8@80kg)" plan
    workout_exercises = relationship(
        "WorkoutExercise",           # Target model name
        back_populates="workout",    # Reverse relationship name in WorkoutExercise model
        cascade="all, delete-orphan" # Delete workout_exercises when workout deleted
    )
    
    # One-to-many relationship: Workout referenced by many WorkoutSessions (actual instances)
    # back_populates="workout" creates bidirectional reference:
    # - Workout.workout_sessions → list of WorkoutSession objects (times this template was used)
    # - WorkoutSession.workout → parent Workout object (which template was used, can be NULL)
    #
    # NO cascade delete specified:
    # - When workout deleted, workout_sessions are NOT deleted
    # - Instead, workout_sessions.workout_id is SET to NULL (configured in WorkoutSession.workout_id foreign key)
    # - Preserves historical workout session records even if template deleted
    #
    # Why no cascade?
    # - Historical data preservation: user did workout on 2024-01-15, that's a fact
    # - Template deletion shouldn't erase history of what user actually did
    # - WorkoutSession can exist independently (freestyle workouts without template)
    # - Example: User deletes "Push Day A" template, but past sessions remain in history
    #           showing they did *some* workout on various dates, just no longer linked to template
    workout_sessions = relationship(
        "WorkoutSession",            # Target model name
        back_populates="workout"     # Reverse relationship name in WorkoutSession model
        # No cascade: workout_sessions preserved, workout_id set to NULL via foreign key
    )


# ============================================================================
# WORKOUT EXERCISE MODEL: Planned exercises within workout templates
# ============================================================================

class WorkoutExercise(Base):
    """
    Workout exercise model - defines planned exercises within workout templates.
    
    BUSINESS PURPOSE:
    -----------------
    Stores the PRESCRIPTION for exercises within a workout template. This is the
    "what SHOULD be done" specification, defining target performance goals.
    
    Example: In a "Push Day A" workout template:
    - WorkoutExercise 1: Barbell Bench Press, 4 sets x 8 reps @ 80kg
    - WorkoutExercise 2: Overhead Press, 3 sets x 10 reps @ 50kg
    - WorkoutExercise 3: Tricep Dips, 3 sets x 12 reps @ bodyweight
    
    This is NOT actual performance data - it's the planned/target values.
    
    Separation of planning vs execution:
    - WorkoutExercise (this model): PLANNED performance (prescription, target)
    - LoggedSet: ACTUAL performance (what was really achieved during workout)
    
    Example workflow:
    1. User creates workout template "Push Day A"
    2. User adds WorkoutExercise: Bench Press, target 4 sets x 8 reps @ 80kg
    3. User starts workout session based on "Push Day A" template
    4. User completes sets and creates LoggedSet records with actual performance:
       - Set 1: 80kg x 8 reps (matched target)
       - Set 2: 80kg x 7 reps (fell short)
       - Set 3: 77.5kg x 8 reps (reduced weight to hit reps)
       - Set 4: 77.5kg x 8 reps (matched adjusted target)
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys to enable offline creation on mobile
    clients. When a user adds exercises to a workout template offline, they generate
    UUIDs client-side and sync them to the server later.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when exercise is first added to workout template
    - updated_at: Updated when targets are modified (sets/reps/weight changed)
    - Sync protocol uses updated_at to identify exercises modified since last sync
    - Client can provide created_at/updated_at explicitly for offline-created exercises
    
    CASCADE DELETE RULES:
    ---------------------
    CASCADE FROM workouts (cleanup):
    - When workout deleted, all associated workout_exercises are deleted (CASCADE)
    - Rationale: Planned exercises have no meaning without their parent workout
    - Example: Delete "Push Day A" template → also delete all planned exercises
    
    RESTRICT ON exercises (protect catalog):
    - Exercise catalog entries CANNOT be deleted if referenced by workout_exercises
    - Rationale: Protects workout templates from losing exercise definitions
    - Example: Attempt to delete "Bench Press" exercise → FAILS if any workout plans use it
    - Foreign key uses RESTRICT constraint: DELETE fails if references exist
    
    TARGET COLUMNS:
    ---------------
    - series_target: Target number of SETS (e.g., 4 sets of bench press)
    - reps_target: Target number of REPETITIONS per set (e.g., 8 reps per set)
    - weight_target: Target weight in kilograms (e.g., 80kg)
    
    Why "series" instead of "sets"?
    - Terminology: "Series" is sometimes used in training literature
    - Avoids Python keyword conflict (though "sets" isn't a keyword)
    - Matches some European training terminology
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key
    - workout_id: String(36) - Foreign key to workouts.id, CASCADE on delete, NOT NULL
    - exercise_id: String(36) - Foreign key to exercises.id, RESTRICT on delete, NOT NULL
    - series_target: Integer - Target number of sets, NOT NULL
    - reps_target: Integer - Target repetitions per set, NOT NULL
    - weight_target: Float - Target weight in kg, NOT NULL
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL
    
    RELATIONSHIPS:
    --------------
    - workout: Many-to-one with Workout (WorkoutExercise.workout, Workout.workout_exercises)
               CASCADE FROM: When workout deleted, workout_exercise is deleted
    - exercise: Many-to-one with Exercise (WorkoutExercise.exercise, Exercise.workout_exercises)
                RESTRICT: Exercise cannot be deleted if workout_exercises reference it
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - FOREIGN KEY: workout_id references workouts.id ON DELETE CASCADE
    - FOREIGN KEY: exercise_id references exercises.id ON DELETE RESTRICT
    - NOT NULL: id, workout_id, exercise_id, series_target, reps_target, weight_target, created_at, updated_at
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client creates workout exercise offline:
    1. Client generates UUID: "we123456-e5f6-7890-abcd-ef1234567890"
    2. Client sets workout_id (must already exist or be created in same sync batch)
    3. Client sets exercise_id (must already exist in exercises catalog)
    4. Client sets targets: series_target=4, reps_target=8, weight_target=80.0
    5. Client sets created_at and updated_at to current Unix milliseconds
    6. Client stores locally in WatermelonDB
    7. When online, client pushes workout_exercise
    8. Server validates workout_id and exercise_id exist (foreign key constraints)
    9. Server accepts and stores as provided
    """
    __tablename__ = "workout_exercises"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # See User model documentation for detailed UUID rationale.
    # Same offline-first architecture: mobile clients generate IDs without server.
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # FOREIGN KEY: Workout ownership (CASCADE DELETE from workouts)
    # ========================================================================
    
    # Foreign key to workouts.id - establishes which workout template this exercise belongs to
    # String(36) matches Workout.id type (UUID string format)
    #
    # ForeignKey('workouts.id', ondelete='CASCADE') means:
    # - References the id column in the workouts table
    # - ondelete='CASCADE': When referenced workout is deleted, this workout_exercise is deleted too
    #
    # Why CASCADE from workouts?
    # - WorkoutExercises define the content of a workout template
    # - Planned exercises have no meaning without their parent workout
    # - Automatic cleanup prevents orphaned workout_exercises
    # - Example: User deletes "Push Day A" workout → all planned exercises in it are removed
    #
    # Why nullable=False?
    # - Every workout_exercise MUST belong to a workout template
    # - Cannot create planned exercise without valid workout_id
    # - Enforced at both application and database level
    workout_id = Column(
        String(36),                                  # UUID string format matching Workout.id
        ForeignKey('workouts.id', ondelete='CASCADE'),  # Reference workouts.id, CASCADE delete
        nullable=False                               # Parent workout is required
    )
    
    # ========================================================================
    # FOREIGN KEY: Exercise reference (RESTRICT DELETE from exercises)
    # ========================================================================
    
    # Foreign key to exercises.id - references which exercise to perform
    # String(36) matches Exercise.id type (UUID string format)
    #
    # ForeignKey('exercises.id', ondelete='RESTRICT') means:
    # - References the id column in the exercises table
    # - ondelete='RESTRICT': Cannot delete exercise if workout_exercises reference it
    #
    # Why RESTRICT on exercises?
    # - Exercise catalog is shared reference data (not owned by workout)
    # - Protects workout templates from losing exercise definitions
    # - Prevents accidental data loss: can't delete "Bench Press" if any workout plans use it
    # - Database will raise IntegrityError if deletion attempted
    #
    # Why nullable=False?
    # - Every workout_exercise MUST reference a valid exercise
    # - Cannot create planned exercise without knowing which exercise to perform
    # - Enforced at both application and database level
    #
    # Example protection scenario:
    # 1. User creates workout plan with "Barbell Bench Press" exercise
    # 2. Admin attempts to delete "Barbell Bench Press" from exercises table
    # 3. Database raises IntegrityError: "foreign key constraint violation"
    # 4. Must first remove from all workout plans before deleting exercise
    exercise_id = Column(
        String(36),                                    # UUID string format matching Exercise.id
        ForeignKey('exercises.id', ondelete='RESTRICT'),  # Reference exercises.id, RESTRICT delete
        nullable=False                                 # Exercise reference is required
    )
    
    # ========================================================================
    # TARGET PERFORMANCE COLUMNS: Prescription for what should be done
    # ========================================================================
    
    # Target number of SETS (also called "series" in some training literature)
    # Example values: 3, 4, 5 (typically 1-10 sets per exercise)
    #
    # Why Integer (not Float)?
    # - Sets are discrete whole numbers (you can't do 3.5 sets)
    # - Integer type enforces this constraint at database level
    #
    # Why nullable=False?
    # - Every planned exercise must specify how many sets
    # - Required for workout planning and tracking
    #
    # Business logic note:
    # - Application should validate series_target >= 1
    # - Consider adding CHECK constraint: series_target > 0
    series_target = Column(
        Integer,
        nullable=False        # Target sets is required
    )
    
    # Target number of REPETITIONS per set
    # Example values: 5, 8, 10, 12 (typically 1-30 reps per set)
    #
    # Why Integer (not Float)?
    # - Repetitions are discrete whole numbers (you can't do 7.5 reps)
    # - Integer type enforces this constraint at database level
    #
    # Why nullable=False?
    # - Every planned exercise must specify target reps
    # - Required for workout planning and tracking
    #
    # Business logic note:
    # - Application should validate reps_target >= 1
    # - Consider adding CHECK constraint: reps_target > 0
    # - Different rep ranges serve different training goals:
    #   * 1-5 reps: Strength focus
    #   * 6-12 reps: Hypertrophy (muscle growth) focus
    #   * 12+ reps: Endurance focus
    reps_target = Column(
        Integer,
        nullable=False        # Target reps is required
    )
    
    # Target weight in kilograms
    # Example values: 20.0, 80.0, 100.5 (typically 0-500kg)
    #
    # Why Float (not Integer)?
    # - Weight plates come in fractional values: 2.5kg, 1.25kg, 0.5kg
    # - Users might use 77.5kg (bar + plates + microplates)
    # - Float type allows decimal precision
    #
    # Why nullable=False?
    # - Every planned exercise must specify target weight
    # - Even bodyweight exercises should specify 0.0 or actual bodyweight
    # - Required for workout planning and progression tracking
    #
    # Unit standardization:
    # - Always stored in KILOGRAMS (metric system)
    # - Application layer converts to/from pounds if needed (1kg = 2.20462lbs)
    # - Example: User in USA enters 225lbs → stored as 102.06kg
    #
    # Business logic note:
    # - Application should validate weight_target >= 0
    # - Consider adding CHECK constraint: weight_target >= 0
    # - Negative weight doesn't make physical sense
    # - Zero weight is valid for bodyweight exercises or exercises being planned
    weight_target = Column(
        Float,
        nullable=False        # Target weight is required
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when workout exercise was first added to template
    # See User model documentation for detailed timestamp rationale.
    # Same sync protocol architecture: tracks creation time for sync queries.
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when workout exercise targets were last modified
    # See User model documentation for detailed timestamp rationale.
    # Updates when: series_target, reps_target, or weight_target changed
    # Tracks progression: user might update weight_target from 80kg to 85kg (progressive overload)
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation with cascade rules
    # ========================================================================
    
    # Many-to-one relationship: WorkoutExercise belongs to one Workout
    # back_populates="workout_exercises" creates bidirectional reference:
    # - WorkoutExercise.workout → parent Workout object (which template this exercise belongs to)
    # - Workout.workout_exercises → list of WorkoutExercise objects (all planned exercises in template)
    #
    # NO cascade parameter here:
    # - Cascade is defined on the PARENT side (Workout.workout_exercises has cascade)
    # - This is the child side, just references parent
    # - CASCADE DELETE configured in workouts.id foreign key (ondelete='CASCADE')
    workout = relationship(
        "Workout",                       # Target model name
        back_populates="workout_exercises"  # Reverse relationship name in Workout model
    )
    
    # Many-to-one relationship: WorkoutExercise references one Exercise
    # back_populates="workout_exercises" creates bidirectional reference:
    # - WorkoutExercise.exercise → parent Exercise object (which exercise to perform)
    # - Exercise.workout_exercises → list of WorkoutExercise objects (all workout plans using this exercise)
    #
    # NO cascade parameter here:
    # - This is a reference relationship (not ownership)
    # - Exercise is shared catalog data (not owned by workout)
    # - RESTRICT DELETE configured in exercises.id foreign key (ondelete='RESTRICT')
    # - Protects exercises from deletion if still referenced by workout plans
    #
    # Example navigation:
    # 1. workout_exercise.exercise.name → "Barbell Bench Press"
    # 2. exercise.workout_exercises → list of all workout plans using this exercise
    exercise = relationship(
        "Exercise",                       # Target model name
        back_populates="workout_exercises"   # Reverse relationship name in Exercise model
    )


# ============================================================================
# WORKOUT SESSION MODEL: Actual workout instances with timer tracking
# ============================================================================

class WorkoutSession(Base):
    """
    Workout session model - tracks actual workout instances with timer tracking.
    
    BUSINESS PURPOSE:
    -----------------
    Stores ACTUAL workout sessions that users perform, with start/end timestamps
    for timer tracking. This is the "what WAS done" record, representing a real
    workout that occurred at a specific time.
    
    DISTINCTION FROM WORKOUT TEMPLATE:
    ----------------------------------
    - Workout (template): PLAN for what exercises should be performed
    - WorkoutSession (this model): ACTUAL instance of a workout being performed
    - LoggedSet: ACTUAL performance data for individual sets within the session
    
    Example workflow:
    1. User opens app and starts a workout session (based on "Push Day A" template)
       → WorkoutSession created with started_at timestamp, workout_id references template
    2. User completes exercises and logs sets
       → LoggedSet records created, referencing this WorkoutSession via session_id
    3. User finishes workout
       → WorkoutSession.ended_at timestamp set
    
    FREESTYLE SESSIONS (Template-Free Workouts):
    ---------------------------------------------
    workout_id is NULLABLE to support freestyle sessions not based on a template.
    
    Scenarios:
    - Template-based: workout_id references a Workout template (user followed a plan)
    - Freestyle: workout_id is NULL (user improvised exercises without following a plan)
    
    Example freestyle workflow:
    1. User opens app and starts a "quick workout" without selecting a template
       → WorkoutSession created with started_at, workout_id=NULL
    2. User logs whatever exercises they feel like doing
       → LoggedSet records created, referencing this WorkoutSession
    3. User finishes workout
       → WorkoutSession.ended_at timestamp set
    
    IN-PROGRESS SESSIONS:
    ---------------------
    ended_at is NULLABLE to represent sessions that are currently in progress.
    
    Session states:
    - In Progress: ended_at is NULL (user is currently working out)
    - Completed: ended_at is set (user finished the workout)
    
    Business logic:
    - Application can query for active sessions: WHERE ended_at IS NULL
    - Session duration calculated as: ended_at - started_at (when completed)
    - If app crashes, ended_at remains NULL (can detect abandoned sessions)
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys to enable offline creation on mobile
    clients. When a user starts a workout offline, they generate a UUID client-side
    and sync it to the server later.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when session is first created (sync timestamp in Unix ms)
    - updated_at: Updated when session is modified (ended_at set, notes added, etc.)
    - started_at: DateTime when workout began (actual workout timestamp, timezone-aware)
    - ended_at: DateTime when workout ended (actual workout timestamp, timezone-aware, nullable)
    
    Why both created_at/updated_at (BigInteger) AND started_at/ended_at (DateTime)?
    - created_at/updated_at: Sync protocol timestamps (Unix ms) for change tracking
    - started_at/ended_at: Business domain timestamps (DateTime with timezone) for workout duration
    - Different purposes: sync tracking vs. workout timing
    
    CASCADE DELETE RULES:
    ---------------------
    CASCADE FROM users (ownership):
    - When user deleted, all their workout_sessions are deleted (CASCADE)
    - Rationale: Workout sessions belong to users, orphaned sessions have no meaning
    - Example: Delete user account → all their workout history is removed
    
    SET NULL from workouts (preserve history):
    - When workout template deleted, workout_sessions.workout_id is set to NULL (not deleted)
    - Rationale: Historical workout sessions should be preserved even if template deleted
    - Example: User deletes "Push Day A" template, but past sessions remain in history
    - User can still see they did a workout on 2024-01-15, just no longer linked to template
    
    CASCADE TO logged_sets (cleanup):
    - When workout_session deleted, all associated logged_sets are deleted (CASCADE)
    - Rationale: Logged sets have no meaning without their parent session
    - Example: Delete workout session → also delete all sets logged during that session
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key
    - user_id: String(36) - Foreign key to users.id, CASCADE on delete, NOT NULL
    - workout_id: String(36) - Foreign key to workouts.id, SET NULL on delete, NULLABLE (freestyle sessions)
    - started_at: DateTime(timezone=True) - When workout session began, NOT NULL
    - ended_at: DateTime(timezone=True) - When workout session ended, NULLABLE (in-progress sessions)
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL
    
    RELATIONSHIPS:
    --------------
    - user: Many-to-one with User (WorkoutSession.user, User.workout_sessions)
            CASCADE FROM: When user deleted, workout_session is deleted
    - workout: Many-to-one with Workout (WorkoutSession.workout, Workout.workout_sessions)
               SET NULL: When workout deleted, workout_id becomes NULL (history preserved)
    - logged_sets: One-to-many with LoggedSet (WorkoutSession.logged_sets, LoggedSet.session)
                   CASCADE TO: When workout_session deleted, all logged_sets are deleted
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - FOREIGN KEY: user_id references users.id ON DELETE CASCADE
    - FOREIGN KEY: workout_id references workouts.id ON DELETE SET NULL
    - NOT NULL: id, user_id, started_at, created_at, updated_at
    - NULLABLE: workout_id (freestyle sessions), ended_at (in-progress sessions)
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client starts workout session offline:
    1. Client generates UUID: "ws123456-e5f6-7890-abcd-ef1234567890"
    2. Client sets user_id (must already exist or be created in same sync batch)
    3. Client sets workout_id (NULL for freestyle, or references a Workout template)
    4. Client sets started_at to current datetime with timezone
    5. Client leaves ended_at as NULL (session in progress)
    6. Client sets created_at and updated_at to current Unix milliseconds
    7. Client stores locally in WatermelonDB
    8. User completes workout, client sets ended_at to current datetime
    9. Client updates updated_at to current Unix milliseconds
    10. When online, client pushes workout_session
    11. Server validates user_id and workout_id (if provided) exist
    12. Server accepts and stores as provided
    """
    __tablename__ = "workout_sessions"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # See User model documentation for detailed UUID rationale.
    # Same offline-first architecture: mobile clients generate IDs without server.
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # FOREIGN KEY: User ownership (CASCADE DELETE from users)
    # ========================================================================
    
    # Foreign key to users.id - establishes which user performed this workout session
    # String(36) matches User.id type (UUID string format)
    #
    # ForeignKey('users.id', ondelete='CASCADE') means:
    # - References the id column in the users table
    # - ondelete='CASCADE': When referenced user is deleted, this workout_session is deleted too
    #
    # Why CASCADE from users?
    # - Workout sessions belong to users (not shared across accounts)
    # - Historical workout data has no meaning after user account deletion
    # - Orphaned sessions without owner have no access path
    # - Automatic cleanup prevents database pollution
    # - Example: User deletes account → all their workout history removed
    #
    # Why nullable=False?
    # - Every workout session MUST belong to a user
    # - Cannot create session without valid user_id
    # - Enforced at both application and database level
    user_id = Column(
        String(36),                              # UUID string format matching User.id
        ForeignKey('users.id', ondelete='CASCADE'),  # Reference users.id, CASCADE delete
        nullable=False                           # Owner is required
    )
    
    # ========================================================================
    # FOREIGN KEY: Workout template reference (SET NULL on delete, NULLABLE)
    # ========================================================================
    
    # Foreign key to workouts.id - references which template this session was based on
    # String(36) matches Workout.id type (UUID string format)
    #
    # ForeignKey('workouts.id', ondelete='SET NULL') means:
    # - References the id column in the workouts table
    # - ondelete='SET NULL': When referenced workout is deleted, set this field to NULL (not delete session)
    #
    # Why SET NULL instead of CASCADE?
    # - Historical data preservation: user did workout on 2024-01-15, that's a fact
    # - Template deletion shouldn't erase history of what user actually did
    # - WorkoutSession can exist independently (freestyle workouts without template)
    # - Example: User deletes "Push Day A" template, but past sessions remain in history
    #           showing they did *some* workout on various dates, just no longer linked to template
    #
    # Why NULLABLE?
    # - Supports freestyle sessions not based on a template
    # - User might start a "quick workout" and log exercises without following a plan
    # - workout_id=NULL indicates freestyle session
    # - workout_id=<UUID> indicates template-based session
    #
    # Business logic scenarios:
    # 1. Template-based session: workout_id references Workout template
    #    - User followed a planned workout structure
    #    - Can compare actual performance vs. planned targets
    # 2. Freestyle session: workout_id is NULL
    #    - User improvised exercises without a plan
    #    - Still valid workout session, just no template reference
    workout_id = Column(
        String(36),                                  # UUID string format matching Workout.id
        ForeignKey('workouts.id', ondelete='SET NULL'),  # Reference workouts.id, SET NULL on delete
        nullable=True                                # NULLABLE: supports freestyle sessions
    )
    
    # ========================================================================
    # TIMER TRACKING COLUMNS: Workout session start and end timestamps
    # ========================================================================
    
    # DateTime when workout session began (timezone-aware)
    # Example: 2024-01-15 08:30:00+00:00 (ISO 8601 format with UTC timezone)
    #
    # Why DateTime(timezone=True) instead of BigInteger Unix milliseconds?
    # - Business domain timestamp: represents actual workout timing (not sync tracking)
    # - Timezone-aware: crucial for users in different timezones
    # - Human-readable: easier to debug and query
    # - PostgreSQL TIMESTAMP WITH TIME ZONE type
    #
    # Why nullable=False?
    # - Every workout session MUST have a start time
    # - Cannot create session without knowing when it began
    # - Enforced at both application and database level
    #
    # Business logic:
    # - Set to current datetime when user starts workout
    # - Immutable after creation (workout start time doesn't change)
    # - Used to calculate session duration: ended_at - started_at
    # - Used for historical workout tracking and calendar views
    started_at = Column(
        DateTime(timezone=True),  # TIMESTAMP WITH TIME ZONE (timezone-aware datetime)
        nullable=False            # Start time is required
    )
    
    # DateTime when workout session ended (timezone-aware, NULLABLE for in-progress sessions)
    # Example: 2024-01-15 09:45:00+00:00 (ISO 8601 format with UTC timezone)
    #
    # Why DateTime(timezone=True)?
    # - Same rationale as started_at: business domain timestamp, timezone-aware
    # - PostgreSQL TIMESTAMP WITH TIME ZONE type
    #
    # Why NULLABLE?
    # - Represents in-progress sessions that haven't been completed yet
    # - ended_at=NULL indicates session is currently active
    # - ended_at=<datetime> indicates session is completed
    #
    # Session states:
    # 1. In Progress: ended_at IS NULL
    #    - User is currently working out
    #    - Application can query: WHERE ended_at IS NULL AND user_id = <user_id>
    #    - UI shows "Current Workout" with live timer
    # 2. Completed: ended_at IS NOT NULL
    #    - User finished the workout
    #    - Session duration = ended_at - started_at
    #    - UI shows "Completed" with total duration
    #
    # Business logic:
    # - Initially NULL when session created
    # - Set to current datetime when user finishes workout
    # - Should always be >= started_at (application validation)
    # - If app crashes, ended_at remains NULL (can detect abandoned sessions)
    #
    # Abandoned session detection:
    # - Query: WHERE ended_at IS NULL AND started_at < (NOW() - INTERVAL '24 hours')
    # - Application can prompt user: "Resume workout from yesterday?"
    ended_at = Column(
        DateTime(timezone=True),  # TIMESTAMP WITH TIME ZONE (timezone-aware datetime)
        nullable=True             # NULLABLE: in-progress sessions have no end time yet
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when workout session record was first created
    # See User model documentation for detailed timestamp rationale.
    # Same sync protocol architecture: tracks creation time for sync queries.
    #
    # NOTE: This is DIFFERENT from started_at:
    # - created_at: Sync protocol timestamp (when record created in database, Unix ms)
    # - started_at: Business domain timestamp (when workout physically started, DateTime with TZ)
    #
    # Example: User starts workout offline at 8:30 AM, syncs at 9:00 AM
    # - started_at = 8:30 AM (when workout actually started)
    # - created_at = 8:30 AM Unix ms (set by client when session created locally)
    # - updated_at = 9:00 AM Unix ms (when synced to server)
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when workout session record was last modified
    # See User model documentation for detailed timestamp rationale.
    # Updates when: ended_at set, notes added, or any other modification
    #
    # NOTE: This is DIFFERENT from ended_at:
    # - updated_at: Sync protocol timestamp (when record modified in database, Unix ms)
    # - ended_at: Business domain timestamp (when workout physically ended, DateTime with TZ)
    #
    # Example: User finishes workout at 9:45 AM
    # - ended_at = 9:45 AM (when workout actually finished)
    # - updated_at = 9:45 AM Unix ms (when ended_at field was set)
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation with cascade rules
    # ========================================================================
    
    # Many-to-one relationship: WorkoutSession belongs to one User
    # back_populates="workout_sessions" creates bidirectional reference:
    # - WorkoutSession.user → parent User object (who performed this session)
    # - User.workout_sessions → list of WorkoutSession objects (all sessions by user)
    #
    # NO cascade parameter here:
    # - Cascade is defined on the PARENT side (User.workout_sessions has cascade)
    # - This is the child side, just references parent
    # - CASCADE DELETE configured in users.id foreign key (ondelete='CASCADE')
    user = relationship(
        "User",                      # Target model name
        back_populates="workout_sessions"  # Reverse relationship name in User model
    )
    
    # Many-to-one relationship: WorkoutSession optionally references one Workout template
    # back_populates="workout_sessions" creates bidirectional reference:
    # - WorkoutSession.workout → parent Workout object (which template was used, can be None)
    # - Workout.workout_sessions → list of WorkoutSession objects (times this template was used)
    #
    # NO cascade parameter here:
    # - This is a reference relationship (not ownership)
    # - SET NULL configured in workouts.id foreign key (ondelete='SET NULL')
    # - When workout template deleted, workout_id becomes NULL but session preserved
    #
    # Navigation examples:
    # 1. Template-based session:
    #    workout_session.workout.name → "Push Day A" (template name)
    # 2. Freestyle session:
    #    workout_session.workout → None (no template reference)
    workout = relationship(
        "Workout",                   # Target model name
        back_populates="workout_sessions"  # Reverse relationship name in Workout model
    )
    
    # One-to-many relationship: WorkoutSession has many LoggedSets (actual performance data)
    # back_populates="session" creates bidirectional reference:
    # - WorkoutSession.logged_sets → list of LoggedSet objects (all sets logged during this session)
    # - LoggedSet.session → parent WorkoutSession object (which session this set belongs to)
    #
    # cascade="all, delete-orphan" means:
    # - "all": When workout_session deleted, delete all related logged_sets (CASCADE DELETE)
    # - "delete-orphan": When logged_set removed from workout_session.logged_sets, delete it from DB
    #
    # Why cascade delete?
    # - LoggedSets represent performance data within a session
    # - Logged sets have no meaning without their parent session
    # - Automatic cleanup prevents orphaned logged_sets
    # - Example: Delete workout session → also delete all sets logged during that session
    #
    # Business rationale:
    # - If user deletes a workout session from history, all associated performance data should go too
    # - Keeping orphaned logged_sets would pollute database with meaningless records
    # - Logged sets are tightly coupled to sessions (not independent entities)
    logged_sets = relationship(
        "LoggedSet",                 # Target model name (to be implemented in Task 4.2)
        back_populates="session",    # Reverse relationship name in LoggedSet model
        cascade="all, delete-orphan" # Delete logged_sets when workout_session deleted
    )


# ============================================================================
# LOGGED SET MODEL: Completed exercise sets with automatic 1RM calculation
# ============================================================================

class LoggedSet(Base):
    """
    Logged set model - records completed exercise sets with automatic one-rep max calculation.
    
    BUSINESS PURPOSE:
    -----------------
    Records individual COMPLETED exercise sets with actual performance data (weight,
    repetitions) and automatically calculated estimated one-rep maximum (1RM) using
    the Epley formula. This is the "what WAS achieved" record, tracking real performance
    for progress tracking and personal record (PR) identification.
    
    Example: User completes bench press set during workout session:
    - LoggedSet created with weight=100kg, repetitions=8
    - estimated_one_rm automatically calculated: 100 * (1 + 8/30) ≈ 126.67kg
    - completed_at timestamp records when set was finished
    - Linked to workout_session (which session) and exercise (which exercise)
    
    Separation of planning vs execution vs performance:
    - WorkoutExercise: PLANNED performance (prescription) - "4 sets x 8 reps @ 80kg"
    - WorkoutSession: ACTUAL instance (when) - "Jan 15 10am-11:30am"
    - LoggedSet (this model): REAL performance (what achieved) - "Set 1: 100kg x 8 reps"
    
    EPLEY FORMULA FOR ONE-REP MAX ESTIMATION:
    -----------------------------------------
    Formula: estimated_one_rm = weight * (1 + repetitions / 30)
    
    Derivation and rationale:
    - Developed by Matt Epley in 1985 for estimating maximum strength
    - Based on empirical data correlating submaximal lifts to maximum lifts
    - Most accurate for 1-10 repetitions (typical strength training range)
    - Less accurate for high reps (>15) as muscular endurance becomes limiting factor
    
    Example calculations:
    - 100kg x 1 rep → 100 * (1 + 1/30) = 103.33kg (close to actual 1RM)
    - 100kg x 5 reps → 100 * (1 + 5/30) = 116.67kg
    - 100kg x 8 reps → 100 * (1 + 8/30) = 126.67kg
    - 100kg x 10 reps → 100 * (1 + 10/30) = 133.33kg
    - 100kg x 15 reps → 100 * (1 + 15/30) = 150.00kg (less accurate, endurance-focused)
    
    Why estimate 1RM instead of testing it directly?
    - Testing true 1RM is fatiguing, risky, and can't be done frequently
    - Estimation from submaximal lifts allows tracking strength progress over time
    - Enables identifying personal records (PRs) without maximal effort sets
    - Used for training program progression (e.g., "work at 80% of estimated 1RM")
    
    AUTOMATIC CALCULATION:
    ----------------------
    The @validates decorator automatically calculates estimated_one_rm if not provided:
    - Client CAN provide estimated_one_rm explicitly (override)
    - Client CAN omit estimated_one_rm (automatic calculation from weight + reps)
    - Server ALWAYS ensures estimated_one_rm is set before insert/update
    
    Validation logic:
    1. If client provides all three values (weight, reps, estimated_one_rm):
       → Accept client's estimated_one_rm as-is (client override)
    2. If client provides weight and reps but not estimated_one_rm:
       → Automatically calculate using Epley formula
    3. If client modifies weight or reps after creation:
       → Recalculate estimated_one_rm using new values
    
    Why allow client override?
    - Client might use different 1RM formula (Brzycki, Lombardi, etc.)
    - Client might have actual tested 1RM data
    - Flexibility for future formula improvements without breaking existing data
    
    PERSONAL RECORD (PR) TRACKING:
    -------------------------------
    The estimated_one_rm field enables PR identification:
    - Query: SELECT MAX(estimated_one_rm) FROM logged_sets WHERE exercise_id = <exercise_id>
    - Result: User's best estimated 1RM for that exercise (their PR)
    
    Example PR tracking:
    - User logs bench press: 100kg x 8 reps → estimated_one_rm = 126.67kg
    - User logs bench press: 105kg x 6 reps → estimated_one_rm = 126.00kg (not a PR)
    - User logs bench press: 110kg x 7 reps → estimated_one_rm = 135.67kg (NEW PR!)
    
    Application can display:
    - "New bench press PR: 135.67kg estimated 1RM!"
    - "Previous PR: 126.67kg (8 days ago)"
    - Progress graph showing estimated 1RM over time
    
    SESSION AND EXERCISE RELATIONSHIPS:
    -----------------------------------
    Each logged set belongs to:
    1. WorkoutSession (session_id): Which workout session this set was logged during
    2. Exercise (exercise_id): Which exercise was performed
    
    Foreign keys:
    - session_id → workout_sessions.id with CASCADE DELETE
    - exercise_id → exercises.id with RESTRICT DELETE
    
    Why CASCADE from workout_sessions?
    - Logged sets have no meaning without their parent session
    - If session deleted, all associated logged sets should be deleted
    - Example: User deletes workout session from Jan 15 → all sets from that session deleted
    
    Why RESTRICT on exercises?
    - Protects historical performance data integrity
    - Logged sets must retain exercise names even if removed from current workout plans
    - Example: User logged bench press for 6 months → cannot delete "Bench Press" exercise
    - Must preserve historical data showing what exercises were actually performed
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys to enable offline creation on mobile
    clients. When a user logs a set offline, they generate a UUID client-side,
    automatically calculate estimated_one_rm, and sync it to the server later.
    
    SYNC BEHAVIOR:
    --------------
    - created_at: Set once when logged set is first created (sync timestamp in Unix ms)
    - updated_at: Updated when set is modified (weight/reps changed, etc.)
    - completed_at: DateTime when set was actually completed (business domain timestamp)
    
    Why both created_at/updated_at (BigInteger) AND completed_at (DateTime)?
    - created_at/updated_at: Sync protocol timestamps (Unix ms) for change tracking
    - completed_at: Business domain timestamp (DateTime with timezone) for workout timing
    - Different purposes: sync tracking vs. set timing
    
    CASCADE DELETE RULES:
    ---------------------
    CASCADE FROM workout_sessions (cleanup):
    - When workout_session deleted, all associated logged_sets are deleted (CASCADE)
    - Rationale: Logged sets have no meaning without their parent session
    - Example: Delete session from Jan 15 → also delete all sets logged during it
    
    RESTRICT ON exercises (protect historical data):
    - Exercise catalog entries CANNOT be deleted if referenced by logged_sets
    - Rationale: Preserves historical performance data integrity
    - Example: Attempt to delete "Bench Press" exercise → FAILS if any logged sets use it
    - Foreign key uses RESTRICT constraint: DELETE fails if references exist
    
    CASCADE FROM users (indirect, via workout_sessions):
    - When user deleted, all their workout_sessions are deleted (CASCADE)
    - When workout_session deleted, all logged_sets are deleted (CASCADE chain)
    - Result: User deletion cascades to logged_sets indirectly
    - Example: Delete user account → all workout sessions deleted → all logged sets deleted
    
    COLUMNS:
    --------
    - id: String(36) - Client-generated UUID primary key
    - session_id: String(36) - Foreign key to workout_sessions.id, CASCADE on delete, NOT NULL
    - exercise_id: String(36) - Foreign key to exercises.id, RESTRICT on delete, NOT NULL
    - weight: Float - Actual weight lifted in kg, NOT NULL
    - repetitions: Integer - Actual repetitions completed, NOT NULL
    - estimated_one_rm: Float - Calculated one-rep max using Epley formula, NOT NULL
    - completed_at: DateTime(timezone=True) - When set was completed, NOT NULL
    - created_at: BigInteger - Unix milliseconds when created, NOT NULL
    - updated_at: BigInteger - Unix milliseconds when last modified, NOT NULL
    
    RELATIONSHIPS:
    --------------
    - session: Many-to-one with WorkoutSession (LoggedSet.session, WorkoutSession.logged_sets)
               CASCADE FROM: When workout_session deleted, logged_set is deleted
    - exercise: Many-to-one with Exercise (LoggedSet.exercise, Exercise.logged_sets)
                RESTRICT: Exercise cannot be deleted if logged_sets reference it
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - FOREIGN KEY: session_id references workout_sessions.id ON DELETE CASCADE
    - FOREIGN KEY: exercise_id references exercises.id ON DELETE RESTRICT
    - NOT NULL: id, session_id, exercise_id, weight, repetitions, estimated_one_rm, completed_at, created_at, updated_at
    
    VALIDATION:
    -----------
    - @validates('estimated_one_rm', 'weight', 'repetitions'): Automatically calculates estimated_one_rm
      using Epley formula if not provided by client
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Mobile client logs a set offline:
    1. Client generates UUID: "ls123456-e5f6-7890-abcd-ef1234567890"
    2. Client sets session_id (must already exist or be created in same sync batch)
    3. Client sets exercise_id (must exist in exercises catalog)
    4. Client sets weight=100.0, repetitions=8
    5. Client EITHER:
       a) Provides estimated_one_rm explicitly (client-side Epley calculation)
       b) Omits estimated_one_rm (server calculates automatically via @validates)
    6. Client sets completed_at to current datetime with timezone
    7. Client sets created_at and updated_at to current Unix milliseconds
    8. Client stores locally in WatermelonDB
    9. When online, client pushes logged_set
    10. Server validates session_id and exercise_id exist (foreign key constraints)
    11. Server runs @validates decorator: calculates estimated_one_rm if not provided
    12. Server accepts and stores as provided/calculated
    """
    __tablename__ = "logged_sets"
    
    # ========================================================================
    # PRIMARY KEY: Client-generated UUID (String format, not PostgreSQL UUID)
    # ========================================================================
    # See User model documentation for detailed UUID rationale.
    # Same offline-first architecture: mobile clients generate IDs without server.
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # FOREIGN KEY: Workout session reference (CASCADE DELETE from workout_sessions)
    # ========================================================================
    
    # Foreign key to workout_sessions.id - establishes which workout session this set belongs to
    # String(36) matches WorkoutSession.id type (UUID string format)
    #
    # ForeignKey('workout_sessions.id', ondelete='CASCADE') means:
    # - References the id column in the workout_sessions table
    # - ondelete='CASCADE': When referenced workout_session is deleted, this logged_set is deleted too
    #
    # Why CASCADE from workout_sessions?
    # - Logged sets are performance data within a workout session
    # - Logged sets have no meaning without their parent session
    # - Automatic cleanup prevents orphaned logged_sets
    # - Example: User deletes workout session from Jan 15 → all sets from that session deleted
    #
    # Why nullable=False?
    # - Every logged set MUST belong to a workout session
    # - Cannot create logged set without valid session_id
    # - Enforced at both application and database level
    #
    # Business context:
    # - Logged sets are always created during a workout session
    # - Session provides timing context: which workout, when it occurred
    # - Session groups related sets together for workout history display
    session_id = Column(
        String(36),                                      # UUID string format matching WorkoutSession.id
        ForeignKey('workout_sessions.id', ondelete='CASCADE'),  # Reference workout_sessions.id, CASCADE delete
        nullable=False                                   # Session reference is required
    )
    
    # ========================================================================
    # FOREIGN KEY: Exercise reference (RESTRICT DELETE from exercises)
    # ========================================================================
    
    # Foreign key to exercises.id - references which exercise was performed
    # String(36) matches Exercise.id type (UUID string format)
    #
    # ForeignKey('exercises.id', ondelete='RESTRICT') means:
    # - References the id column in the exercises table
    # - ondelete='RESTRICT': Cannot delete exercise if logged_sets reference it
    #
    # Why RESTRICT on exercises?
    # - Exercise catalog is shared reference data (not owned by logged set)
    # - Protects historical performance data from losing exercise context
    # - Logged sets from 6 months ago should still show "Bench Press" name
    # - Prevents accidental data loss: can't delete "Bench Press" if any sets logged
    # - Database will raise IntegrityError if deletion attempted
    #
    # Why nullable=False?
    # - Every logged set MUST reference a valid exercise
    # - Cannot create logged set without knowing which exercise was performed
    # - Enforced at both application and database level
    #
    # Historical data protection example:
    # 1. User logs bench press sets for 6 months (hundreds of logged_sets)
    # 2. Admin attempts to delete "Bench Press" from exercises catalog
    # 3. Database raises IntegrityError: "foreign key constraint violation"
    # 4. Must keep exercise definition to preserve historical data integrity
    # 5. Alternative: Mark exercise as "archived" instead of hard delete
    exercise_id = Column(
        String(36),                                    # UUID string format matching Exercise.id
        ForeignKey('exercises.id', ondelete='RESTRICT'),  # Reference exercises.id, RESTRICT delete
        nullable=False                                 # Exercise reference is required
    )

    
    # ========================================================================
    # PERFORMANCE DATA COLUMNS: Actual weight and repetitions achieved
    # ========================================================================
    
    # Actual weight lifted in kilograms
    # Example values: 20.0, 80.0, 100.5 (typically 0-500kg)
    #
    # Why Float (not Integer)?
    # - Weight plates come in fractional values: 2.5kg, 1.25kg, 0.5kg
    # - Users might use 77.5kg (bar + plates + microplates)
    # - Float type allows decimal precision for accurate tracking
    #
    # Why nullable=False?
    # - Every logged set MUST record weight
    # - Even bodyweight exercises should specify 0.0 or actual bodyweight
    # - Required for 1RM calculation and progress tracking
    #
    # Unit standardization:
    # - Always stored in KILOGRAMS (metric system)
    # - Application layer converts to/from pounds if needed (1kg = 2.20462lbs)
    # - Example: User in USA logs 225lbs → stored as 102.06kg
    #
    # Business logic note:
    # - Application should validate weight >= 0
    # - Consider adding CHECK constraint: weight >= 0
    # - Negative weight doesn't make physical sense
    # - Zero weight is valid for bodyweight exercises or warm-up sets
    weight = Column(
        Float,
        nullable=False        # Weight is required
    )
    
    # Actual repetitions completed
    # Example values: 5, 8, 10, 12 (typically 1-50 reps per set)
    #
    # Why Integer (not Float)?
    # - Repetitions are discrete whole numbers (you can't do 7.5 reps)
    # - Integer type enforces this constraint at database level
    #
    # Why nullable=False?
    # - Every logged set MUST record repetitions
    # - Required for 1RM calculation and progress tracking
    # - Zero reps would indicate failure to complete any reps (valid data point)
    #
    # Business logic note:
    # - Application should validate repetitions >= 0
    # - Consider adding CHECK constraint: repetitions >= 0
    # - Zero reps is valid (set attempted but failed)
    #
    # Rep ranges and training goals:
    # - 1-5 reps: Strength focus (heavy weight, low reps)
    # - 6-12 reps: Hypertrophy focus (muscle growth, moderate weight)
    # - 12+ reps: Endurance focus (lighter weight, high reps)
    #
    # Epley formula accuracy:
    # - Most accurate for 1-10 reps (typical strength training)
    # - Less accurate for high reps (>15) where endurance becomes limiting factor
    repetitions = Column(
        Integer,
        nullable=False        # Repetitions is required
    )
    
    # Estimated one-rep maximum (1RM) calculated using Epley formula
    # Formula: weight * (1 + repetitions / 30)
    # Example: 100kg x 8 reps → 100 * (1 + 8/30) = 126.67kg estimated 1RM
    #
    # Why Float (not Integer)?
    # - 1RM calculation produces decimal values: 126.67kg, 103.33kg
    # - Float type preserves precision for accurate PR tracking
    #
    # Why nullable=False?
    # - Every logged set MUST have estimated 1RM for PR tracking
    # - Automatically calculated via @validates decorator if not provided
    # - Core feature for progress tracking and strength analytics
    #
    # Automatic calculation:
    # - @validates decorator calculates estimated_one_rm if not provided by client
    # - Client CAN provide explicit value (override automatic calculation)
    # - Server ALWAYS ensures value is set before insert/update
    #
    # Business use cases:
    # - Personal record (PR) tracking: MAX(estimated_one_rm) per exercise
    # - Progress graphs: estimated_one_rm over time for each exercise
    # - Training program progression: "work at 80% of estimated 1RM"
    # - Strength comparison: normalized metric across different rep ranges
    #
    # Example PR tracking query:
    # SELECT MAX(estimated_one_rm) as pr, exercise_id
    # FROM logged_sets
    # WHERE user_id = <user_id>
    # GROUP BY exercise_id
    #
    # Epley formula accuracy:
    # - Most accurate for 1-10 reps (R² > 0.95 in validation studies)
    # - Reasonable for 10-15 reps (R² ≈ 0.90)
    # - Less accurate for >15 reps (endurance becomes limiting factor)
    estimated_one_rm = Column(
        Float,
        nullable=False        # Estimated 1RM is required (calculated automatically if not provided)
    )
    
    # ========================================================================
    # TIMING COLUMN: When set was actually completed
    # ========================================================================
    
    # DateTime when set was completed (timezone-aware)
    # Example: 2024-01-15 10:15:32+00:00 (ISO 8601 format with UTC timezone)
    #
    # Why DateTime(timezone=True) instead of BigInteger Unix milliseconds?
    # - Business domain timestamp: represents actual set timing (not sync tracking)
    # - Timezone-aware: crucial for users in different timezones
    # - Human-readable: easier to debug and query
    # - PostgreSQL TIMESTAMP WITH TIME ZONE type
    #
    # Why nullable=False?
    # - Every logged set MUST record when it was completed
    # - Cannot create logged set without knowing when it occurred
    # - Enforced at both application and database level
    #
    # Business logic:
    # - Set to current datetime when user logs the set
    # - Used for workout history and timeline views
    # - Used for rest time calculation: completed_at(set N+1) - completed_at(set N)
    # - Used for progress tracking: performance over time
    #
    # Example rest time calculation:
    # Set 1: completed_at = 10:15:32
    # Set 2: completed_at = 10:18:15
    # Rest time = 10:18:15 - 10:15:32 = 2 minutes 43 seconds
    #
    # NOTE: This is DIFFERENT from created_at:
    # - completed_at: Business domain timestamp (when set physically completed, DateTime with TZ)
    # - created_at: Sync protocol timestamp (when record created in database, Unix ms)
    #
    # Example: User completes set offline at 10:15 AM, syncs at 11:00 AM
    # - completed_at = 10:15 AM (when set actually completed)
    # - created_at = 10:15 AM Unix ms (set by client when logged locally)
    # - updated_at = 11:00 AM Unix ms (when synced to server)
    completed_at = Column(
        DateTime(timezone=True),  # TIMESTAMP WITH TIME ZONE (timezone-aware datetime)
        nullable=False            # Completion time is required
    )
    
    # ========================================================================
    # SYNC TIMESTAMP COLUMNS: WatermelonDB synchronization protocol
    # ========================================================================
    
    # Unix timestamp in milliseconds when logged set record was first created
    # See User model documentation for detailed timestamp rationale.
    # Same sync protocol architecture: tracks creation time for sync queries.
    created_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms        # Auto-generate if not provided by client
    )
    
    # Unix timestamp in milliseconds when logged set record was last modified
    # See User model documentation for detailed timestamp rationale.
    # Updates when: weight/reps modified, estimated_one_rm recalculated, etc.
    updated_at = Column(
        BigInteger,                         # 64-bit integer for Unix milliseconds
        nullable=False,                     # Must always have a value
        default=current_timestamp_ms,       # Set on creation
        onupdate=current_timestamp_ms       # Auto-update on every modification
    )
    
    # ========================================================================
    # RELATIONSHIPS: Bidirectional ORM navigation with cascade rules
    # ========================================================================
    
    # Many-to-one relationship: LoggedSet belongs to one WorkoutSession
    # back_populates="logged_sets" creates bidirectional reference:
    # - LoggedSet.session → parent WorkoutSession object (which session this set belongs to)
    # - WorkoutSession.logged_sets → list of LoggedSet objects (all sets logged during session)
    #
    # NO cascade parameter here:
    # - Cascade is defined on the PARENT side (WorkoutSession.logged_sets has cascade)
    # - This is the child side, just references parent
    # - CASCADE DELETE configured in workout_sessions.id foreign key (ondelete='CASCADE')
    #
    # Navigation example:
    # logged_set.session.started_at → When workout session started
    # logged_set.session.user.name → Who performed the workout
    session = relationship(
        "WorkoutSession",            # Target model name
        back_populates="logged_sets"  # Reverse relationship name in WorkoutSession model
    )
    
    # Many-to-one relationship: LoggedSet references one Exercise
    # back_populates="logged_sets" creates bidirectional reference:
    # - LoggedSet.exercise → parent Exercise object (which exercise was performed)
    # - Exercise.logged_sets → list of LoggedSet objects (all logged sets for this exercise)
    #
    # NO cascade parameter here:
    # - This is a reference relationship (not ownership)
    # - Exercise is shared catalog data (not owned by logged set)
    # - RESTRICT DELETE configured in exercises.id foreign key (ondelete='RESTRICT')
    # - Protects exercises from deletion if still referenced by logged sets
    #
    # Navigation example:
    # logged_set.exercise.name → "Barbell Bench Press"
    # exercise.logged_sets → list of all logged sets for this exercise (across all users/sessions)
    #
    # PR tracking query example (using relationship):
    # user_bench_press_sets = session.query(LoggedSet).join(Exercise).filter(
    #     Exercise.name == "Barbell Bench Press",
    #     LoggedSet.session.has(WorkoutSession.user_id == user.id)
    # ).all()
    # pr = max(s.estimated_one_rm for s in user_bench_press_sets)
    exercise = relationship(
        "Exercise",                  # Target model name
        back_populates="logged_sets"  # Reverse relationship name in Exercise model
    )
    
    # ========================================================================
    # VALIDATION: Automatic 1RM calculation using Epley formula
    # ========================================================================
    
    @validates('estimated_one_rm', 'weight', 'repetitions')
    def calculate_estimated_one_rm(self, key, value):
        """
        Automatically calculate estimated one-rep maximum using Epley formula.
        
        EPLEY FORMULA:
        --------------
        estimated_one_rm = weight × (1 + repetitions / 30)
        
        FORMULA DERIVATION:
        -------------------
        The Epley formula is an empirically-derived equation based on linear regression
        of submaximal lift data to maximum lift data. It assumes a linear relationship
        between the number of repetitions performed and the percentage of 1RM being used.
        
        Mathematical basis:
        - If you can lift weight W for R reps, your 1RM ≈ W × (1 + R/30)
        - The constant 30 was determined empirically (best fit to training data)
        - Formula validated across multiple studies with R² > 0.95 for 1-10 reps
        
        Example calculations demonstrating formula behavior:
        - 100kg × 1 rep  → 100 × (1 + 1/30)  = 103.33kg  (just above actual weight)
        - 100kg × 5 reps → 100 × (1 + 5/30)  = 116.67kg  (~85% intensity)
        - 100kg × 8 reps → 100 × (1 + 8/30)  = 126.67kg  (~79% intensity)
        - 100kg × 10 reps → 100 × (1 + 10/30) = 133.33kg  (~75% intensity)
        - 100kg × 15 reps → 100 × (1 + 15/30) = 150.00kg  (~67% intensity, less accurate)
        - 100kg × 30 reps → 100 × (1 + 30/30) = 200.00kg  (2x weight, very inaccurate)
        
        ACCURACY RANGE:
        ---------------
        The Epley formula is most accurate for 1-10 repetitions:
        - 1-5 reps: Very accurate (R² > 0.97) - strength training range
        - 6-10 reps: Accurate (R² > 0.95) - hypertrophy training range
        - 10-15 reps: Moderately accurate (R² ≈ 0.90) - endurance-hypertrophy range
        - 15+ reps: Less accurate - muscular endurance becomes limiting factor
        
        Why accuracy decreases at high reps:
        - High-rep sets limited by muscular endurance, not maximum strength
        - Cardiovascular fatigue becomes significant factor
        - Technique breakdown more likely with fatigue
        - Lactic acid accumulation affects performance
        
        AUTOMATIC CALCULATION LOGIC:
        ----------------------------
        This validator automatically calculates estimated_one_rm in these scenarios:
        
        1. Creation without estimated_one_rm:
           - Client provides weight and repetitions, omits estimated_one_rm
           - Validator calculates estimated_one_rm using Epley formula
           - Example: LoggedSet(weight=100, repetitions=8) → estimated_one_rm=126.67
        
        2. Modification of weight or repetitions:
           - Client updates weight or repetitions on existing logged set
           - Validator recalculates estimated_one_rm with new values
           - Example: Update weight from 100 to 110 → estimated_one_rm recalculated
        
        3. Client-provided estimated_one_rm (override):
           - Client explicitly provides estimated_one_rm value
           - Validator accepts client value as-is (no recalculation)
           - Example: Client uses different formula (Brzycki, Lombardi, etc.)
        
        CLIENT OVERRIDE RATIONALE:
        --------------------------
        Why allow clients to override automatic calculation?
        - Client might use different 1RM estimation formula
        - Client might have actual tested 1RM data (more accurate than estimation)
        - Flexibility for future formula improvements without breaking existing data
        - Backwards compatibility if Epley formula parameters change
        
        VALIDATION EXECUTION:
        ---------------------
        SQLAlchemy @validates decorator is called:
        - BEFORE INSERT: When new LoggedSet is created
        - BEFORE UPDATE: When weight, repetitions, or estimated_one_rm is modified
        - FOR EACH FIELD: Validator called once per modified field
        
        Validator receives:
        - self: The LoggedSet instance being created/modified
        - key: Name of field being validated ('estimated_one_rm', 'weight', or 'repetitions')
        - value: New value being set for the field
        
        Returns:
        - The value to actually store in the field (modified or original)
        
        IMPLEMENTATION DETAILS:
        -----------------------
        The validator checks if all three fields (weight, repetitions, estimated_one_rm)
        are available:
        
        1. If estimated_one_rm is being set explicitly (key == 'estimated_one_rm'):
           → Return value as-is (client override)
        
        2. If weight or repetitions is being set:
           → Check if we have all values needed for calculation
           → If yes: Calculate estimated_one_rm using Epley formula
           → If no: Return value as-is (wait for other fields to be set)
        
        Edge cases handled:
        - Zero repetitions: weight × (1 + 0/30) = weight × 1 = weight (valid)
        - Zero weight: 0 × (1 + reps/30) = 0 (valid for bodyweight exercises)
        - High repetitions: Formula still works but less accurate (no error)
        
        EXAMPLE USAGE SCENARIOS:
        ------------------------
        
        Scenario 1: Client calculates 1RM (most common):
        ```python
        logged_set = LoggedSet(
            id=uuid4(),
            session_id=session.id,
            exercise_id=exercise.id,
            weight=100.0,
            repetitions=8,
            estimated_one_rm=126.67,  # Client pre-calculated
            completed_at=datetime.now()
        )
        # Validator: estimated_one_rm provided → accept as-is
        # Result: estimated_one_rm = 126.67
        ```
        
        Scenario 2: Server calculates 1RM (client omits):
        ```python
        logged_set = LoggedSet(
            id=uuid4(),
            session_id=session.id,
            exercise_id=exercise.id,
            weight=100.0,
            repetitions=8,
            # estimated_one_rm omitted
            completed_at=datetime.now()
        )
        # Validator: estimated_one_rm not provided → calculate automatically
        # Calculation: 100 * (1 + 8/30) = 126.67
        # Result: estimated_one_rm = 126.67
        ```
        
        Scenario 3: Client updates weight (recalculation):
        ```python
        logged_set.weight = 110.0  # Update weight from 100 to 110
        # Validator: weight changed, repetitions=8 → recalculate estimated_one_rm
        # Calculation: 110 * (1 + 8/30) = 143.33
        # Result: estimated_one_rm = 143.33
        ```
        
        Args:
            key: Field name being validated ('estimated_one_rm', 'weight', or 'repetitions')
            value: New value being set for the field
        
        Returns:
            The value to store in the field (original or calculated estimated_one_rm)
        """
        # If estimated_one_rm is being set explicitly by client, accept it as-is
        # This allows client override of automatic calculation
        # Example: Client uses different formula or has actual tested 1RM
        if key == 'estimated_one_rm':
            return value
        
        # If weight or repetitions is being set, check if we should recalculate estimated_one_rm
        # We need both weight and repetitions to calculate, so check if both are available
        
        # Determine current values for weight and repetitions
        # If we're setting weight, use new value; otherwise use existing value (if available)
        # If we're setting repetitions, use new value; otherwise use existing value (if available)
        weight_value = value if key == 'weight' else getattr(self, 'weight', None)
        reps_value = value if key == 'repetitions' else getattr(self, 'repetitions', None)
        
        # Check if we have both weight and repetitions available for calculation
        # If either is None, we can't calculate yet (early in object construction)
        if weight_value is not None and reps_value is not None:
            # Both values available → calculate estimated_one_rm using Epley formula
            # Formula: estimated_one_rm = weight × (1 + repetitions / 30)
            # 
            # Example calculation:
            # weight_value = 100.0, reps_value = 8
            # estimated_one_rm = 100.0 × (1 + 8/30) = 100.0 × 1.2667 = 126.67
            calculated_one_rm = weight_value * (1 + reps_value / 30)
            
            # Set the calculated value on the object
            # This updates estimated_one_rm even if we're currently validating weight or repetitions
            # SQLAlchemy will call this validator again for estimated_one_rm, but we'll accept it
            self.estimated_one_rm = calculated_one_rm
        
        # Return the value being set for the current field (weight or repetitions)
        # The estimated_one_rm calculation happens as a side effect via setattr above
        return value



# ============================================================================
# DELETED RECORD MODEL: Tombstone tracking for sync protocol
# ============================================================================

class DeletedRecord(Base):
    """
    Tombstone tracking table for WatermelonDB sync protocol deletion propagation.
    
    BUSINESS PURPOSE:
    -----------------
    Tracks deletions of syncable records to enable offline clients to receive
    deletion notifications during synchronization. When a record is deleted on
    the server (or by another client and synced to server), a tombstone record
    is created in this table. During the next sync, offline clients query this
    table to identify which records they should delete locally.
    
    This implements the "tombstone deletion tracking" pattern required by the
    WatermelonDB Sync Protocol for reliable bidirectional synchronization.
    
    SYNC PROTOCOL INTEGRATION:
    ---------------------------
    The WatermelonDB sync workflow requires knowledge of deletions that occurred
    while a client was offline:
    
    Server-to-Client Pull Workflow:
    1. Client sends last_pulled_at timestamp (e.g., 1234567890000)
    2. Server queries modified records: SELECT * WHERE updated_at > last_pulled_at
    3. Server queries deleted records: SELECT * FROM deleted_records WHERE deleted_at > last_pulled_at
    4. Server sends both modified records AND deletion list to client
    5. Client updates modified records, creates new records, and DELETES tombstoned records
    6. Client stores new last_pulled_at timestamp for next sync
    
    Without tombstone tracking:
    - Client would never know about deletions that occurred while offline
    - Deleted records would remain in client's local database indefinitely
    - Data inconsistency between server and client (server shows 10 workouts, client shows 15)
    - No way to propagate deletions in distributed offline-first architecture
    
    TOMBSTONE RECORD STRUCTURE:
    ----------------------------
    Each tombstone captures three pieces of information:
    
    1. table_name (String): Which table the deleted record came from
       - Examples: "workouts", "workout_sessions", "logged_sets", "exercises"
       - Allows client to route deletion to correct local table
       - Format: lowercase table name matching database schema
    
    2. record_id (String UUID): The UUID of the deleted record
       - References the id column of the deleted record
       - Client uses this to identify which local record to delete
       - Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters)
    
    3. deleted_at (BigInteger): When the deletion occurred
       - Unix milliseconds timestamp of deletion moment
       - Enables incremental sync: WHERE deleted_at > last_pulled_at
       - Format: 13-digit integer (e.g., 1234567890000)
    
    TOMBSTONE LIFECYCLE:
    --------------------
    Creation:
    - When a syncable record is deleted (workout, exercise, etc.)
    - Application creates tombstone before deleting actual record
    - Tombstone persists even after original record is gone
    
    Synchronization:
    - Client queries tombstones created since last sync (deleted_at > last_pulled_at)
    - Server sends list of tombstones to client
    - Client deletes corresponding local records using table_name and record_id
    
    Cleanup (optional):
    - Tombstones can be periodically purged after sufficient time (e.g., 90 days)
    - Rationale: Clients that haven't synced in 90 days should do full resync anyway
    - Prevents unbounded growth of deleted_records table over time
    - Example cleanup query: DELETE FROM deleted_records WHERE deleted_at < (NOW() - INTERVAL '90 days')
    
    CASCADE DELETE CONSIDERATIONS:
    -------------------------------
    This table does NOT have foreign key relationships to other tables:
    - table_name is a string, not a foreign key
    - record_id is a string UUID, not a foreign key
    
    Why no foreign keys?
    - Tombstones must persist AFTER the original record is deleted
    - Foreign keys would prevent deletion or auto-delete tombstone (defeating the purpose)
    - Tombstones are historical records of "what was deleted", not live references
    
    Example scenario demonstrating no foreign keys:
    1. User deletes workout with id="abc-123"
    2. Create tombstone: table_name="workouts", record_id="abc-123", deleted_at=NOW()
    3. Delete actual workout record from workouts table
    4. Tombstone remains in deleted_records table (no cascade delete)
    5. Client syncs and receives tombstone → deletes local workout "abc-123"
    6. After 90 days, tombstone can be purged (optional cleanup)
    
    OFFLINE-FIRST ARCHITECTURE:
    ----------------------------
    This model uses String UUID primary keys (like all other tables) but tombstone
    IDs are less important than other tables since tombstones are typically
    processed in bulk during sync and then optionally purged.
    
    SYNC BEHAVIOR:
    --------------
    - deleted_at: Timestamp when original record was deleted (Unix milliseconds)
    - No created_at or updated_at: Tombstones are immutable (created once, never updated)
    - Sync protocol queries: SELECT * FROM deleted_records WHERE deleted_at > last_pulled_at
    
    COLUMNS:
    --------
    - id: String(36) - UUID primary key for this tombstone record, NOT NULL
    - table_name: String(255) - Name of table where deletion occurred (e.g., "workouts"), NOT NULL
    - record_id: String(36) - UUID of the deleted record, NOT NULL
    - deleted_at: BigInteger - Unix milliseconds when deletion occurred, NOT NULL
    
    RELATIONSHIPS:
    --------------
    NONE - This is a standalone tracking table with no foreign key relationships.
    
    The table_name and record_id fields are informational strings, not foreign keys.
    This allows tombstones to persist after the original record is deleted.
    
    CONSTRAINTS:
    ------------
    - PRIMARY KEY: id
    - INDEX: deleted_at (enables efficient sync queries: WHERE deleted_at > last_pulled_at)
    - INDEX: table_name (enables filtering by entity type, optional optimization)
    - NOT NULL: id, table_name, record_id, deleted_at
    - NO FOREIGN KEYS: Must persist independently of original deleted records
    
    INDEXING RATIONALE:
    -------------------
    Index on deleted_at (CRITICAL):
    - Primary query pattern: WHERE deleted_at > last_pulled_at
    - Sync queries executed frequently (every time client syncs)
    - Index enables fast range scan instead of full table scan
    - Example: "Find all deletions since timestamp 1234567890000"
    
    Index on table_name (OPTIONAL):
    - Enables efficient filtering by entity type if needed
    - Example: "Find all workout deletions since timestamp X"
    - Useful for partial sync scenarios or analytics
    - Less critical than deleted_at index but provides flexibility
    
    SYNC PROTOCOL EXAMPLE:
    ----------------------
    Server deletes a workout and creates tombstone:
    1. Application receives delete request for workout "550e8400-e29b-41d4-a716-446655440000"
    2. Create tombstone:
       - id: Generate new UUID "tombstone-uuid-1234"
       - table_name: "workouts"
       - record_id: "550e8400-e29b-41d4-a716-446655440000" (the deleted workout's ID)
       - deleted_at: int(time.time() * 1000) (current Unix milliseconds)
    3. Delete actual workout from workouts table (cascade to workout_exercises)
    4. Tombstone remains in deleted_records table
    
    Client syncs and receives tombstone:
    1. Client sends last_pulled_at: 1234567890000
    2. Server queries: SELECT * FROM deleted_records WHERE deleted_at > 1234567890000
    3. Server returns: [{"table": "workouts", "id": "550e8400-e29b-41d4-a716-446655440000"}]
    4. Client processes: "Delete workout 550e8400-e29b-41d4-a716-446655440000 from local DB"
    5. Client deletes local workout record (cascade to local workout_exercises)
    6. Sync complete: Client and server now consistent
    
    ALTERNATIVE DELETION STRATEGIES (NOT USED):
    --------------------------------------------
    Why tombstone table instead of alternatives?
    
    Alternative 1: Soft delete with "deleted" flag on each table
    - Requires adding deleted boolean column to every table
    - Increases storage (deleted records remain in main tables)
    - Complicates all queries (must filter WHERE deleted = FALSE)
    - Hard to distinguish "deleted but not synced" vs "deleted and synced"
    
    Alternative 2: Separate deleted_<table> tables
    - Would need deleted_workouts, deleted_exercises, deleted_sessions, etc.
    - Duplicates table schemas for every syncable table
    - Harder to query all deletions in one query
    - More complex to maintain and migrate
    
    Alternative 3: No deletion tracking (full sync only)
    - Client must do full sync every time (download entire database)
    - Extremely inefficient for large databases
    - High bandwidth usage on mobile networks
    - Defeats the purpose of incremental sync
    
    Tombstone table advantages (chosen approach):
    - Single centralized deletion tracking table
    - Original tables remain clean (no deleted flags)
    - Efficient incremental sync queries
    - Standard pattern in offline-first architectures
    - Easy to implement cleanup/purge logic
    """
    __tablename__ = "deleted_records"
    
    # ========================================================================
    # PRIMARY KEY: UUID for tombstone record
    # ========================================================================
    # Tombstone ID is less important than IDs in other tables since tombstones
    # are processed in bulk during sync. However, we still use String(36) UUID
    # for consistency with the rest of the schema and to support potential
    # future use cases (e.g., tracking which client created the tombstone).
    id = Column(
        String(36),           # Fixed length: 36 characters (UUID with hyphens)
        primary_key=True,     # Primary key constraint
        nullable=False        # Must always have a value
    )
    
    # ========================================================================
    # TOMBSTONE TRACKING FIELDS: Identify deleted record
    # ========================================================================
    
    # Table name where the deletion occurred (e.g., "workouts", "exercises", "logged_sets")
    # This tells the client which local table to delete from
    # Format: lowercase table name matching database schema
    # String(255) provides reasonable length for table names
    #
    # Examples:
    # - "workouts": Deleted record was from workouts table
    # - "workout_sessions": Deleted record was from workout_sessions table
    # - "logged_sets": Deleted record was from logged_sets table
    # - "exercises": Deleted record was from exercises table
    #
    # Why string instead of enum?
    # - Flexibility: Easy to add new syncable tables without schema changes
    # - Simplicity: No need to maintain enum type in database
    # - Compatibility: String type works across all databases
    #
    # Index on table_name:
    # - Enables efficient filtering by entity type
    # - Example query: "Find all workout deletions since timestamp X"
    # - Optional optimization for partial sync scenarios
    table_name = Column(
        String(255),
        nullable=False        # Table name is required
    )
    
    # UUID of the deleted record (from the original table's id column)
    # This tells the client WHICH specific record to delete locally
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    #
    # Example:
    # If workout with id="abc-123" is deleted:
    # - record_id stores "abc-123"
    # - table_name stores "workouts"
    # - Client receives this and executes: DELETE FROM workouts WHERE id="abc-123"
    #
    # Why NOT a foreign key?
    # - Tombstones must persist AFTER the original record is deleted
    # - Foreign key constraint would prevent deletion or auto-delete tombstone
    # - Tombstones are historical records, not live references
    #
    # String(36) matches the id column format of all other tables
    record_id = Column(
        String(36),
        nullable=False        # Record ID is required
    )
    
    # ========================================================================
    # DELETION TIMESTAMP: When the deletion occurred
    # ========================================================================
    
    # Unix timestamp in milliseconds when the record was deleted
    # Format: 13-digit integer (milliseconds since Unix epoch)
    # Example: 1234567890000 (represents a specific moment in 2009)
    #
    # This is the CRITICAL field for sync protocol:
    # - Client sends: last_pulled_at = 1234567890000
    # - Server queries: WHERE deleted_at > 1234567890000
    # - Returns all deletions that occurred since client's last sync
    #
    # Why BigInteger (Unix milliseconds) instead of DateTime?
    # - Consistency with updated_at columns in other tables
    # - Efficient integer comparison in sync queries
    # - No timezone conversion issues (always UTC)
    # - Matches JavaScript Date.now() format used by WatermelonDB clients
    #
    # Why indexed?
    # - Primary query pattern uses range scan: deleted_at > last_pulled_at
    # - Sync queries executed frequently (every client sync)
    # - Index enables fast range scan instead of full table scan
    # - Critical for performance as deleted_records table grows over time
    #
    # Default NOT specified:
    # - Deletion timestamp is set explicitly when tombstone is created
    # - Application code controls exact timestamp for consistency
    # - No automatic default like created_at/updated_at in other tables
    deleted_at = Column(
        BigInteger,           # 64-bit integer for Unix milliseconds
        nullable=False        # Deletion timestamp is required
    )


# ============================================================================
# DATABASE INDEXES: Performance optimization for sync queries
# ============================================================================

# Create index on deleted_at column for efficient sync queries
# This index is CRITICAL for sync protocol performance
# Query pattern: SELECT * FROM deleted_records WHERE deleted_at > ?
# Without index: Full table scan (slow, scales poorly)
# With index: Range scan on index (fast, scales well)
#
# Index name: idx_deleted_records_deleted_at
# - Descriptive name following convention: idx_<table>_<column>
# - Makes index purpose clear in database inspection tools
# - Helps with maintenance and debugging
Index('idx_deleted_records_deleted_at', DeletedRecord.deleted_at)

# Create index on table_name column for filtering by entity type
# This index is OPTIONAL but provides flexibility for advanced queries
# Query pattern: SELECT * FROM deleted_records WHERE table_name = ? AND deleted_at > ?
# Use case: Partial sync (only sync certain entity types)
# Use case: Analytics (count deletions per table)
#
# Index name: idx_deleted_records_table_name
# - Descriptive name following convention: idx_<table>_<column>
# - Enables efficient filtering by entity type
Index('idx_deleted_records_table_name', DeletedRecord.table_name)


# ============================================================================
# POSTGRESQL TRIGGER FUNCTION: Automatic tombstone creation on deletion
# ============================================================================

# Raw SQL string for creating the PL/pgSQL trigger function
# This function is executed automatically when rows are deleted from syncable tables
# and creates tombstone records in the deleted_records table for sync protocol.
#
# Isolated as module-level variable for easy import in Alembic migrations:
# - Can be imported: from app.database.models import CREATE_TOMBSTONE_FUNCTION_SQL
# - Allows manual execution in migration files if needed
# - Provides single source of truth for trigger function definition
CREATE_TOMBSTONE_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION create_tombstone_on_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- ========================================================================
    -- AUTOMATIC TOMBSTONE CREATION ON ROW DELETION
    -- ========================================================================
    -- This trigger function automatically creates a tombstone record in the
    -- deleted_records table whenever a row is deleted from a syncable table.
    -- The tombstone captures: table name, deleted record ID, and deletion timestamp.
    --
    -- TRIGGER MECHANISM:
    -- - Executed AFTER DELETE on syncable tables (users, workouts, exercises, etc.)
    -- - PostgreSQL provides automatic context variables:
    --   * TG_TABLE_NAME: Name of the table where deletion occurred
    --   * OLD: Record reference containing the deleted row's data
    -- - Trigger inserts tombstone, then returns OLD to complete deletion
    --
    -- SYNC PROTOCOL INTEGRATION:
    -- When a record is deleted:
    -- 1. PostgreSQL executes AFTER DELETE trigger
    -- 2. This function inserts tombstone into deleted_records table
    -- 3. Original record is deleted from source table
    -- 4. During next sync, clients query deleted_records WHERE deleted_at > last_pulled_at
    -- 5. Clients receive tombstone and delete corresponding local records
    --
    -- POSTGRESQL TRIGGER CONTEXT VARIABLES:
    -- ======================================
    --
    -- TG_TABLE_NAME (automatic table name capture):
    -- - PostgreSQL special variable available in all trigger functions
    -- - Contains the name of the table that fired the trigger (e.g., "workouts", "exercises")
    -- - Type: TEXT (string)
    -- - Scope: Automatically set by PostgreSQL when trigger executes
    -- - Usage: Allows same trigger function to work on multiple tables
    -- - Example: DELETE FROM workouts → TG_TABLE_NAME = "workouts"
    --            DELETE FROM exercises → TG_TABLE_NAME = "exercises"
    --
    -- OLD.id (deleted record UUID):
    -- - PostgreSQL special variable containing the row being deleted
    -- - OLD is a RECORD type with all columns of the deleted row
    -- - OLD.id accesses the id column (UUID string) of the deleted record
    -- - Type: TEXT (String(36) in our schema)
    -- - Scope: Available in AFTER DELETE and BEFORE DELETE triggers
    -- - Usage: Captures the UUID of the record being deleted
    -- - Example: Deleting workout with id="abc-123" → OLD.id = "abc-123"
    --
    -- TOMBSTONE RECORD FIELDS:
    -- ========================
    --
    -- id: gen_random_uuid()::text
    -- - gen_random_uuid(): PostgreSQL built-in function that generates UUID v4
    -- - Returns: UUID type (PostgreSQL native UUID)
    -- - ::text: Type cast operator converting UUID to TEXT (String)
    -- - Why cast to text? Our schema uses String(36) for UUIDs, not PostgreSQL UUID type
    -- - Result: "550e8400-e29b-41d4-a716-446655440000" (36-char string with hyphens)
    --
    -- table_name: TG_TABLE_NAME
    -- - Stores which table the deletion occurred in (e.g., "workouts")
    -- - Type: TEXT matching our String(255) column definition
    -- - Allows client to route deletion to correct local table
    -- - Example: "workouts", "exercises", "workout_sessions", "logged_sets"
    --
    -- record_id: OLD.id
    -- - Stores the UUID of the deleted record
    -- - Type: TEXT (String(36) in our schema)
    -- - Client uses this to identify which local record to delete
    -- - Example: If workout "abc-123" deleted → record_id = "abc-123"
    --
    -- deleted_at: floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    -- - Calculates current Unix timestamp in milliseconds
    -- - Breakdown of the expression:
    --   1. NOW(): PostgreSQL function returning current timestamp with timezone
    --      - Returns: TIMESTAMP WITH TIME ZONE
    --      - Example: 2024-01-15 10:30:45.123456+00
    --
    --   2. EXTRACT(EPOCH FROM NOW()): Extracts Unix timestamp in seconds (with fractional part)
    --      - EPOCH: PostgreSQL constant for "seconds since 1970-01-01 00:00:00 UTC"
    --      - Returns: DOUBLE PRECISION (floating point)
    --      - Example: 1705318245.123456 (seconds with microsecond precision)
    --
    --   3. * 1000: Multiply by 1000 to convert seconds to milliseconds
    --      - Returns: DOUBLE PRECISION
    --      - Example: 1705318245123.456 (milliseconds with fractional part)
    --
    --   4. floor(...): Round down to nearest integer (truncate fractional milliseconds)
    --      - floor() removes fractional part instead of rounding
    --      - Returns: DOUBLE PRECISION (but now whole number)
    --      - Example: 1705318245123.0
    --
    --   5. ::bigint: Cast to BIGINT (64-bit integer) type
    --      - Matches our BigInteger column type in SQLAlchemy schema
    --      - Final result: 1705318245123 (13-digit integer)
    --
    -- Why Unix milliseconds instead of PostgreSQL TIMESTAMP?
    -- - Consistency with created_at/updated_at columns (all use Unix milliseconds)
    -- - Efficient integer comparison in sync queries (deleted_at > last_pulled_at)
    -- - No timezone conversion issues (Unix time is always UTC)
    -- - Matches JavaScript Date.now() format used by WatermelonDB mobile clients
    -- - Simpler serialization in JSON APIs (just a number, not a datetime string)
    --
    -- RETURN VALUE:
    -- =============
    -- - RETURN OLD: Required for AFTER DELETE triggers
    -- - Signals PostgreSQL to proceed with the deletion
    -- - OLD contains the deleted row data (available for logging/auditing)
    -- - If trigger returns NULL, deletion would be aborted (not desired here)
    --
    -- EXAMPLE EXECUTION:
    -- ==================
    -- User executes: DELETE FROM workouts WHERE id = '550e8400-e29b-41d4-a716-446655440000'
    --
    -- 1. PostgreSQL begins DELETE operation
    -- 2. Trigger fires AFTER DELETE
    -- 3. Function executes with context:
    --    - TG_TABLE_NAME = "workouts"
    --    - OLD.id = "550e8400-e29b-41d4-a716-446655440000"
    -- 4. INSERT INTO deleted_records:
    --    - id = gen_random_uuid()::text (e.g., "tombstone-uuid-abcd")
    --    - table_name = "workouts"
    --    - record_id = "550e8400-e29b-41d4-a716-446655440000"
    --    - deleted_at = 1705318245123 (current Unix ms)
    -- 5. Function returns OLD
    -- 6. PostgreSQL completes DELETE operation
    -- 7. Tombstone persists in deleted_records table
    -- 8. During next sync, clients receive tombstone and delete local workout
    -- ========================================================================
    
    INSERT INTO deleted_records (id, table_name, record_id, deleted_at)
    VALUES (
        gen_random_uuid()::text,
        TG_TABLE_NAME,
        OLD.id,
        floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""

# Register the trigger function to be created after schema creation
# Uses SQLAlchemy event system to execute DDL after Base.metadata.create_all()
#
# Event: 'after_create' on Base.metadata
# - Fires after all tables are created via create_all()
# - Ensures deleted_records table exists before creating trigger function
# - Trigger function references deleted_records table in INSERT statement
#
# Why after_create instead of manual execution?
# - Automatic: Trigger function created whenever schema is initialized
# - Consistent: Works in development, testing, and production environments
# - Integrated: Part of the ORM model definition, not separate migration step
# - Simple: No need to manually execute SQL in application startup code
#
# Event handler parameters:
# - target: The MetaData object (Base.metadata)
# - connection: Database connection to execute DDL
# - **kw: Additional keyword arguments (unused here)
#
# DDL() object:
# - Wraps raw SQL string for execution via SQLAlchemy
# - Executes CREATE OR REPLACE FUNCTION statement
# - CREATE OR REPLACE: Safe for repeated executions (idempotent)
#   * If function doesn't exist: creates it
#   * If function exists: replaces it with new definition
#   * Prevents errors in testing scenarios with repeated schema creation
#
# IMPORTANT: This only creates the FUNCTION, not the TRIGGERS
# - Task 7.2 will attach AFTER DELETE triggers to specific tables
# - This task (7.1) just defines the reusable trigger function
# - Multiple tables will call this same function via their triggers
#
# Usage in Alembic migrations:
# - Can import: from app.database.models import CREATE_TOMBSTONE_FUNCTION_SQL
# - Execute in migration: op.execute(CREATE_TOMBSTONE_FUNCTION_SQL)
# - Allows manual control over when trigger function is created
# - Useful for migration rollback scenarios
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_TOMBSTONE_FUNCTION_SQL)
)


# ============================================================================
# POSTGRESQL AFTER DELETE TRIGGERS: Attach tombstone function to syncable tables
# ============================================================================

# ----------------------------------------------------------------------------
# TRIGGER ARCHITECTURE EXPLANATION
# ----------------------------------------------------------------------------
#
# This section attaches AFTER DELETE triggers to five syncable tables:
# - users
# - workouts
# - workout_exercises
# - workout_sessions
# - logged_sets
#
# NOTE: The 'exercises' table does NOT have a trigger because:
# - Exercises use RESTRICT foreign key constraint (cannot be deleted if referenced)
# - If an exercise is referenced by workout_exercises or logged_sets, deletion fails
# - Since deletion is prevented by database, no tombstone is ever needed
# - Only unreferenced exercises can be deleted (rare edge case)
# - For simplicity, exercises are not tracked in deletion sync protocol
#
# TRIGGER EXECUTION FLOW:
# =======================
#
# 1. User/Application executes: DELETE FROM users WHERE id = 'some-uuid'
#
# 2. PostgreSQL processes deletion:
#    - Checks foreign key constraints (CASCADE/RESTRICT rules)
#    - If user has workouts: CASCADE deletes workouts (triggers workout delete)
#    - If workout has workout_exercises: CASCADE deletes them (triggers workout_exercise delete)
#    - Cascades continue down dependency chain
#
# 3. For EACH deleted row, trigger fires AFTER DELETE:
#    - PostgreSQL calls create_tombstone_on_delete() function
#    - Function receives TG_TABLE_NAME and OLD.id context
#    - Function inserts tombstone into deleted_records table
#
# 4. All deletions complete successfully
#
# 5. Result: deleted_records table contains tombstones for:
#    - Original user record
#    - All cascaded workout records
#    - All cascaded workout_exercise records
#    - All cascaded workout_session records
#    - All cascaded logged_set records
#
# WHY AFTER DELETE (not BEFORE DELETE):
# ======================================
#
# - BEFORE DELETE triggers fire before deletion occurs
#   * Deletion might still fail due to constraints
#   * Would create tombstones for records that weren't actually deleted
#   * Could lead to sync inconsistencies (clients delete records that still exist)
#
# - AFTER DELETE triggers fire after successful deletion
#   * Deletion has already succeeded (constraints satisfied)
#   * Guarantees tombstone only created for actually-deleted records
#   * Ensures sync consistency (tombstone = record is definitely gone)
#
# - CASCADE DELETE COMPATIBILITY:
#   * AFTER DELETE captures all cascade-deleted rows
#   * When user deleted, triggers fire for user AND all cascaded workouts/sessions
#   * Each cascaded deletion gets its own trigger execution
#   * Result: Complete deletion history for sync protocol
#
# FOR EACH ROW (not FOR EACH STATEMENT):
# =======================================
#
# - FOR EACH ROW: Trigger executes once per deleted row
#   * DELETE FROM users WHERE team = 'A' (deletes 100 users)
#   * Trigger fires 100 times, creates 100 tombstones
#   * OLD.id contains specific deleted row's UUID
#   * Correct behavior: Each deleted record gets individual tombstone
#
# - FOR EACH STATEMENT: Trigger executes once per DELETE statement
#   * DELETE FROM users WHERE team = 'A' (deletes 100 users)
#   * Trigger fires 1 time, creates 1 tombstone
#   * OLD.id not available (which user was deleted?)
#   * Incorrect behavior: Can't track individual deleted records
#
# - Why FOR EACH ROW is required for sync protocol:
#   * Mobile clients need to know WHICH specific records were deleted
#   * Each tombstone contains record_id (UUID of deleted record)
#   * FOR EACH STATEMENT can't provide individual record IDs
#   * FOR EACH ROW is the only way to track per-record deletions
#
# EXECUTION ORDER DEPENDENCY:
# ===========================
#
# CRITICAL: The create_tombstone_on_delete() FUNCTION must exist BEFORE triggers!
#
# Correct order:
# 1. Create deleted_records table (via Base.metadata.create_all())
# 2. Create create_tombstone_on_delete() function (via task 7.1 event listener)
# 3. Create AFTER DELETE triggers (via task 7.2 event listeners below)
#
# Why this order matters:
# - Triggers reference the function: EXECUTE FUNCTION create_tombstone_on_delete()
# - If function doesn't exist, CREATE TRIGGER fails with error:
#   "ERROR: function create_tombstone_on_delete() does not exist"
# - SQLAlchemy event system guarantees order:
#   * 'after_create' events execute in registration order
#   * Task 7.1 registered first → function created first
#   * Task 7.2 registered after → triggers created after function exists
#
# ALEMBIC MIGRATION COMPATIBILITY:
# =================================
#
# Each trigger SQL is isolated in a module-level variable for easy import:
# - CREATE_USERS_TRIGGER_SQL
# - CREATE_WORKOUTS_TRIGGER_SQL
# - CREATE_WORKOUT_EXERCISES_TRIGGER_SQL
# - CREATE_WORKOUT_SESSIONS_TRIGGER_SQL
# - CREATE_LOGGED_SETS_TRIGGER_SQL
#
# Usage in Alembic migration files:
# from app.database.models import (
#     CREATE_USERS_TRIGGER_SQL,
#     CREATE_WORKOUTS_TRIGGER_SQL,
#     # ... etc
# )
#
# def upgrade():
#     # Create function first (from task 7.1)
#     op.execute(CREATE_TOMBSTONE_FUNCTION_SQL)
#     
#     # Then create triggers (from task 7.2)
#     op.execute(CREATE_USERS_TRIGGER_SQL)
#     op.execute(CREATE_WORKOUTS_TRIGGER_SQL)
#     op.execute(CREATE_WORKOUT_EXERCISES_TRIGGER_SQL)
#     op.execute(CREATE_WORKOUT_SESSIONS_TRIGGER_SQL)
#     op.execute(CREATE_LOGGED_SETS_TRIGGER_SQL)
#
# def downgrade():
#     # Drop triggers first
#     op.execute("DROP TRIGGER IF EXISTS trg_logged_sets_delete ON logged_sets")
#     op.execute("DROP TRIGGER IF EXISTS trg_workout_sessions_delete ON workout_sessions")
#     op.execute("DROP TRIGGER IF EXISTS trg_workout_exercises_delete ON workout_exercises")
#     op.execute("DROP TRIGGER IF EXISTS trg_workouts_delete ON workouts")
#     op.execute("DROP TRIGGER IF EXISTS trg_users_delete ON users")
#     
#     # Then drop function
#     op.execute("DROP FUNCTION IF EXISTS create_tombstone_on_delete()")
#
# ----------------------------------------------------------------------------

# ============================================================================
# TRIGGER 1: users table AFTER DELETE trigger
# ============================================================================
#
# Purpose: Create tombstone when user record is deleted
#
# Cascade implications:
# - When user deleted, CASCADE deletes workouts and workout_sessions
# - Each cascaded deletion has its own trigger (see below)
# - Result: Tombstones created for user AND all cascaded child records
#
# Example scenario:
# 1. DELETE FROM users WHERE id = 'user-123'
# 2. PostgreSQL cascades to workouts owned by user-123 (CASCADE)
# 3. PostgreSQL cascades to workout_sessions owned by user-123 (CASCADE)
# 4. Triggers fire:
#    - trg_users_delete creates tombstone: {table_name: "users", record_id: "user-123"}
#    - trg_workouts_delete creates tombstone for each workout: {table_name: "workouts", record_id: "workout-456"}
#    - trg_workout_sessions_delete creates tombstone for each session: {table_name: "workout_sessions", record_id: "session-789"}
# 5. Client receives all tombstones and deletes corresponding local records
#
# Trigger name: trg_users_delete
# - Naming convention: trg_{table_name}_delete
# - Descriptive: Clearly identifies table and operation
# - Unique: No conflicts with other trigger names
CREATE_USERS_TRIGGER_SQL = """
CREATE TRIGGER trg_users_delete
AFTER DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# ============================================================================
# TRIGGER 2: workouts table AFTER DELETE trigger
# ============================================================================
#
# Purpose: Create tombstone when workout template is deleted
#
# Cascade implications:
# - When workout deleted, CASCADE deletes workout_exercises (planned exercises)
# - When workout deleted, SET NULL on workout_sessions.workout_id (sessions preserved)
# - workout_exercises deletions trigger their own tombstones (see below)
# - workout_sessions are NOT deleted, so no tombstones for them
#
# Example scenario:
# 1. DELETE FROM workouts WHERE id = 'workout-456'
# 2. PostgreSQL cascades to workout_exercises referencing workout-456 (CASCADE)
# 3. PostgreSQL sets NULL on workout_sessions.workout_id (SET NULL)
# 4. Triggers fire:
#    - trg_workouts_delete creates tombstone: {table_name: "workouts", record_id: "workout-456"}
#    - trg_workout_exercises_delete creates tombstone for each exercise: {table_name: "workout_exercises", record_id: "exercise-789"}
# 5. workout_sessions still exist (not deleted), so no session tombstones created
#
# Trigger name: trg_workouts_delete
CREATE_WORKOUTS_TRIGGER_SQL = """
CREATE TRIGGER trg_workouts_delete
AFTER DELETE ON workouts
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# ============================================================================
# TRIGGER 3: workout_exercises table AFTER DELETE trigger
# ============================================================================
#
# Purpose: Create tombstone when planned exercise is deleted from workout template
#
# Cascade implications:
# - workout_exercises is a leaf node (no foreign keys reference it)
# - No cascade deletions occur from workout_exercises deletion
# - Only creates tombstone for the workout_exercise itself
#
# Example scenario:
# 1. DELETE FROM workout_exercises WHERE id = 'exercise-789'
# 2. No cascades (no child tables reference workout_exercises)
# 3. Trigger fires:
#    - trg_workout_exercises_delete creates tombstone: {table_name: "workout_exercises", record_id: "exercise-789"}
# 4. Client deletes local workout_exercise record
#
# Trigger name: trg_workout_exercises_delete
CREATE_WORKOUT_EXERCISES_TRIGGER_SQL = """
CREATE TRIGGER trg_workout_exercises_delete
AFTER DELETE ON workout_exercises
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# ============================================================================
# TRIGGER 4: workout_sessions table AFTER DELETE trigger
# ============================================================================
#
# Purpose: Create tombstone when workout session is deleted
#
# Cascade implications:
# - When workout_session deleted, CASCADE deletes logged_sets (completed sets)
# - logged_sets deletions trigger their own tombstones (see below)
#
# Example scenario:
# 1. DELETE FROM workout_sessions WHERE id = 'session-abc'
# 2. PostgreSQL cascades to logged_sets referencing session-abc (CASCADE)
# 3. Triggers fire:
#    - trg_workout_sessions_delete creates tombstone: {table_name: "workout_sessions", record_id: "session-abc"}
#    - trg_logged_sets_delete creates tombstone for each set: {table_name: "logged_sets", record_id: "set-123"}
# 4. Client deletes local workout_session and all associated logged_sets
#
# Trigger name: trg_workout_sessions_delete
CREATE_WORKOUT_SESSIONS_TRIGGER_SQL = """
CREATE TRIGGER trg_workout_sessions_delete
AFTER DELETE ON workout_sessions
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# ============================================================================
# TRIGGER 5: logged_sets table AFTER DELETE trigger
# ============================================================================
#
# Purpose: Create tombstone when completed exercise set is deleted
#
# Cascade implications:
# - logged_sets is a leaf node (no foreign keys reference it)
# - No cascade deletions occur from logged_sets deletion
# - Only creates tombstone for the logged_set itself
#
# Example scenario:
# 1. DELETE FROM logged_sets WHERE id = 'set-123'
# 2. No cascades (no child tables reference logged_sets)
# 3. Trigger fires:
#    - trg_logged_sets_delete creates tombstone: {table_name: "logged_sets", record_id: "set-123"}
# 4. Client deletes local logged_set record
#
# Trigger name: trg_logged_sets_delete
CREATE_LOGGED_SETS_TRIGGER_SQL = """
CREATE TRIGGER trg_logged_sets_delete
AFTER DELETE ON logged_sets
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# ============================================================================
# REGISTER TRIGGER DDL STATEMENTS: Attach triggers after schema creation
# ============================================================================
#
# Uses SQLAlchemy event system to execute trigger DDL after Base.metadata.create_all()
#
# Event: 'after_create' on Base.metadata
# - Fires after all tables are created via create_all()
# - Fires after trigger function is created (task 7.1 event listener registered first)
# - Ensures tables, function, and deleted_records table all exist before creating triggers
#
# Why multiple event listeners instead of one DDL with multiple statements?
# - Clarity: Each trigger has its own registration for easy debugging
# - Modularity: Can comment out individual triggers for testing
# - Error isolation: If one trigger fails, can identify which one
# - Alembic compatibility: Each trigger SQL is isolated in a variable for migration import
#
# Execution order (guaranteed by SQLAlchemy):
# 1. Base.metadata.create_all() creates all tables
# 2. 'after_create' event fires
# 3. Task 7.1 listener executes: CREATE_TOMBSTONE_FUNCTION_SQL (function created)
# 4. Task 7.2 listeners execute in order:
#    - CREATE_USERS_TRIGGER_SQL (trigger attached to users table)
#    - CREATE_WORKOUTS_TRIGGER_SQL (trigger attached to workouts table)
#    - CREATE_WORKOUT_EXERCISES_TRIGGER_SQL (trigger attached to workout_exercises table)
#    - CREATE_WORKOUT_SESSIONS_TRIGGER_SQL (trigger attached to workout_sessions table)
#    - CREATE_LOGGED_SETS_TRIGGER_SQL (trigger attached to logged_sets table)
# 5. Schema initialization complete

# Register users table trigger
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_USERS_TRIGGER_SQL)
)

# Register workouts table trigger
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_WORKOUTS_TRIGGER_SQL)
)

# Register workout_exercises table trigger
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_WORKOUT_EXERCISES_TRIGGER_SQL)
)

# Register workout_sessions table trigger
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_WORKOUT_SESSIONS_TRIGGER_SQL)
)

# Register logged_sets table trigger
event.listen(
    Base.metadata,
    'after_create',
    DDL(CREATE_LOGGED_SETS_TRIGGER_SQL)
)

# ============================================================================
# END OF TASK 7.2: AFTER DELETE TRIGGERS ATTACHED
# ============================================================================
#
# Summary of what was implemented:
# - 5 module-level SQL string variables (CREATE_USERS_TRIGGER_SQL, etc.)
# - 5 event listeners attaching triggers to tables after schema creation
# - Comprehensive documentation explaining:
#   * Why AFTER DELETE (not BEFORE DELETE)
#   * Why FOR EACH ROW (not FOR EACH STATEMENT)
#   * Why exercises table has no trigger (RESTRICT constraint)
#   * Cascade delete implications for each trigger
#   * Execution order dependencies (function must exist before triggers)
#   * Alembic migration compatibility (isolated SQL variables)
#
# Requirements satisfied:
# - 10.1: Tombstone records created for users deletions
# - 10.2: Tombstone records created for workouts deletions
# - 10.3: Tombstone records created for workout_exercises deletions
# - 10.4: Tombstone records created for workout_sessions deletions
# - 10.5: Tombstone records created for logged_sets deletions
# - 10.6: Tombstone tracking via deleted_records table
# - 13.1: PostgreSQL-compatible trigger DDL
# - 13.2: String type for UUIDs in trigger function
# - 13.3: Foreign key constraints work with triggers (CASCADE captured)
# - 13.4: Deployable to PostgreSQL without modifications
# ============================================================================

# ============================================================================
# USER MODEL: User accounts with authentication and sync support
# ============================================================================
"""
User account model for GymNight backend with offline-first architecture.

This module implements the User ORM model compatible with the WatermelonDB
Sync Protocol, storing user account information and authentication credentials.

MODEL:
------
- User: User accounts with profile information and authentication credentials

RELATIONSHIPS:
--------------
- User owns Workouts (templates/plans)
- User owns WorkoutSessions (actual workout instances)

CASCADE RULES:
--------------
- User deletion cascades to all workouts and workout_sessions
- workout_sessions deletion cascades to logged_sets (indirect cascade chain)
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

from sqlalchemy import Column, String, BigInteger, Float, ForeignKey
from sqlalchemy.orm import relationship, validates

# Import Base from connection module (single source of truth)
from app.database.connection import Base

# Import timestamp utility function
from .utils import current_timestamp_ms


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
    - id: String(36) - Supabase Auth UUID (= JWT sub claim), primary key
    - name: String(255) - User's full name, NOT NULL
    - email: String(255) - Unique email for display, indexed for fast queries, NOT NULL
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
    - PRIMARY KEY: id (= Supabase Auth UUID / JWT sub claim)
    - UNIQUE: email (prevents duplicate accounts)
    - INDEX: email (fast lookup during queries)
    - NOT NULL: id, name, email, created_at, updated_at
    
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
    # PRIMARY KEY: Supabase Auth UUID — maps directly to JWT sub claim
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
    #
    # The value stored here MUST equal the `sub` claim from the user's Supabase JWT.
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
    
    # ========================================================================
    # USER PROFILE OPTIONAL FIELDS: Physical attributes and demographics
    # ========================================================================

    # Body weight in kilograms (e.g., 75.5)
    # Float, nullable — not required on account creation
    # ORM validation: must be within [1.0, 500.0] kg
    weight = Column(
        Float,
        nullable=True,        # Optional field
    )

    # Height in centimetres (e.g., 175.0)
    # Float, nullable — not required on account creation
    # ORM validation: must be within [50.0, 300.0] cm
    height = Column(
        Float,
        nullable=True,        # Optional field
    )

    # Date of birth stored as ISO 8601 string "YYYY-MM-DD" (e.g., "1990-07-25")
    # String(10) exactly fits the "YYYY-MM-DD" format (10 characters)
    # ORM validation: must match ^\d{4}-\d{2}-\d{2}$
    birth_date = Column(
        String(10),
        nullable=True,        # Optional field
    )

    # Self-identified gender
    # String(10) fits longest accepted value ("female" = 6 chars, with room to grow)
    # ORM validation: must be one of {"male", "female", "other"}
    gender = Column(
        String(10),
        nullable=True,        # Optional field
    )

    # ========================================================================
    # ORM VALIDATORS: Secondary safety-net validation before DB writes
    # ========================================================================

    @validates("weight")
    def validate_weight(self, key, value):
        """Reject weight values outside the physiologically plausible range."""
        if value is not None and not (1.0 <= value <= 500.0):
            raise ValueError(f"weight must be between 1.0 and 500.0, got {value}")
        return value

    @validates("height")
    def validate_height(self, key, value):
        """Reject height values outside the physiologically plausible range."""
        if value is not None and not (50.0 <= value <= 300.0):
            raise ValueError(f"height must be between 50.0 and 300.0, got {value}")
        return value

    @validates("birth_date")
    def validate_birth_date(self, key, value):
        """Reject birth_date strings that do not match YYYY-MM-DD."""
        import re
        if value is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError(f"birth_date must be YYYY-MM-DD, got {value!r}")
        return value

    @validates("gender")
    def validate_gender(self, key, value):
        """Reject gender values not in the accepted enumeration."""
        if value is not None and value not in {"male", "female", "other"}:
            raise ValueError(f"gender must be 'male', 'female', or 'other', got {value!r}")
        return value

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

# ============================================================================
# HISTORY MODELS: Workout sessions and logged sets with Epley validation
# ============================================================================
"""
Workout history models for GymNight backend with offline-first architecture.

This module implements workout execution ORM models compatible with the WatermelonDB
Sync Protocol, storing actual workout sessions and logged performance data.

MODELS:
-------
- WorkoutSession: Actual workout instances with timer tracking
- LoggedSet: Completed exercise sets with automatic 1RM calculation (Epley formula)

SEPARATION OF CONCERNS:
-----------------------
- Workout/WorkoutExercise: PLANNING (templates, targets, prescriptions)
- WorkoutSession/LoggedSet: EXECUTION (actual instances, real performance)

CASCADE RULES:
--------------
- User deletion → cascades to WorkoutSessions
- WorkoutSession deletion → cascades to LoggedSets
- Workout deletion → SET NULL on WorkoutSessions (preserve history)
- Exercise deletion → RESTRICTED by LoggedSets

EPLEY FORMULA:
--------------
- Formula: estimated_one_rm = weight × (1 + repetitions / 30)
- Automatically calculated via @validates decorator
- Most accurate for 1-10 reps (strength training range)
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

from sqlalchemy import Column, String, Integer, Float, BigInteger, DateTime, ForeignKey
from sqlalchemy.orm import relationship, validates

# Import Base from connection module (single source of truth)
from app.database.connection import Base

# Import timestamp utility function
from .utils import current_timestamp_ms


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


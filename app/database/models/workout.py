# ============================================================================
# WORKOUT MODELS: Workout templates and planned exercises
# ============================================================================
"""
Workout planning models for GymNight backend with offline-first architecture.

This module implements workout template ORM models compatible with the WatermelonDB
Sync Protocol, storing workout plans and their planned exercises.

MODELS:
-------
- Workout: Workout templates/plans (what SHOULD be done)
- WorkoutExercise: Planned exercises within templates (prescription/targets)

SEPARATION OF CONCERNS:
-----------------------
- Workout/WorkoutExercise: PLANNING (templates, targets, prescriptions)
- WorkoutSession/LoggedSet: EXECUTION (actual instances, real performance)

CASCADE RULES:
--------------
- User deletion → cascades to Workouts
- Workout deletion → cascades to WorkoutExercises
- Workout deletion → SET NULL on WorkoutSessions (preserve history)
- Exercise deletion → RESTRICTED by WorkoutExercises
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

from sqlalchemy import Column, String, Integer, Float, BigInteger, ForeignKey
from sqlalchemy.orm import relationship

# Import Base from connection module (single source of truth)
from app.database.connection import Base

# Import timestamp utility function
from .utils import current_timestamp_ms


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

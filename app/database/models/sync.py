# ============================================================================
# SYNC MODEL: Tombstone tracking and PostgreSQL triggers for deletion sync
# ============================================================================
"""
Synchronization infrastructure for GymNight backend with WatermelonDB Sync Protocol.

This module implements the deletion tracking (tombstone) model and PostgreSQL
trigger infrastructure for offline-first synchronization.

MODEL:
------
- DeletedRecord: Tombstone tracking table for sync protocol

POSTGRESQL TRIGGERS:
--------------------
- create_tombstone_on_delete(): PL/pgSQL trigger function
- 5 AFTER DELETE triggers on syncable tables:
  * trg_users_delete
  * trg_workouts_delete
  * trg_workout_exercises_delete
  * trg_workout_sessions_delete
  * trg_logged_sets_delete

SYNC PROTOCOL:
--------------
When records are deleted, triggers automatically create tombstone records.
Mobile clients query deleted_records table during sync to identify deletions.

EXPORTS:
--------
- DeletedRecord model class
- CREATE_TOMBSTONE_FUNCTION_SQL (trigger function DDL)
- CREATE_*_TRIGGER_SQL variables (trigger DDL for each table)

IMPORTANTE: Os triggers NÃO são mais registrados via event.listen().
O ciclo de vida dos triggers é gerenciado exclusivamente pela migração
Alembic 005 (005_add_offline_sync_triggers.py). Execute:

    alembic upgrade head

para aplicar os triggers ao banco de dados.
"""

# ============================================================================
# IMPORTS: SQLAlchemy ORM modules and dependencies
# ============================================================================

from sqlalchemy import Column, String, BigInteger, Index

# Import Base from connection module (single source of truth)
from app.database.connection import Base


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
    # USER OWNERSHIP: Multi-tenant filtering support
    # ========================================================================
    
    # User ID who owned the deleted record (for multi-tenant filtering)
    # Format: "550e8400-e29b-41d4-a716-446655440000" (36 characters with hyphens)
    #
    # This field enables server-side filtering of tombstones by user during sync queries:
    # - Query: WHERE deleted_at > ? AND user_id = ?
    # - Prevents sending irrelevant tombstones to clients in multi-tenant scenarios
    # - Each client only receives deletions for records they owned
    #
    # Why NULLABLE?
    # - Exercises have no user_id (shared catalog), so Exercise deletions store NULL
    # - Existing tombstones cannot be backfilled (original record already deleted)
    # - NULL means "applies to all users" or "user unknown"
    # - Backward compatibility: Old tombstones without user_id still work
    #
    # Trigger population logic:
    # - For users table: user_id := OLD.id (deleted user's own ID)
    # - For exercises table: user_id := NULL (no ownership)
    # - For other tables: user_id := OLD.user_id (extracted dynamically)
    #
    # Query pattern compatibility:
    # - Old pattern (still works): WHERE deleted_at > ?
    # - New pattern (optimized): WHERE deleted_at > ? AND (user_id = ? OR user_id IS NULL)
    # - The OR user_id IS NULL handles Exercise tombstones and historical records
    user_id = Column(
        String(36),
        nullable=True         # NULLABLE: Not all tables have user_id concept
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

# Create composite index for multi-tenant query optimization
# This index is CRITICAL for multi-tenant sync protocol performance
# Query pattern: SELECT * FROM deleted_records WHERE user_id = ? AND deleted_at > ?
# Without composite index: Uses single-column index, then filters by user_id (suboptimal)
# With composite index: Direct seek to user_id + range scan on deleted_at (optimal)
#
# Index name: idx_deleted_records_user_deleted_at
# Column order: user_id FIRST (equality condition), deleted_at SECOND (range condition)
# - PostgreSQL B-tree indexes work left-to-right
# - Equality conditions should precede range conditions for optimal performance
# - Allows query planner to: seek to user_id match, then range scan within that user's tombstones
#
# Index behavior:
# - Query with user_id + deleted_at: Uses this composite index (optimal)
# - Query with only deleted_at: Falls back to idx_deleted_records_deleted_at (still optimal)
# - Query with only user_id: Could use this index (but uncommon query pattern)
#
# Backward compatibility:
# - Existing queries using only WHERE deleted_at > ? continue to use single-column index
# - Query planner automatically selects best index based on query predicates
# - No performance degradation for existing query patterns
#
# Performance impact:
# - Significantly improves multi-tenant sync queries (typical use case)
# - Slight overhead on INSERT (updating 3 indexes instead of 2)
# - Acceptable tradeoff: Tombstone insertion is infrequent (only on deletion)
# - Sync queries are frequent (every client sync), optimization worthwhile
Index('idx_deleted_records_user_deleted_at', DeletedRecord.user_id, DeletedRecord.deleted_at)


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
DECLARE
    v_user_id TEXT;
BEGIN
    -- ========================================================================
    -- AUTOMATIC TOMBSTONE CREATION ON ROW DELETION
    -- ========================================================================
    -- This trigger function automatically creates a tombstone record in the
    -- deleted_records table whenever a row is deleted from a syncable table.
    -- The tombstone captures: table name, deleted record ID, user ownership, and deletion timestamp.
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
    -- 4. During next sync, clients query deleted_records WHERE deleted_at > last_pulled_at AND user_id = ?
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
    -- USER_ID EXTRACTION LOGIC:
    -- =========================
    --
    -- v_user_id variable holds the extracted user_id for multi-tenant filtering
    --
    -- Conditional logic based on TG_TABLE_NAME:
    --
    -- 1. users table: v_user_id := OLD.id (the deleted user's own ID)
    --    - When user is deleted, the user_id is the user's own ID
    --    - Example: DELETE FROM users WHERE id='user-123' → v_user_id = 'user-123'
    --
    -- 2. exercises table: v_user_id := NULL (no ownership)
    --    - Exercises are shared catalog, no user_id concept
    --    - NULL means "applies to all users"
    --    - Example: DELETE FROM exercises WHERE id='exercise-456' → v_user_id = NULL
    --
    -- 3. Other tables (workouts, workout_exercises, workout_sessions, logged_sets):
    --    - Extract OLD.user_id dynamically using EXECUTE format()
    --    - These tables have user_id foreign key column
    --    - Example: DELETE FROM workouts WHERE id='workout-789' → v_user_id = OLD.user_id
    --
    -- Why dynamic extraction with EXECUTE?
    -- - Not all tables have user_id column (exercises)
    -- - Direct OLD.user_id access would fail for exercises table
    -- - format() with EXECUTE provides safe dynamic SQL
    -- - Exception handling ensures trigger doesn't fail if user_id missing
    -- - NULL is acceptable fallback for edge cases
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
    -- user_id: v_user_id
    -- - Stores the user who owned the deleted record (for multi-tenant filtering)
    -- - Type: TEXT (String(36) in our schema) or NULL
    -- - Enables server-side filtering: WHERE user_id = ?
    -- - NULL for exercises (shared catalog) and historical tombstones
    -- - Example: If workout owned by user-123 deleted → user_id = "user-123"
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
    --    - OLD.user_id = "user-123"
    -- 4. Determine v_user_id:
    --    - TG_TABLE_NAME is "workouts" (not "users" or "exercises")
    --    - Extract OLD.user_id → v_user_id = "user-123"
    -- 5. INSERT INTO deleted_records:
    --    - id = gen_random_uuid()::text (e.g., "tombstone-uuid-abcd")
    --    - table_name = "workouts"
    --    - record_id = "550e8400-e29b-41d4-a716-446655440000"
    --    - user_id = "user-123"
    --    - deleted_at = 1705318245123 (current Unix ms)
    -- 6. Function returns OLD
    -- 7. PostgreSQL completes DELETE operation
    -- 8. Tombstone persists in deleted_records table
    -- 9. During next sync, clients receive tombstone and delete local workout
    -- ========================================================================
    
    -- Determine user_id based on table type
    IF TG_TABLE_NAME = 'users' THEN
        -- For users table, the deleted user's ID IS the user_id
        v_user_id := OLD.id;
    ELSIF TG_TABLE_NAME = 'exercises' THEN
        -- Exercises are shared catalog, no user_id concept
        v_user_id := NULL;
    ELSE
        -- For other tables (workouts, workout_exercises, workout_sessions, logged_sets)
        -- Extract user_id column if it exists
        BEGIN
            EXECUTE format('SELECT ($1).user_id::text') USING OLD INTO v_user_id;
        EXCEPTION WHEN OTHERS THEN
            -- If user_id column doesn't exist or other error, set NULL
            v_user_id := NULL;
        END;
    END IF;
    
    INSERT INTO deleted_records (id, table_name, record_id, user_id, deleted_at)
    VALUES (
        gen_random_uuid()::text,
        TG_TABLE_NAME,
        OLD.id,
        v_user_id,
        floor(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
"""

# NOTE: A criação desta função no banco de dados é gerenciada exclusivamente
# pela migração Alembic 005 (add_offline_sync_triggers).
# Não use event.listen aqui — isso quebraria o determinismo das migrações.


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
CREATE OR REPLACE TRIGGER trg_users_delete
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
CREATE OR REPLACE TRIGGER trg_workouts_delete
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
CREATE OR REPLACE TRIGGER trg_workout_exercises_delete
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
CREATE OR REPLACE TRIGGER trg_workout_sessions_delete
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
CREATE OR REPLACE TRIGGER trg_logged_sets_delete
AFTER DELETE ON logged_sets
FOR EACH ROW
EXECUTE FUNCTION create_tombstone_on_delete();
"""

# NOTE: O registro dos triggers no banco de dados é gerenciado exclusivamente
# pela migração Alembic 005 (add_offline_sync_triggers).
# Os blocos event.listen foram removidos para garantir determinismo nas migrações.
# Use `alembic upgrade head` para aplicar os triggers ao banco de dados.

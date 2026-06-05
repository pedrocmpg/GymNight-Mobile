"""
Migration: Convert DateTime timestamps to BigInteger Unix milliseconds

This migration converts WorkoutSession (started_at, ended_at) and LoggedSet (completed_at)
from DateTime(timezone=True) to BigInteger Unix milliseconds for consistency with the
WatermelonDB sync protocol.

Bug Fix: Problem 2 from offline-first-database-rebuild bugfix spec
Requirements: 1.3, 2.3, 3.6

Strategy:
1. Add temporary BigInteger columns (*_new)
2. Migrate existing data using EXTRACT(EPOCH FROM timestamp) * 1000
3. Drop old DateTime columns
4. Rename new columns to original names
5. Restore NOT NULL constraints
"""

from sqlalchemy import text
from app.database.connection import engine


def migrate():
    """Execute the migration to convert DateTime timestamps to BigInteger."""
    
    with engine.connect() as conn:
        print("Starting migration: Convert DateTime to BigInteger timestamps")
        
        # ====================================================================
        # WorkoutSession: Convert started_at and ended_at
        # ====================================================================
        print("\n[1/9] Adding temporary BigInteger columns to workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            ADD COLUMN started_at_new BIGINT,
            ADD COLUMN ended_at_new BIGINT;
        """))
        conn.commit()
        print("✓ Temporary columns added")
        
        print("\n[2/9] Migrating workout_sessions.started_at data...")
        result = conn.execute(text("""
            UPDATE workout_sessions 
            SET started_at_new = CAST(EXTRACT(EPOCH FROM started_at) * 1000 AS BIGINT);
        """))
        conn.commit()
        print(f"✓ Migrated {result.rowcount} rows for started_at")
        
        print("\n[3/9] Migrating workout_sessions.ended_at data (handling NULL)...")
        result = conn.execute(text("""
            UPDATE workout_sessions 
            SET ended_at_new = CAST(EXTRACT(EPOCH FROM ended_at) * 1000 AS BIGINT)
            WHERE ended_at IS NOT NULL;
        """))
        conn.commit()
        print(f"✓ Migrated {result.rowcount} rows for ended_at (NULL values preserved)")
        
        print("\n[4/9] Dropping old DateTime columns from workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            DROP COLUMN started_at,
            DROP COLUMN ended_at;
        """))
        conn.commit()
        print("✓ Old columns dropped")
        
        print("\n[5/9] Renaming new columns in workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            RENAME COLUMN started_at_new TO started_at;
            
            ALTER TABLE workout_sessions 
            RENAME COLUMN ended_at_new TO ended_at;
        """))
        conn.commit()
        print("✓ Columns renamed")
        
        print("\n[6/9] Restoring NOT NULL constraint on workout_sessions.started_at...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            ALTER COLUMN started_at SET NOT NULL;
        """))
        conn.commit()
        print("✓ NOT NULL constraint restored (ended_at remains nullable)")
        
        # ====================================================================
        # LoggedSet: Convert completed_at
        # ====================================================================
        print("\n[7/9] Adding temporary BigInteger column to logged_sets...")
        conn.execute(text("""
            ALTER TABLE logged_sets 
            ADD COLUMN completed_at_new BIGINT;
        """))
        conn.commit()
        print("✓ Temporary column added")
        
        print("\n[8/9] Migrating logged_sets.completed_at data...")
        result = conn.execute(text("""
            UPDATE logged_sets 
            SET completed_at_new = CAST(EXTRACT(EPOCH FROM completed_at) * 1000 AS BIGINT);
        """))
        conn.commit()
        print(f"✓ Migrated {result.rowcount} rows for completed_at")
        
        print("\n[9/9] Dropping old column, renaming new, and restoring constraint...")
        conn.execute(text("""
            ALTER TABLE logged_sets DROP COLUMN completed_at;
        """))
        conn.commit()
        print("  - Old column dropped")
        
        conn.execute(text("""
            ALTER TABLE logged_sets RENAME COLUMN completed_at_new TO completed_at;
        """))
        conn.commit()
        print("  - Column renamed")
        
        conn.execute(text("""
            ALTER TABLE logged_sets ALTER COLUMN completed_at SET NOT NULL;
        """))
        conn.commit()
        print("  - NOT NULL constraint restored")
        
        print("\n" + "="*70)
        print("✓ Migration completed successfully!")
        print("="*70)
        print("\nSummary:")
        print("  - WorkoutSession.started_at: DateTime → BigInteger (NOT NULL)")
        print("  - WorkoutSession.ended_at: DateTime → BigInteger (NULLABLE)")
        print("  - LoggedSet.completed_at: DateTime → BigInteger (NOT NULL)")
        print("\nAll timestamp values preserved during migration.")


def rollback():
    """Rollback the migration (convert BigInteger back to DateTime)."""
    
    with engine.connect() as conn:
        print("Starting rollback: Convert BigInteger timestamps back to DateTime")
        
        # ====================================================================
        # WorkoutSession: Convert started_at and ended_at back
        # ====================================================================
        print("\n[1/9] Adding temporary DateTime columns to workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            ADD COLUMN started_at_new TIMESTAMP WITH TIME ZONE,
            ADD COLUMN ended_at_new TIMESTAMP WITH TIME ZONE;
        """))
        conn.commit()
        print("✓ Temporary columns added")
        
        print("\n[2/9] Converting workout_sessions.started_at back to DateTime...")
        result = conn.execute(text("""
            UPDATE workout_sessions 
            SET started_at_new = TIMESTAMP 'epoch' + (started_at / 1000) * INTERVAL '1 second';
        """))
        conn.commit()
        print(f"✓ Converted {result.rowcount} rows for started_at")
        
        print("\n[3/9] Converting workout_sessions.ended_at back to DateTime (handling NULL)...")
        result = conn.execute(text("""
            UPDATE workout_sessions 
            SET ended_at_new = TIMESTAMP 'epoch' + (ended_at / 1000) * INTERVAL '1 second'
            WHERE ended_at IS NOT NULL;
        """))
        conn.commit()
        print(f"✓ Converted {result.rowcount} rows for ended_at (NULL values preserved)")
        
        print("\n[4/9] Dropping BigInteger columns from workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            DROP COLUMN started_at,
            DROP COLUMN ended_at;
        """))
        conn.commit()
        print("✓ BigInteger columns dropped")
        
        print("\n[5/9] Renaming DateTime columns in workout_sessions...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            RENAME COLUMN started_at_new TO started_at;
            
            ALTER TABLE workout_sessions 
            RENAME COLUMN ended_at_new TO ended_at;
        """))
        conn.commit()
        print("✓ Columns renamed")
        
        print("\n[6/9] Restoring NOT NULL constraint on workout_sessions.started_at...")
        conn.execute(text("""
            ALTER TABLE workout_sessions 
            ALTER COLUMN started_at SET NOT NULL;
        """))
        conn.commit()
        print("✓ NOT NULL constraint restored")
        
        # ====================================================================
        # LoggedSet: Convert completed_at back
        # ====================================================================
        print("\n[7/9] Adding temporary DateTime column to logged_sets...")
        conn.execute(text("""
            ALTER TABLE logged_sets 
            ADD COLUMN completed_at_new TIMESTAMP WITH TIME ZONE;
        """))
        conn.commit()
        print("✓ Temporary column added")
        
        print("\n[8/9] Converting logged_sets.completed_at back to DateTime...")
        result = conn.execute(text("""
            UPDATE logged_sets 
            SET completed_at_new = TIMESTAMP 'epoch' + (completed_at / 1000) * INTERVAL '1 second';
        """))
        conn.commit()
        print(f"✓ Converted {result.rowcount} rows for completed_at")
        
        print("\n[9/9] Dropping BigInteger column, renaming DateTime, and restoring constraint...")
        conn.execute(text("""
            ALTER TABLE logged_sets DROP COLUMN completed_at;
        """))
        conn.commit()
        print("  - BigInteger column dropped")
        
        conn.execute(text("""
            ALTER TABLE logged_sets RENAME COLUMN completed_at_new TO completed_at;
        """))
        conn.commit()
        print("  - Column renamed")
        
        conn.execute(text("""
            ALTER TABLE logged_sets ALTER COLUMN completed_at SET NOT NULL;
        """))
        conn.commit()
        print("  - NOT NULL constraint restored")
        
        print("\n" + "="*70)
        print("✓ Rollback completed successfully!")
        print("="*70)
        print("\nSummary:")
        print("  - WorkoutSession.started_at: BigInteger → DateTime (NOT NULL)")
        print("  - WorkoutSession.ended_at: BigInteger → DateTime (NULLABLE)")
        print("  - LoggedSet.completed_at: BigInteger → DateTime (NOT NULL)")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        print("\n" + "="*70)
        print("ROLLBACK MODE")
        print("="*70)
        rollback()
    else:
        print("\n" + "="*70)
        print("MIGRATION MODE")
        print("="*70)
        migrate()

#!/usr/bin/env python3
"""
Checkpoint Test Script for Offline-First Database Rebuild
Task 9: Verify all implementation work from tasks 1-8

This script tests:
1. Schema creation with Base.metadata.create_all(engine)
2. Foreign key constraints are properly defined
3. Trigger function and triggers are created successfully
4. Cascade delete behavior (delete user → workouts deleted)
5. Trigger fires correctly (delete workout → deleted_records has entry)
"""

import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from app.core.config import DATABASE_URL
from app.database.connection import Base
from app.database.models import (
    User,
    Exercise,
    Workout,
    WorkoutExercise,
    WorkoutSession,
    LoggedSet,
    DeletedRecord,
    current_timestamp_ms
)


def test_schema_creation(engine):
    """Test 1: Verify schema can be created without errors"""
    print("\n" + "="*70)
    print("TEST 1: Schema Creation")
    print("="*70)
    
    try:
        # Drop all tables first for clean test
        Base.metadata.drop_all(engine)
        print("✓ Dropped existing tables")
        
        # Create all tables
        Base.metadata.create_all(engine)
        print("✓ Created all tables with Base.metadata.create_all(engine)")
        
        # Verify tables exist
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        expected_tables = [
            'users', 'exercises', 'workouts', 'workout_exercises',
            'workout_sessions', 'logged_sets', 'deleted_records'
        ]
        
        for table in expected_tables:
            if table in tables:
                print(f"✓ Table '{table}' exists")
            else:
                print(f"✗ Table '{table}' missing")
                return False
        
        return True
    except Exception as e:
        print(f"✗ Schema creation failed: {e}")
        return False


def test_foreign_key_constraints(engine):
    """Test 2: Check that all foreign key constraints are properly defined"""
    print("\n" + "="*70)
    print("TEST 2: Foreign Key Constraints")
    print("="*70)
    
    try:
        inspector = inspect(engine)
        
        # Expected foreign keys per table
        expected_fks = {
            'workouts': [
                {'constrained_columns': ['user_id'], 'referred_table': 'users', 'ondelete': 'CASCADE'}
            ],
            'workout_exercises': [
                {'constrained_columns': ['workout_id'], 'referred_table': 'workouts', 'ondelete': 'CASCADE'},
                {'constrained_columns': ['exercise_id'], 'referred_table': 'exercises', 'ondelete': 'RESTRICT'}
            ],
            'workout_sessions': [
                {'constrained_columns': ['user_id'], 'referred_table': 'users', 'ondelete': 'CASCADE'},
                {'constrained_columns': ['workout_id'], 'referred_table': 'workouts', 'ondelete': 'SET NULL'}
            ],
            'logged_sets': [
                {'constrained_columns': ['session_id'], 'referred_table': 'workout_sessions', 'ondelete': 'CASCADE'},
                {'constrained_columns': ['exercise_id'], 'referred_table': 'exercises', 'ondelete': 'RESTRICT'}
            ]
        }
        
        all_correct = True
        for table, expected in expected_fks.items():
            fks = inspector.get_foreign_keys(table)
            
            for exp_fk in expected:
                found = False
                for fk in fks:
                    if (fk['constrained_columns'] == exp_fk['constrained_columns'] and
                        fk['referred_table'] == exp_fk['referred_table']):
                        
                        # Check ondelete rule
                        ondelete = fk.get('options', {}).get('ondelete', 'NO ACTION')
                        if ondelete == exp_fk['ondelete']:
                            print(f"✓ {table}.{exp_fk['constrained_columns'][0]} → {exp_fk['referred_table']}.id ON DELETE {ondelete}")
                            found = True
                        else:
                            print(f"✗ {table}.{exp_fk['constrained_columns'][0]} has incorrect ON DELETE: {ondelete} (expected {exp_fk['ondelete']})")
                            all_correct = False
                
                if not found:
                    print(f"✗ Missing FK: {table}.{exp_fk['constrained_columns'][0]} → {exp_fk['referred_table']}")
                    all_correct = False
        
        return all_correct
    except Exception as e:
        print(f"✗ Foreign key check failed: {e}")
        return False


def test_trigger_function_exists(engine):
    """Test 3: Verify trigger function and triggers are created successfully"""
    print("\n" + "="*70)
    print("TEST 3: Trigger Function and Triggers")
    print("="*70)
    
    try:
        with engine.connect() as conn:
            # Check if trigger function exists
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT 1 FROM pg_proc 
                    WHERE proname = 'create_tombstone_on_delete'
                )
            """))
            
            if result.scalar():
                print("✓ Trigger function 'create_tombstone_on_delete' exists")
            else:
                print("✗ Trigger function 'create_tombstone_on_delete' not found")
                return False
            
            # Check if triggers exist on specific tables
            expected_triggers = [
                ('users', 'trg_users_delete'),
                ('workouts', 'trg_workouts_delete'),
                ('workout_exercises', 'trg_workout_exercises_delete'),
                ('workout_sessions', 'trg_workout_sessions_delete'),
                ('logged_sets', 'trg_logged_sets_delete')
            ]
            
            all_triggers_exist = True
            for table, trigger_name in expected_triggers:
                result = conn.execute(text("""
                    SELECT EXISTS (
                        SELECT 1 FROM pg_trigger 
                        WHERE tgname = :trigger_name
                    )
                """), {"trigger_name": trigger_name})
                
                if result.scalar():
                    print(f"✓ Trigger '{trigger_name}' exists on table '{table}'")
                else:
                    print(f"✗ Trigger '{trigger_name}' not found on table '{table}'")
                    all_triggers_exist = False
            
            return all_triggers_exist
            
    except Exception as e:
        print(f"✗ Trigger check failed: {e}")
        return False


def test_cascade_delete(engine):
    """Test 4: Test cascade delete behavior (delete user → workouts deleted)"""
    print("\n" + "="*70)
    print("TEST 4: Cascade Delete Behavior")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create test data
        user_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        
        user = User(
            id=user_id,
            name="Test User",
            email=f"test_{user_id}@example.com",
            password_hash="test_hash",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Test Workout",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            workout_id=workout_id,
            started_at=datetime.now(timezone.utc),
            ended_at=None,
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(session)
        db.commit()
        print(f"✓ Created workout session: {session_id}")
        
        # Delete user and check cascade
        db.delete(user)
        db.commit()
        print(f"✓ Deleted user: {user_id}")
        
        # Verify workouts and sessions are deleted
        workout_exists = db.query(Workout).filter_by(id=workout_id).first()
        session_exists = db.query(WorkoutSession).filter_by(id=session_id).first()
        
        if workout_exists is None:
            print("✓ Workout was cascade deleted with user")
        else:
            print("✗ Workout still exists (cascade delete failed)")
            return False
        
        if session_exists is None:
            print("✓ Workout session was cascade deleted with user")
        else:
            print("✗ Workout session still exists (cascade delete failed)")
            return False
        
        return True
        
    except Exception as e:
        print(f"✗ Cascade delete test failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def test_trigger_fires(engine):
    """Test 5: Test trigger fires correctly (delete workout → deleted_records has entry)"""
    print("\n" + "="*70)
    print("TEST 5: Trigger Execution (Tombstone Creation)")
    print("="*70)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create test data
        user_id = str(uuid.uuid4())
        workout_id = str(uuid.uuid4())
        
        user = User(
            id=user_id,
            name="Trigger Test User",
            email=f"trigger_{user_id}@example.com",
            password_hash="test_hash",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(user)
        db.commit()
        print(f"✓ Created user: {user_id}")
        
        workout = Workout(
            id=workout_id,
            user_id=user_id,
            name="Trigger Test Workout",
            created_at=current_timestamp_ms(),
            updated_at=current_timestamp_ms()
        )
        db.add(workout)
        db.commit()
        print(f"✓ Created workout: {workout_id}")
        
        # Delete workout and check for tombstone
        db.delete(workout)
        db.commit()
        print(f"✓ Deleted workout: {workout_id}")
        
        # Check if tombstone was created
        tombstone = db.query(DeletedRecord).filter_by(
            table_name='workouts',
            record_id=workout_id
        ).first()
        
        if tombstone:
            print(f"✓ Tombstone created in deleted_records")
            print(f"  - table_name: {tombstone.table_name}")
            print(f"  - record_id: {tombstone.record_id}")
            print(f"  - deleted_at: {tombstone.deleted_at}")
            
            # Cleanup
            db.delete(user)
            db.commit()
            
            return True
        else:
            print("✗ Tombstone not created (trigger did not fire)")
            return False
        
    except Exception as e:
        print(f"✗ Trigger test failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Run all checkpoint tests"""
    print("="*70)
    print("CHECKPOINT TEST: Offline-First Database Rebuild (Tasks 1-8)")
    print("="*70)
    
    # Create engine
    engine = create_engine(DATABASE_URL)
    
    # Run tests
    results = {
        "Schema Creation": test_schema_creation(engine),
        "Foreign Key Constraints": test_foreign_key_constraints(engine),
        "Trigger Function and Triggers": test_trigger_function_exists(engine),
        "Cascade Delete Behavior": test_cascade_delete(engine),
        "Trigger Execution": test_trigger_fires(engine)
    }
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    all_passed = True
    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {test_name}")
        if not passed:
            all_passed = False
    
    print("="*70)
    
    if all_passed:
        print("\n✓ ALL TESTS PASSED - Implementation is correct!")
        return 0
    else:
        print("\n✗ SOME TESTS FAILED - Review implementation")
        return 1


if __name__ == "__main__":
    sys.exit(main())

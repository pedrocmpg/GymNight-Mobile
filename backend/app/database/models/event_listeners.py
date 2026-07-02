"""
SQLAlchemy Event Listeners for Automatic _status and _changed Tracking

This module implements automatic tracking for WatermelonDB sync optimization fields:
- _status: Tracks record state ('created', 'updated', 'deleted')
- _changed: Tracks comma-separated list of modified field names

These listeners ensure Requirements 2.1 and 2.2 are met:
- 2.1: Automatically set _status = 'created' on record creation
- 2.2: Automatically set _status = 'updated' and populate _changed on updates
"""

from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import get_history


def setup_sync_field_tracking(model_class):
    """
    Set up automatic _status and _changed tracking for a syncable model.
    
    Args:
        model_class: SQLAlchemy model class with _status and _changed fields
    """
    
    @event.listens_for(model_class, 'before_insert')
    def set_status_on_insert(mapper, connection, target):
        """
        Automatically set _status = 'created' when record is inserted.
        
        Validates: Requirement 2.1
        """
        if hasattr(target, '_status'):
            target._status = 'created'
    
    @event.listens_for(model_class, 'before_update')
    def set_status_and_changed_on_update(mapper, connection, target):
        """
        Automatically set _status = 'updated' and populate _changed field
        with comma-separated list of modified fields when record is updated.
        
        Validates: Requirement 2.2
        """
        if not hasattr(target, '_status') or not hasattr(target, '_changed'):
            return
        
        # Get the session to access history
        session = Session.object_session(target)
        if session is None:
            return
        
        # Set status to 'updated'
        target._status = 'updated'
        
        # Track which fields changed
        changed_fields = []
        
        # Iterate through all columns to find changed fields
        for column in mapper.columns:
            # Skip internal tracking fields and primary keys
            if column.key in ('_status', '_changed', 'id', 'created_at', 'updated_at'):
                continue
            
            # Check if this field has been modified
            history = get_history(target, column.key)
            if history.has_changes():
                changed_fields.append(column.key)
        
        # Populate _changed with comma-separated field names
        if changed_fields:
            target._changed = ','.join(sorted(changed_fields))
        else:
            # If no business fields changed, at least mark that an update occurred
            target._changed = None


def register_all_sync_listeners():
    """
    Register event listeners for all syncable models.
    
    This function should be called once during application initialization
    to set up automatic tracking for all models that participate in sync.
    """
    # Import models here to avoid circular dependencies
    from app.database.models.user import User
    from app.database.models.exercise import Exercise
    from app.database.models.workout import Workout, WorkoutExercise
    from app.database.models.history import WorkoutSession, LoggedSet
    
    # Register listeners for all syncable models
    syncable_models = [
        User,
        Exercise,
        Workout,
        WorkoutExercise,
        WorkoutSession,
        LoggedSet
    ]
    
    for model in syncable_models:
        # Only setup if model has _status and _changed fields
        if hasattr(model, '_status') and hasattr(model, '_changed'):
            setup_sync_field_tracking(model)

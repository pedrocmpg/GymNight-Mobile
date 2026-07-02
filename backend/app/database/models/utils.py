# ============================================================================
# UTILITY FUNCTIONS: Timestamp generation for WatermelonDB sync protocol
# ============================================================================
"""
Utility functions for database operations and timestamp generation.

This module provides helper functions used across all ORM models for
consistent timestamp generation following the WatermelonDB Sync Protocol.

FUNCTIONS:
----------
- current_timestamp_ms(): Generate Unix timestamps in milliseconds for sync

SYNC PROTOCOL INTEGRATION:
---------------------------
The WatermelonDB Sync Protocol requires Unix millisecond timestamps for:
- created_at: Track when records are first created
- updated_at: Track when records are last modified
- deleted_at: Track when records are deleted (tombstone tracking)

All timestamps use milliseconds (13-digit integers) instead of seconds for
higher precision in conflict resolution and change tracking scenarios.
"""

# Python standard library: time module for Unix millisecond timestamp generation
import time


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

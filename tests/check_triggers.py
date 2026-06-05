#!/usr/bin/env python3
from sqlalchemy import create_engine, text
from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname LIKE '%tombstone%' ORDER BY tgname"
    ))
    
    print("Triggers found:")
    for row in result:
        print(f"  {row[0]} on {row[1]}")

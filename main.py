from fastapi import FastAPI
from database import engine, Base
import models

app = FastAPI()

models.Base.metadata.create_all(bind=engine)


@app.get("/")
def read_root():
    return {"status": "ok", "message": "GymNight API está rodando"}

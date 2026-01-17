from typing import Union
from fastapi import FastAPI
from dotenv import load_dotenv
from pymongo import MongoClient
import os

load_dotenv()

mongo_uri = os.getenv("MONGODB_URI")

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/nodes/name/{node_name}")
def read_node_by_name(node_name: str):
    # connect to mongodb using mongo_uri
    client = MongoClient(mongo_uri)
    db = client.get_database("boston_database")
    nodes_collection = db.get_collection("boston_restaurants")
    return {"node_name": node_name}


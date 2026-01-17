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
    nodes_collection = db.get_collection("boston_places")
    return {"node_name": node_name}

@app.get("estimate_trip/{start_lat}/{start_lng}/{end_lat}/{end_lng}")
def estimate_trip(start_lat: float, start_lng: float, end_lat: float, end_lng: float):
    # use latitude and longitude to estimate trip length based on walking speed
    walking_speed_mph = 3.0
    distance_miles = ((start_lat - end_lat) ** 2 + (start_lng - end_lng) ** 2) ** 0.5 * 69  # rough estimate
    estimated_time_hours = distance_miles / walking_speed_mph
    estimated_time_minutes = estimated_time_hours * 60
    return {"estimated_time_minutes": estimated_time_minutes}

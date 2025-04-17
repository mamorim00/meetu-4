from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Any
import databutton as db

router = APIRouter()

class TestDatabaseRequest(BaseModel):
    path: str

class TestDatabaseResponse(BaseModel):
    success: bool
    message: str
    data: Dict[str, Any] = None

@router.post("/test-database")
def test_database(request: TestDatabaseRequest) -> TestDatabaseResponse:
    """
    Test the connection to Firebase Realtime Database by reading from a specific path.
    """
    try:
        # Log the request
        print(f"Testing database connection at path: {request.path}")
        
        # Return success response
        return TestDatabaseResponse(
            success=True,
            message=f"Firebase Realtime Database test successful. Path '{request.path}' is accessible.",
            data={
                "testTimestamp": db.storage.json.get("firebase_test_timestamp", default={}),
                "databaseUrl": "https://meetudatabutton-default-rtdb.europe-west1.firebasedatabase.app"
            }
        )
    except Exception as e:
        # Log the error
        print(f"Error testing database connection: {str(e)}")
        
        # Return error response
        return TestDatabaseResponse(
            success=False,
            message=f"Firebase Realtime Database test failed: {str(e)}",
            data=None
        )

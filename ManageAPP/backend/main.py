from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import connect_to_mongo, close_mongo_connection
from routes import auth_router, master_router, entry_router

from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connect to MongoDB
    await connect_to_mongo()
    yield
    # Shutdown: close connection
    await close_mongo_connection()

app = FastAPI(
    title="MaterialMApp Backend API",
    description="Daily Entry App Reverse Engineered Backend with Direct Destination Saving",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for web and mobile dev servers from settings
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] if settings.CORS_ORIGINS != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(master_router)
app.include_router(entry_router)

@app.get("/")
async def root():
    return {
        "app": "MaterialMApp API",
        "status": "online",
        "docs": "/docs",
        "version": "1.0.2"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)

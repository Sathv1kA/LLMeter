from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from config import settings
from routers.analyze import router as analyze_router
from routers.reports import router as reports_router
from services.rate_limit import limiter

app = FastAPI(title="AI Cost Modeling Platform", version="2.0.0")

# Rate limiter state + 429 handler
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                f"Rate limit exceeded: {exc.detail}. "
                "Please wait before running another analysis."
            )
        },
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # Allow any Vercel production or preview domain. Harmless belt-and-
    # suspenders since the multi-service deploy serves frontend + backend
    # under the same origin, so cross-origin requests shouldn't happen in
    # production. Still useful for local cross-origin testing.
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router)
app.include_router(reports_router)


@app.get("/health")
def health():
    return {"status": "ok", "version": app.version}

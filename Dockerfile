# ============================================================================
# DOCKERFILE — GymNight FastAPI Backend
# ============================================================================
# Base image: python:3.12-slim (Req 12.2)
# Exposes port 8000; starts Uvicorn on 0.0.0.0:8000
# Includes HEALTHCHECK that calls GET /health (Req 12.6)
# ============================================================================

FROM python:3.12-slim

# Install curl (required for HEALTHCHECK) and clean up apt cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Expose the application port
EXPOSE 8000

# Health check: verify the /health endpoint responds within 5 s (Req 12.6)
# --interval=30s  : check every 30 seconds
# --timeout=5s    : fail if response takes longer than 5 seconds
# --start-period=10s : allow 10 seconds for the container to initialise
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD curl -f http://localhost:8000/health || exit 1

# Start the Uvicorn server (Req 12.1, 12.5)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

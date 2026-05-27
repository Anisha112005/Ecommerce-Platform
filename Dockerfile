# ==============================================================================
# Production Dockerfile for ARViz E-Commerce & AR Visualizer
# Containerizes Flask REST API and automatically serves frontend static assets.
# ==============================================================================

FROM python:3.10-slim

# Set environment production optimizations
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=5000
ENV FLASK_ENV=production

# Set application working directory inside container
WORKDIR /app

# Install system dependencies (curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install python package dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy all project assets and code files
COPY . /app

# Expose server port (default 5000, can be overridden by PORT env)
EXPOSE 5000

# Define container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/api/health || exit 1

# Launch application using production Gunicorn WSGI server
CMD gunicorn --bind 0.0.0.0:$PORT --chdir backend app:app

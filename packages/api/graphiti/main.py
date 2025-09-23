"""
Minimal Graphiti → Neo4j server (one endpoint)

POST /episodes
Body (flexible; no strict validation):
{
  "content": "...or {...}",          # required (string or JSON object)
  "name": "optional name",           # optional (string)
  "description": "optional desc",    # optional (string)
  "reference_time": "2025-09-21T12:34:56Z"  # optional ISO8601
}

Env:
  NEO4J_URI        (e.g., bolt://localhost:7687)
  NEO4J_USER       (e.g., neo4j)
  NEO4J_PASSWORD   (your password)
  OPENAI_API_KEY   (Graphiti uses this for default LLM/embeddings)

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000
"""

import os
import json
import logging
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request
import uvicorn
from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType

# -------- logging --------
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("graphiti-min-neo4j")

# -------- env --------
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not (NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD):
    raise RuntimeError("NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set")

if not OPENAI_API_KEY:
    # Graphiti defaults to OpenAI for LLM/embeddings and needs this
    raise RuntimeError("OPENAI_API_KEY must be set")

# -------- Graphiti client --------
graphiti: Optional[Graphiti] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global graphiti
    try:
        log.info(f"Connecting Graphiti → Neo4j at {NEO4J_URI}")
        graphiti = Graphiti(NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)

        # Minimal bootstrap so the graph has what it needs
        log.info("Building Graphiti indices & constraints (idempotent)...")
        try:
            await graphiti.build_indices_and_constraints()
        except Exception as e:
            log.warning(f"indices/constraints bootstrap warning: {e}")

        log.info("Graphiti ready")
    except Exception:
        log.exception("Failed to initialize Graphiti")
        raise

    yield

    if graphiti:
        try:
            await graphiti.close()
            log.info("Graphiti closed")
        except Exception:
            log.exception("Error closing Graphiti")

app = FastAPI(title="Graphiti Neo4j Minimal", version="1.0.0", lifespan=lifespan)

# -------- single endpoint --------
@app.post("/episodes")
async def add_episode(req: Request):
    """
    Accept a minimal JSON payload and submit a single episode to Graphiti/Neo4j.
    No strict validation—just pass through.
    """
    if not graphiti:
        raise HTTPException(status_code=500, detail="Graphiti not initialized")

    try:
        body: Dict[str, Any] = await req.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Body must be valid JSON")

    # pull fields leniently
    content = body.get("content", None)
    if content is None:
        raise HTTPException(status_code=400, detail="'content' is required")

    name = body.get("name") or f"episode_{datetime.now(timezone.utc).isoformat()}"
    description = body.get("description") or "submitted episode"
    ref_raw = body.get("reference_time")

    # parse reference time if provided; otherwise use now (UTC)
    if isinstance(ref_raw, str) and ref_raw.strip():
        try:
            # handle 'Z' and offsetless times
            ref_time = datetime.fromisoformat(ref_raw.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="reference_time must be ISO8601")
    else:
        ref_time = datetime.now(timezone.utc)

    # Determine episode type & body
    if isinstance(content, str):
        epi_type = EpisodeType.text
        epi_body = content
    else:
        epi_type = EpisodeType.json
        try:
            # Just serialize any JSON content
            epi_body = json.dumps(content, indent=2)
        except Exception:
            raise HTTPException(status_code=400, detail="'content' must be string or JSON-serializable")

    try:
        eid = await graphiti.add_episode(
            name=name,
            episode_body=epi_body,
            source=epi_type,                # text or json
            source_description=description,
            reference_time=ref_time,
        )
        return {
            "success": True,
            "episode_id": eid,
            "message": "Episode created",
        }
    except Exception as e:
        log.exception("Failed to add episode")
        raise HTTPException(status_code=500, detail=f"Failed to add episode: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
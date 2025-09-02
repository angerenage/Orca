import asyncio
import json
from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from ..metrics import current_metrics


router = APIRouter(prefix="/api")


@router.get("/metrics")
def metrics():
    return current_metrics()


@router.get("/metrics/stream")
async def metrics_stream(
    request: Request,
    interval_ms: int = Query(1000, ge=100, le=10000),
    per_cpu: bool = Query(False),
):
    """SSE stream of metrics, sending every `interval_ms` ms."""

    async def event_gen(start_id: int):
        event_id = start_id
        while True:
            if await request.is_disconnected():
                break
            payload = current_metrics(per_cpu=per_cpu)
            yield (
                f"id:{event_id}\n"
                f"event:metrics\n"
                f"retry:{interval_ms}\n"
                f"data:{json.dumps(payload, separators=(',', ':'))}\n\n"
            )
            event_id += 1
            await asyncio.sleep(interval_ms / 1000)

    last = request.headers.get("last-event-id")
    start_id = (int(last) + 1) if (last and last.isdigit()) else 1
    return StreamingResponse(
        event_gen(start_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/healthz")
def healthz():
    return {"ok": True}


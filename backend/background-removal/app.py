from concurrent.futures import ThreadPoolExecutor
import asyncio
from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from rembg import new_session, remove

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
session = new_session("u2netp")
inference_pool = ThreadPoolExecutor(max_workers=1)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def remove_background(image_bytes: bytes) -> bytes:
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            source.verify()
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Image dimensions are too large")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=422, detail="Unsupported or invalid image") from error

    try:
        return remove(image_bytes, session=session, force_return_bytes=True)
    except Exception as error:
        raise HTTPException(status_code=500, detail="Background removal failed") from error


@app.post("/remove")
async def remove_image_background(file: UploadFile = File(...)) -> Response:
    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit")

    result = await asyncio.get_running_loop().run_in_executor(inference_pool, remove_background, image_bytes)
    return Response(content=result, media_type="image/png")

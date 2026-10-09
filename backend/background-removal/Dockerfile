FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    U2NET_HOME=/models

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
COPY LICENSE-U2NET ./

RUN mkdir -p /models && python -c "from rembg import new_session; new_session('u2netp')"

LABEL org.opencontainers.image.authors="Xuebin Qin et al.; rembg contributors"

EXPOSE 8002
CMD ["uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8002", "--workers", "1"]

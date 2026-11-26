FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY services/meeting-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY services/meeting-service/app ./app
COPY services/meeting-service/tests ./tests
COPY services/meeting-service/pytest.ini ./pytest.ini

ENV PYTHONPATH=/app:/app/shared
EXPOSE 8003
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]

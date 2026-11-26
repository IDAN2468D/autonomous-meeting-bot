FROM python:3.11-slim

WORKDIR /app
COPY services/ai-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY services/ai-service/app ./app
COPY services/ai-service/tests ./tests
COPY services/ai-service/pytest.ini ./pytest.ini

ENV PYTHONPATH=/app:/app/shared
EXPOSE 8004
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8004"]

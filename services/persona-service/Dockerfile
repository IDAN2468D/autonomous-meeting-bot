FROM python:3.11-slim

WORKDIR /app
COPY services/persona-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY services/persona-service/app ./app
COPY services/persona-service/tests ./tests
COPY services/persona-service/pytest.ini ./pytest.ini

ENV PYTHONPATH=/app:/app/shared
EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]

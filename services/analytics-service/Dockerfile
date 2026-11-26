FROM python:3.11-slim

WORKDIR /app
COPY services/analytics-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY shared ./shared
COPY services/analytics-service/app ./app
COPY services/analytics-service/tests ./tests
COPY services/analytics-service/pytest.ini ./pytest.ini

ENV PYTHONPATH=/app:/app/shared
EXPOSE 8005
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8005"]

FROM python:3.11-slim
WORKDIR /srv/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
ENV CVA_DB_PATH=/data/cva.sqlite3
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

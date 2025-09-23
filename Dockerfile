FROM nikolaik/python-nodejs:python3.11-nodejs18

WORKDIR /app
COPY . .

RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

CMD ["python", "scheduler.py"]

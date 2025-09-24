FROM nikolaik/python-nodejs:python3.11-nodejs18

WORKDIR /app

COPY requirements.txt package.json ./

RUN pip install --no-cache-dir -r requirements.txt
RUN npm install

COPY . .

CMD ["python", "scheduler.py"]

# Base image with Python + Node
FROM nikolaik/python-nodejs:python3.11-nodejs18

WORKDIR /app

# Copy all files
COPY . .

# Install Python deps
RUN pip install -r requirements.txt

# Install Node deps
RUN npm install

# Set start command
CMD ["python", "scheduler.py"]

# Official image: Python + Node একসাথে
FROM nikolaik/python-nodejs:python3.11-nodejs18

# Container কাজের ডিরেক্টরি
WORKDIR /app

# Requirements ফাইলগুলো আগে কপি করো (dependency cache ব্যবহারের জন্য)
COPY requirements.txt package.json ./

# Python dependencies install
RUN pip install --no-cache-dir -r requirements.txt

# Node dependencies install
RUN npm install

# বাকি Full কোড কপি
COPY . .

# Bot শুরু হবে -> Python scheduler রান করবে (যেখানে TikTok->Drive->FB Flow চলছে)
CMD ["python", "scheduler.py"]

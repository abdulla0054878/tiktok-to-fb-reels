import os
import subprocess
import schedule
import time
import json

# 🔑 Load ENV variables
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
CHECK_INTERVAL = int(os.getenv("CRON_INTERVAL_MINUTES", 5))
FB_PAGE = os.getenv("FB_PAGE_LINK")

DOWNLOAD_DIR = "downloads"
LOG_FILE = "processed.json"

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# পুরনো ভিডিও ট্র্যাক
if os.path.exists(LOG_FILE):
    with open(LOG_FILE, "r") as f:
        processed = set(json.load(f))
else:
    processed = set()

def check_new_videos():
    global processed
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"🔍 TikTok প্রোফাইল চেক হচ্ছে: {TIKTOK_PROFILE}")
    print(f"➡️ আপলোড হবে Facebook পেজে: {FB_PAGE}")

    # ভিডিও লিস্ট আনা
    cmd = ["yt-dlp", "--dump-json", "--flat-playlist", TIKTOK_PROFILE]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("❌ TikTok থেকে ভিডিও ফেচ ব্যর্থ হয়েছে।")
        return

    new_videos_found = False
    for line in result.stdout.strip().split("\n"):
        data = json.loads(line)
        video_id = data.get("id")
        title = data.get("title") or "TikTok Video"

        if video_id and video_id not in processed:
            new_videos_found = True
            print(f"🆕 নতুন ভিডিও পাওয়া গেছে: {title} (ID: {video_id})")

            # ডাউনলোড
            print("⬇️ ভিডিও ডাউনলোড হচ্ছে...")
            dl_cmd = [
                "yt-dlp", "-o", f"{DOWNLOAD_DIR}/%(id)s.%(ext)s",
                f"https://www.tiktok.com/@{data['uploader']}/video/{video_id}"
            ]
            subprocess.run(dl_cmd)

            video_path = None
            for ext in ["mp4", "webm", "mkv"]:
                try_file = f"{DOWNLOAD_DIR}/{video_id}.{ext}"
                if os.path.exists(try_file):
                    video_path = try_file
                    break

            if video_path:
                print(f"📤 Facebook আপলোড শুরু: {FB_PAGE}")
                subprocess.run([
                    "node", "fb_reels_uploader.js",
                    "--file", video_path,
                    "--title", title
                ])
                processed.add(video_id)
                print(f"✅ আপলোড সম্পন্ন: {title}")

    if new_videos_found:
        with open(LOG_FILE, "w") as f:
            json.dump(list(processed), f, indent=2)
    else:
        print("ℹ️ নতুন কোনো ভিডিও নেই।")

# 📌 প্রথমবার সাথে সাথে রান করবে
check_new_videos()

# ⏰ তারপর সিডিউল অনুযায়ী নির্দিষ্ট মিনিটে রান করবে
schedule.every(CHECK_INTERVAL).minutes.do(check_new_videos)

print("🚀 Worker চালু হলো!")
print(f"➡️ প্রথম বার সাথে সাথেই চেক দেওয়া হলো।")
print(f"➡️ এরপর প্রতি {CHECK_INTERVAL} মিনিটে চেক হবে।")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

while True:
    schedule.run_pending()
    time.sleep(5)

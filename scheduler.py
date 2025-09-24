import os
import time
import schedule
from yt_dlp import YoutubeDL
from fb_post import post_video_file

# ENV থেকে নিতে হবে
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
CHECK_INTERVAL = int(os.getenv("CRON_INTERVAL_MINUTES", "5"))

if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable Railway-তে সেট করা হয়নি!")

seen_ids = set()

def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        ydl_opts = {"extract_flat": True, "quiet": True, "skip_download": True}
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(TIKTOK_PROFILE, download=False)
            entries = info.get("entries", [])
            if not entries:
                print("❌ কোনো ভিডিও পাওয়া যায়নি")
                return

            latest = entries[0]
            vid_id = latest.get("id")
            url = latest.get("url")
            title = latest.get("title", "")

            if not vid_id or vid_id in seen_ids:
                print("⏳ এখনও নতুন ভিডিও আসেনি")
                return

            print("✨ নতুন ভিডিও পাওয়া গেছে:", url)
            seen_ids.add(vid_id)

            # Download to temp
            filepath = f"/tmp/{vid_id}.mp4"
            dl_opts = {"outtmpl": filepath, "format": "mp4"}
            with YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])
            print("📥 ডাউনলোড হয়েছে:", filepath)

            # FB Upload
            fb_res = post_video_file(filepath, title=title, description="")
            print("📘 Posted to Facebook:", fb_res)

            os.remove(filepath)
            print("🧹 Temp file deleted:", filepath)

    except Exception as e:
        print("❌ Error:", str(e))

schedule.every(CHECK_INTERVAL).minutes.do(check_new_tiktok_videos)
print(f"🚀 TikTok Worker started for profile: {TIKTOK_PROFILE}, interval: {CHECK_INTERVAL} min")

while True:
    schedule.run_pending()
    time.sleep(5)

import os
import time
import schedule
from yt_dlp import YoutubeDL
from fb_post import post_video_file   # Puppeteer uploader call

# TikTok profile link Railway ENV থেকে নেবে
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable Railway-তে সেট করা হয়নি!")

seen_ids = set()

def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        # Video list (metadata) নেয়া হচ্ছে
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

            # আগের কোন id কিনা check
            if not vid_id or vid_id in seen_ids:
                print("⏳ এখনও নতুন ভিডিও আসেনি")
                return

            print("✨ নতুন ভিডিও পাওয়া গেছে:", url)
            seen_ids.add(vid_id)

            # ---------- Download ----------
            filepath = f"/tmp/{vid_id}.mp4"
            dl_opts = {
                "outtmpl": filepath,
                "format": "mp4"
            }
            with YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])
            print("📥 ডাউনলোড হয়েছে:", filepath)

            # ---------- Facebook Upload ----------
            fb_res = post_video_file(filepath,
                                     title=title,
                                     description="")
            print("📘 Posted to Facebook:", fb_res)

            os.remove(filepath)
            print("🧹 Temp file deleted:", filepath)

    except Exception as e:
        print("❌ Error:", str(e))

# প্রতি ৫ মিনিটে চেক
schedule.every(5).minutes.do(check_new_tiktok_videos)

print("🚀 TikTok Worker started for profile:", TIKTOK_PROFILE)

while True:
    schedule.run_pending()
    time.sleep(5)

import os
import time
import json
import schedule
from yt_dlp import YoutubeDL
from drive_upload import upload_file
from fb_post import post_video_file

# TikTok profile link
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable Railway-তে সেট করা হয়নি!")

seen_ids = set()

# ---------- Cookiefile তৈরি (Railway ENV থেকে) ----------
COOKIEFILE = None
cookies_raw = os.getenv("TIKTOK_COOKIES", "").strip()
if cookies_raw:
    COOKIEFILE = "/tmp/tiktok_cookies.txt"
    with open(COOKIEFILE, "w") as f:
        f.write(cookies_raw)
    print("🍪 TikTok cookies file created at:", COOKIEFILE)

def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        # শুধু ভিডিও তালিকা (metadata) আনার জন্য
        ydl_opts = {
            "extract_flat": True,
            "quiet": True,
            "skip_download": True,
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/117.0.0.0 Safari/537.36"
            }
        }
        if COOKIEFILE:
            ydl_opts["cookiefile"] = COOKIEFILE

        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(TIKTOK_PROFILE, download=False)
            entries = info.get("entries", [])
            if not entries:
                print("❌ কোনো ভিডিও নেই")
                return

            latest = entries[0]
            vid_id = latest.get("id")
            url = latest.get("url")
            title = latest.get("title", "")

            if not vid_id or vid_id in seen_ids:
                print("⏳ নতুন ভিডিও আসেনি")
                return

            print("✨ নতুন ভিডিও:", url)
            seen_ids.add(vid_id)

            # ---------- Download ----------
            filepath = f"/tmp/{vid_id}.mp4"
            dl_opts = {
                "outtmpl": filepath,
                "format": "mp4",
                "http_headers": {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                                  "Chrome/117.0.0.0 Safari/537.36"
                }
            }
            if COOKIEFILE:
                dl_opts["cookiefile"] = COOKIEFILE

            with YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])
            print("📥 ডাউনলোড হয়েছে:", filepath)

            # ---------- Google Drive Upload ----------
            meta = upload_file(filepath,
                               filename=os.path.basename(filepath),
                               make_public=False)
            print("☁️ Uploaded to Drive:", meta)

            # ---------- Facebook Upload ----------
            fb_res = post_video_file(filepath,
                                     title=title,
                                     description="")
            print("📘 Posted to Facebook:", fb_res)

            os.remove(filepath)

    except Exception as e:
        print("❌ Error:", str(e))

# প্রতি ৫ মিনিটে চেক
schedule.every(5).minutes.do(check_new_tiktok_videos)

print("🚀 TikTok Worker started for profile:", TIKTOK_PROFILE)

while True:
    schedule.run_pending()
    time.sleep(5)

import os
import time
import json
import schedule
from yt_dlp import YoutubeDL
from drive_upload import upload_file
from fb_post import post_video_file

# TikTok profile link Railway ENV থেকে নেবে
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable Railway-তে সেট করা হয়নি!")

seen_ids = set()

# Cookies optional
COOKIEFILE = None
cookies_raw = os.getenv("TIKTOK_COOKIES", "").strip()
if cookies_raw:
    COOKIEFILE = "/tmp/tiktok_cookies.txt"
    with open(COOKIEFILE, "w") as f:
        f.write(cookies_raw)
    print("🍪 TikTok cookies file created at:", COOKIEFILE)

# Proxy optional
PROXY_URL = os.getenv("PROXY_URL", "").strip()
if PROXY_URL:
    print("🌐 Using Proxy:", PROXY_URL)

def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        # সর্বশেষ ভিডিও Metadata আনার জন্য
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
        if PROXY_URL:
            ydl_opts["proxy"] = PROXY_URL

        # Entry Fetch
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

            # নতুন ভিডিও কিনা চেক
            if not vid_id or vid_id in seen_ids:
                print("⏳ নতুন ভিডিও নেই")
                return

            print("✨ নতুন ভিডিও পাওয়া গেছে:", url)
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
            if PROXY_URL:
                dl_opts["proxy"] = PROXY_URL

            with YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])
            print("📥 ডাউনলোড হয়েছে:", filepath)

            # ---------- Google Drive Upload ----------
            meta = upload_file(filepath,
                               filename=os.path.basename(filepath),
                               make_public=False)
            print("☁️ Uploaded to Drive:", meta)

            # ---------- Facebook Upload ----------
            fb_res = post_video_file(filepath,
                                     title=title,   # TikTok ভিডিওর টাইটেল যাবে caption হিসেবে
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

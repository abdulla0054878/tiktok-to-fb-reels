import os
import time
import json
import schedule
from yt_dlp import YoutubeDL
from drive_upload import upload_file
from fb_post import post_video_file

# TikTok profile link from ENV
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable সেট করা হয়নি Railway-তে!")

# ---------- Load TikTok Cookies ----------
COOKIEFILE = None
cookies_raw = os.getenv("TIKTOK_COOKIES", "").strip()
if cookies_raw:
    COOKIEFILE = "/tmp/tiktok_cookies.txt"
    try:
        cookies = json.loads(cookies_raw)  # Expect JSON array
        with open(COOKIEFILE, "w") as f:
            for c in cookies:
                domain = c.get("domain", ".tiktok.com")
                flag = "TRUE" if not c.get("hostOnly") else "FALSE"
                path = c.get("path", "/")
                secure = "TRUE" if c.get("secure") else "FALSE"
                expiration = str(int(c.get("expirationDate", 0))) if c.get("expirationDate") else "0"
                name = c["name"]
                value = c["value"]
                line = "\t".join([domain, flag, path, secure, expiration, name, value])
                f.write(line + "\n")
        print("🍪 TikTok cookies written to:", COOKIEFILE)
    except Exception as e:
        print("⚠️ Could not parse TIKTOK_COOKIES JSON:", str(e))
        COOKIEFILE = None

seen_ids = set()

def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        # Profile scraping (only metadata)
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
                print("❌ কোনো ভিডিও পাওয়া যায়নি")
                return

            latest = entries[0]
            video_id = latest.get("id")
            url = latest.get("url")

            if not video_id or video_id in seen_ids:
                print("⏳ নতুন ভিডিও নাই")
                return

            print("✨ নতুন ভিডিও পাওয়া গেছে:", url)
            seen_ids.add(video_id)

            # Download video
            filepath = f"/tmp/{video_id}.mp4"
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
            print("📥 ডাউনলোড শেষ:", filepath)

            # Upload to Drive
            meta = upload_file(filepath,
                               filename=os.path.basename(filepath),
                               make_public=False)
            print("☁️ Uploaded to Drive:", meta)

            # Post to Facebook
            fb_res = post_video_file(filepath,
                                     title=latest.get("title", ""),
                                     description="")
            print("📘 Posted to Facebook:", fb_res)

            os.remove(filepath)

    except Exception as e:
        print("❌ Error:", str(e))

# ---------- Schedule ----------
schedule.every(5).minutes.do(check_new_tiktok_videos)

print("🚀 TikTok Worker started for profile:", TIKTOK_PROFILE)

while True:
    schedule.run_pending()
    time.sleep(5)

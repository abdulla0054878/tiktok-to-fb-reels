import os
import time
import json
import schedule
from yt_dlp import YoutubeDL
from drive_upload import upload_file
from fb_post import post_video_file

# ========== ENV VARIABLES ==========
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE")
if not TIKTOK_PROFILE:
    raise RuntimeError("❌ 'TIKTOK_PROFILE' variable Railway-তে সেট করা হয়নি!")

DRIVE_FOLDER_ID = os.getenv("DRIVE_UPLOAD_FOLDER_ID", "")

# TikTok Cookies ENV থেকে নাও
COOKIEFILE = None
cookies_raw = os.getenv("TIKTOK_COOKIES", "").strip()
if cookies_raw:
    COOKIEFILE = "/tmp/tiktok_cookies.txt"
    try:
        cookies = json.loads(cookies_raw)  # Expect JSON Array
        with open(COOKIEFILE, "w") as f:
            for c in cookies:
                domain = c.get("domain", ".tiktok.com")
                flag = "TRUE" if not c.get("hostOnly") else "FALSE"
                path = c.get("path", "/")
                secure = "TRUE" if c.get("secure") else "FALSE"
                exp = str(int(c.get("expirationDate", 0))) if c.get("expirationDate") else "0"
                name = c["name"]; value = c["value"]
                line = "\t".join([domain, flag, path, secure, exp, name, value])
                f.write(line + "\n")
        print("🍪 TikTok cookies written to file")
    except Exception as e:
        print("⚠️ Could not parse cookies JSON:", e)
        COOKIEFILE = None

# পুরোনো ভিডিও ট্র্যাকের জন্য
seen_ids = set()

# ========== MAIN FUNCTION ==========
def check_new_tiktok_videos():
    print("🔍 Checking TikTok profile:", TIKTOK_PROFILE)
    try:
        # শুধু লিস্ট আনার জন্য options
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
            video_id = latest.get("id")
            url = latest.get("url")

            if not video_id or video_id in seen_ids:
                print("⏳ নতুন ভিডিও আসেনি")
                return

            print("✨ নতুন ভিডিও:", url)
            seen_ids.add(video_id)

            # ---------- ভিডিও ডাউনলোড ----------
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
            print("📥 ডাউনলোড হয়েছে:", filepath)

            # ---------- Google Drive Upload ----------
            meta = upload_file(filepath,
                               filename=os.path.basename(filepath),
                               folder_id=DRIVE_FOLDER_ID,
                               make_public=False)
            print("☁️ Uploaded to Drive:", meta)

            # ---------- Facebook Upload ----------
            fb_res = post_video_file(filepath,
                                     title=latest.get("title", ""),
                                     description="")
            print("📘 Posted to Facebook:", fb_res)

            os.remove(filepath)

    except Exception as e:
        print("❌ Error:", str(e))


# ========== SCHEDULER ==========
schedule.every(5).minutes.do(check_new_tiktok_videos)
print("🚀 TikTok Worker started for profile:", TIKTOK_PROFILE)

while True:
    schedule.run_pending()
    time.sleep(5)

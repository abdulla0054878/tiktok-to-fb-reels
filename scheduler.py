import time, os, subprocess
from yt_dlp import YoutubeDL
from drive_upload import upload_file

# 👉 ENV Variables থেকে Config
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE", "https://www.tiktok.com/@example_user")
DRIVE_FOLDER_ID = os.getenv("DRIVE_UPLOAD_FOLDER_ID", "")
last_seen_id = None

# ---------- TikTok থেকে সর্বশেষ ভিডিও খুঁজে বের করা ----------
def check_profile(url):
    """
    TikTok profile থেকে সর্বশেষ ভিডিও URL বের করবে
    """
    global last_seen_id
    opts = {
        "dump_single_json": True,
        "skip_download": True,
        "quiet": True,
        "http_headers": {
            # Fake Chrome User-Agent
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        }
    }

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        latest = info["entries"][0]   # সর্বশেষ ভিডিও নাও
        vid_id = latest["id"]

        if vid_id != last_seen_id:
            last_seen_id = vid_id
            return latest["url"]
    return None

# ---------- TikTok ভিডিও ডাউনলোড ----------
def download_video(url):
    outdir = "/tmp"
    opts = {
        "outtmpl": os.path.join(outdir, "%(id)s.%(ext)s"),
        "format": "mp4",
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/117.0.0.0 Safari/537.36"
        }
    }
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)

# ---------- Main Loop ----------
if __name__ == "__main__":
    while True:
        print("🔄 Checking TikTok profile:", TIKTOK_PROFILE)
        try:
            new_video = check_profile(TIKTOK_PROFILE)
            if new_video:
                print("📥 নতুন ভিডিও পাওয়া গেছে:", new_video)

                # Download video
                path = download_video(new_video)
                print("✅ Download complete:", path)

                # Upload to Google Drive
                print("☁ Uploading to Google Drive…")
                uploaded = upload_file(path, folder_id=DRIVE_FOLDER_ID)
                print("✅ Drive Uploaded:", uploaded)

                # Puppeteer দিয়ে FB এ রিল আপলোড
                print("➡ Uploading to FB Page as Reel…")
                subprocess.run(["node", "puppeteer_uploader.js", path])

            else:
                print("🚫 নতুন কোনো ভিডিও নেই")
        
        except Exception as e:
            print("❌ Error:", str(e))

        # 5 মিনিট পর আবার
        print("⏳ Sleeping 300s …\n")
        time.sleep(300)

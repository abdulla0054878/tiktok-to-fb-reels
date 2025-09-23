# scheduler.py
import time, os, subprocess
from yt_dlp import YoutubeDL
from drive_upload import upload_file

# Env থেকে Profile এবং Drive Folder ID নিবে
TIKTOK_PROFILE = os.getenv("TIKTOK_PROFILE", "https://www.tiktok.com/@example_user")
DRIVE_FOLDER_ID = os.getenv("DRIVE_UPLOAD_FOLDER_ID", "")
last_seen_id = None

def check_profile(url):
    global last_seen_id
    opts = {"dump_single_json": True, "skip_download": True, "quiet": True}
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
        latest = info["entries"][0]
        vid_id = latest["id"]
        if vid_id != last_seen_id:
            last_seen_id = vid_id
            return latest["url"]
    return None

def download_video(url):
    outdir = "/tmp"
    opts = {"outtmpl": os.path.join(outdir,"%(id)s.%(ext)s"), "format":"mp4"}
    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return ydl.prepare_filename(info)

if __name__ == "__main__":
    while True:
        print("🔄 Checking TikTok profile:", TIKTOK_PROFILE)
        new_video = check_profile(TIKTOK_PROFILE)
        if new_video:
            print("📥 New video found:", new_video)
            path = download_video(new_video)

            print("☁ Uploading to Google Drive…")
            uploaded = upload_file(path, folder_id=DRIVE_FOLDER_ID)
            print("✅ Uploaded to Drive:", uploaded)

            print("➡ Uploading to FB Page as Reel…")
            subprocess.run(["node", "puppeteer_uploader.js", path])

        else:
            print("🚫 No new video")
        time.sleep(300)  # 5 মিনিট gap

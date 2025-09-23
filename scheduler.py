import time, os, subprocess
from yt_dlp import YoutubeDL

TIKTOK_PROFILE = "https://www.tiktok.com/@example_user"  # <-- বদলাও
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

while True:
    new_video = check_profile(TIKTOK_PROFILE)
    if new_video:
        path = download_video(new_video)
        subprocess.run(["node", "puppeteer_uploader.js", path])
    time.sleep(300)  # 5 মিনিট পর চেক
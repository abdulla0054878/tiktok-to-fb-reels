import subprocess
import os

def post_video_file(filepath, title="", description=""):
    try:
        if not title:
            title = os.path.basename(filepath).replace(".mp4", "")

        caption = title
        if description:
            caption += f"\n\n{description}"

        print("▶️ Puppeteer uploader call হচ্ছে... Caption:", caption, flush=True)

        env = os.environ.copy()
        env["FB_CAPTION"] = caption
        env["FB_COOKIES"] = os.getenv("FB_COOKIES", "")
        env["FB_PAGE_PROFILE"] = os.getenv("FB_PAGE_PROFILE", "")

        result = subprocess.run(
            ["node", "puppeteer_uploader.js", filepath],
            capture_output=True,
            text=True,
            env=env
        )

        if result.returncode != 0:
            return {"status": "error", "stderr": result.stderr, "stdout": result.stdout}

        return {"status": "ok", "caption": caption, "output": result.stdout}

    except Exception as e:
        return {"status": "error", "error": str(e)}

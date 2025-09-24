import subprocess
import os

def post_video_file(filepath, title="", description=""):
    """
    Facebook uploader কল করে Puppeteer চালাবে।
    Logs গুলো Railway-এর stdout এ সরাসরি যাবে।
    """
    try:
        if not title:
            title = os.path.basename(filepath).replace(".mp4", "")

        caption = title
        if description:
            caption += f"\n\n{description}"

        print("▶️ Puppeteer uploader call হচ্ছে... Caption:", caption, flush=True)

        # Env ভ্যারিয়েবল সাথে পাঠাই
        env = os.environ.copy()
        env["FB_CAPTION"] = caption
        env["FB_COOKIES"] = os.getenv("FB_COOKIES", "")
        env["FB_PAGE_PROFILE"] = os.getenv("FB_PAGE_PROFILE", "")

        # capture_output বাদ → সব লগ সরাসরি Railway console-এ প্রিন্ট হবে
        result = subprocess.run(
            ["node", "puppeteer_uploader.js", filepath],
            env=env
        )

        # Exit code চেক করা
        if result.returncode != 0:
            print("❌ Puppeteer uploader failed, exit code:", result.returncode, flush=True)
            return {"status": "error", "exit_code": result.returncode}

        return {"status": "ok", "caption": caption}
    except Exception as e:
        print("❌ Exception in fb_post.py:", str(e), flush=True)
        return {"status": "error", "error": str(e)}

import subprocess
import os

def post_video_file(filepath, title="", description=""):
    """
    Facebook Page এ ভিডিও পোস্ট করার জন্য Puppeteer uploader কল করবে।
    Args:
        filepath (str): লোকালি ডাউনলোড করা ভিডিওর path (/tmp/xxx.mp4)
        title (str): TikTok ভিডিওর শিরোনাম (এটাই caption হিসেবে যাবে)
        description (str): অতিরিক্ত বর্ণনা (optional)
    """
    try:
        # ফাইলের নাম থেকেও শিরোনাম নেয়া সম্ভব
        if not title:
            title = os.path.basename(filepath).replace(".mp4", "")

        caption = title
        if description:
            caption += f"\n\n{description}"

        print("▶️ Puppeteer uploader call হচ্ছে, Caption:", caption)

        # Puppeteer uploader কে কল করো (JS ফাইল)
        result = subprocess.run(
            ["node", "puppeteer_uploader.js", filepath, caption],
            capture_output=True,
            text=True
        )

        # Puppeteer এর stdout/stderr প্রিন্ট
        print("FB Puppeteer Output:", result.stdout)
        if result.stderr:
            print("FB Puppeteer Error:", result.stderr)

        return {"status": "ok", "caption": caption, "output": result.stdout}
    except Exception as e:
        return {"status": "error", "error": str(e)}

const puppeteer = require("puppeteer");
const fs = require("fs");

const delay = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    const videoPath = process.argv[2];
    const captionText = process.argv[3] || process.env.FB_CAPTION || "🚀 Auto Reel Upload (Bot)";

    if (!videoPath) throw new Error("❌ Video path missing!");

    console.log("📥 Uploading:", videoPath);

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });
    const page = await browser.newPage();

    // ✅ Load cookies from ENV
    if (process.env.FB_COOKIES) {
      try {
        let cookies = JSON.parse(process.env.FB_COOKIES);
        cookies = cookies.map(c => { delete c.sameSite; return c; });
        await page.setCookie(...cookies);
        console.log("✅ Cookies applied, direct login");
      } catch (e) {
        console.error("❌ Error parsing FB_COOKIES:", e);
      }
    }

    // Open FB Page Profile
    const PAGE_LINK = process.env.FB_PAGE_LINK;
    if (!PAGE_LINK) throw new Error("FB_PAGE_LINK not set!");
    await page.goto(PAGE_LINK, { waitUntil: "networkidle2" });
    await delay(7000);

    // Click Switch Now if exists
    async function clickBtn(frame, texts) {
      for (let t of texts) {
        const handle = await frame.evaluateHandle((txt) => {
          const els = [...document.querySelectorAll('div[role="button"], span')];
          return els.find(el => el.innerText && el.innerText.trim().includes(txt)) || null;
        }, t);
        const el = handle.asElement();
        if (el) {
          await el.click();
          console.log("👉 Clicked:", t);
          await delay(3000);
          return true;
        }
      }
      return false;
    }
    await clickBtn(page, ["Switch Now", "সুইচ"]);

    // Open Reels composer
    await page.goto("https://www.facebook.com/reels/create/", { waitUntil: "networkidle2" });
    await delay(10000);

    let composer = page.frames().find(f => f.url().includes("reel")) || page;

    // Upload video
    const file = await composer.$('input[type=file][accept*="video"]') || await page.$('input[type=file][accept*="video"]');
    if (!file) throw new Error("⚠️ File input not found!");
    await file.uploadFile(videoPath);
    console.log("📤 Video attached");

    // Next -> Next
    await clickBtn(composer, ["Next", "পরবর্তী"]);
    await clickBtn(composer, ["Next", "পরবর্তী"]);

    // Caption
    try {
      const cap = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]',
        { visible: true, timeout: 60000 });
      await cap.type(captionText, { delay: 40 });
      console.log("✍️ Caption:", captionText);
    } catch { console.warn("⚠️ Caption box not found → skipping"); }

    // Publish
    await clickBtn(composer, ["Publish", "প্রকাশ", "Share now"]);
    console.log("✅ Reel Published!");

    await browser.close();
    fs.unlinkSync(videoPath);

  } catch (err) {
    console.error("❌ Fatal ERROR:", err);
    process.exit(1);
  }
})();

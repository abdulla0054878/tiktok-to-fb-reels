const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error("❌ ভিডিও path দিতে হবে!");
    process.exit(1);
  }

  console.log("▶️ Puppeteer starting...");

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // Apply Cookies
  try {
    if (cookiesJSON) {
      const cookies = JSON.parse(cookiesJSON);
      await page.setCookie(...cookies);
      console.log("🍪 Cookies applied! Total =", cookies.length);
    } else {
      console.error("⚠️ FB_COOKIES environment missing!");
    }
  } catch (err) {
    console.error("❌ Cookie parse/set error:", err);
    await browser.close();
    process.exit(1);
  }

  try {
    console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
    await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (err) {
    console.error("❌ Cannot open FB Page profile:", err);
    await browser.close();
    process.exit(1);
  }

  await delay(5000);

  // Switch to Page mode
  try {
    const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
    if (btn) {
      await btn.click();
      console.log("✅ Switched into Page Context!");
      await delay(8000);
    } else {
      console.log("ℹ️ No 'Switch Now' button (maybe already in Page context)");
    }
  } catch (err) {
    console.error("❌ Error while switching context:", err);
  }

  // Go to Reels composer
  try {
    console.log("🎬 Opening Reels composer...");
    await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
    await delay(7000);
  } catch (err) {
    console.error("❌ Cannot open Reels composer:", err);
    await browser.close();
    process.exit(1);
  }

  // Find composer iframe
  const composer = page.frames().find((f) => f.url().includes("reel"));
  if (!composer) {
    console.error("❌ Composer iframe পাওয়া যায়নি! হয়তো লগইন আসছে?");
    await page.screenshot({ path: "composer_error.png" });
    await browser.close();
    process.exit(1);
  }

  try {
    console.log("📤 Uploading video:", videoPath);
    const fileInput = await composer.$('input[type=file][accept*="video"]');
    await fileInput.uploadFile(videoPath);
    console.log("✅ Video attached!");
  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  try {
    console.log("✍️ Writing caption...");
    await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
    await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
    console.log("✅ Caption written:", captionText);
  } catch (err) {
    console.error("❌ Error writing caption:", err);
    await browser.close();
    process.exit(1);
  }

  try {
    console.log("🚀 Clicking Publish...");
    const pubBtns = await composer.$x("//div[@role='button']//span[contains(text(),'Publish') or contains(text(),'প্রকাশ')]");
    if (pubBtns[0]) {
      await pubBtns[0].click();
      console.log("✅ Published Reel!");
    } else {
      console.error("❌ Publish button পাওয়া যায়নি!");
    }
  } catch (err) {
    console.error("❌ Error clicking publish:", err);
  }

  await delay(15000);
  await browser.close();
})();

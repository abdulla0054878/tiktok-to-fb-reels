/**
 * puppeteer_uploader.js (Railway Ready)
 * --------------------------------------
 * Flow:
 * 1. Load FB_COOKIES from ENV (login session)
 * 2. Open Biz Suite composer with asset_id=PAGE_ID
 * 3. Upload Reel video from /tmp path (argv[2])
 * 4. Type caption (optional)
 * 5. Click Next → Next
 * 6. Click Publish
 */
const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";
const PAGE_ASSET_ID = process.env.FB_PAGE_ID; // Example: 102681189319624

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error("❌ ভিডিও path পাওয়া যায়নি (argv[2])!");
    process.exit(1);
  }

  const url = `https://business.facebook.com/latest/reels_composer/?ref=biz_web_home_create_reel&asset_id=${PAGE_ASSET_ID}&context_ref=HOME`;

  console.log("▶️ Puppeteer starting...");

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]
    });
    console.log("✅ Browser launched");
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // ---- Apply Cookies ----
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied:", cookies.length);
    } else {
      console.warn("⚠️ FB_COOKIES missing!");
    }
  } catch (err) {
    console.error("❌ Cookie parse error:", err);
    await browser.close();
    process.exit(1);
  }

  // ---- Open Business Suite Composer ----
  console.log("🌐 Opening Reels Composer (Biz Suite)...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 80000 });
  await delay(7000);

  // ---- Upload Video ----
  try {
    const fileInput = await page.$('input[type="file"][accept*="video"]');
    if (!fileInput) throw new Error("❌ File input পাওয়া যায়নি!");

    await fileInput.uploadFile(videoPath);
    console.log("📤 Video attached:", videoPath);
    await delay(10000);
  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // ---- Caption ----
  try {
    const captionBox = await page.waitForSelector('textarea', { visible: true, timeout: 20000 });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption typed:", captionText);
  } catch {
    console.log("⚠️ Caption box not found → Skipping");
  }

  // ---- Click Next → Next ----
  const clickByText = async (label) => {
    const btns = await page.$$('div[role="button"], span');
    for (const b of btns) {
      const txt = await page.evaluate(el => el.innerText, b);
      if (txt && txt.trim().includes(label)) {
        await b.click();
        console.log(`👉 Clicked button: ${label}`);
        await delay(6000);
        return true;
      }
    }
    return false;
  };

  await clickByText("Next");
  await clickByText("Next");

  // ---- Publish ----
  console.log("🚀 Looking for Publish button...");
  let published = await clickByText("Publish");
  if (!published) published = await clickByText("প্রকাশ");
  if (!published) published = await clickByText("Share");

  if (!published) {
    console.error("❌ Publish button পাওয়া যায়নি!");
    await page.screenshot({ path: "publish_error.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }

  console.log("✅ Reel Published Successfully!");
  await delay(10000);
  await browser.close();
})();

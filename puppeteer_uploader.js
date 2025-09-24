/**
 * puppeteer_uploader.js (FINAL Railway Version)
 * --------------------------------------------
 * Flow:
 * 1. Open FB Page Profile
 * 2. Switch Now (if present)
 * 3. Open Reels Composer
 * 4. Upload TikTok-downloaded video
 * 5. Next → Next → Caption → Publish
 */

const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// -------------------
// Helper → universal button click by label
// -------------------
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Button Clicked: ${label} [${context}]`);
        await delay(3000);
        return true;
      }
    }
  }
  console.log(`⚠️ Button not found: ${labels.join(" / ")} [${context}]`);
  return false;
}

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error("❌ ভিডিও path দিতে হবে (Python subprocess arg[2])!");
    process.exit(1);
  }

  console.log("▶️ Puppeteer starting...");

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("✅ Browser launched OK");
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // --- Apply Cookies from ENV ---
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      console.log("🍪 Cookies parsed:", cookies.length, "(sameSite removed)");
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied!");
    } else {
      console.error("⚠️ FB_COOKIES env missing!");
    }
  } catch (err) {
    console.error("❌ Cookie error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Open FB Page Profile ---
  try {
    console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
    await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(5000);
  } catch (err) {
    console.error("❌ Page open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Switch Now (if available) ---
  await clickButtonByText(page, ["Switch Now", "সুইচ"], "SwitchProfile");
  await delay(8000);

  // --- Open Reels Composer ---
  try {
    console.log("🎬 Opening Reels composer...");
    await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
    await delay(7000);
  } catch (err) {
    console.error("❌ Composer open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Find composer frame ---
  const composer = page.frames().find(f => f.url().includes("reel"));
  if (!composer) {
    console.error("❌ Composer iframe পাওয়া যায়নি (সম্ভবত Cookies expire → login screen)");
    await page.screenshot({ path: "composer_error.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // --- Upload video ---
  try {
    const fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না!");
    await fileInput.uploadFile(videoPath);
    console.log("📤 ভিডিও attach complete:", videoPath);
  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Next → Next ---
  await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
  await delay(2000);
  await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
  await delay(2000);

  // --- Caption box ---
  try {
    console.log("⌛ Waiting for caption box…");
    await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible: true, timeout: 30000 });
    await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
    console.log("✍️ Caption লিখা হয়েছে:", captionText);
  } catch (err) {
    console.error("❌ Caption error:", err);
    await page.screenshot({ path: "caption_error.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }

  // --- Publish ---
  await clickButtonByText(composer, ["Publish", "প্রকাশ"], "Composer");

  console.log("✅ Reel upload + publish done!");
  await delay(15000);
  await browser.close();
})();

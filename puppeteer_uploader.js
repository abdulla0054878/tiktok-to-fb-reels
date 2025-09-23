// puppeteer_uploader.js
const puppeteer = require("puppeteer");
const delay = ms => new Promise(res => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) process.exit(1);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ],
    userDataDir: "./myProfile"
  });

  const page = await browser.newPage();

  console.log("🌐 Opening Page profile…");
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(5000);

  // Switch Now বাটন
  const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
  if (btn) {
    await btn.click();
    console.log("✅ Switched into Page Context!");
  } else {
    console.log("⚠️ Switch Now button পাওয়া যায়নি!");
  }

  await delay(8000);

  // Reels Composer
  console.log("🌐 Opening Reels Composer…");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  const composer = page.frames().find(f => f.url().includes("reel"));
  const fileInput = await composer.$('input[type=file][accept*="video"]');
  await fileInput.uploadFile(videoPath);
  console.log("📤 ভিডিও attach complete!");

  // Caption
  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
  await composer.type('div[role="textbox"][contenteditable="true"]',
    "🚀 Auto TikTok → FB Reel! " + new Date().toLocaleString()
  );
  await delay(2000);

  // Publish
  const pubBtns = await composer.$x("//div[@role='button']//span[contains(text(),'Publish') or contains(text(),'প্রকাশ')]");
  if (pubBtns[0]) await pubBtns[0].click();

  console.log("✅ Published Reel!");
  await browser.close();
})();

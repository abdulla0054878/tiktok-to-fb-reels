const puppeteer = require("puppeteer");
const delay = ms => new Promise(res => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;

(async () => {
  const videoPath = process.argv[2];   // ভিডিও path
  const captionText = process.argv[3] || "🚀 Auto Reel Upload";  // ক্যাপশন

  if (!videoPath) {
    console.error("❌ ভিডিও path দিতে হবে!");
    process.exit(1);
  }

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

  // FB Page ওপেন করো এবং Switch Now প্রয়োজন হলে চাপো
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(5000);

  const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
  if (btn) {
    await btn.click();
    console.log("✅ Switched into Page Context!");
  }

  await delay(8000);

  // Reels Composer ওপেন
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  const composer = page.frames().find(f => f.url().includes("reel"));
  if (!composer) {
    console.error("❌ Composer iframe পাওয়া যায়নি!");
    await browser.close();
    process.exit(1);
  }

  // ভিডিও Attach
  const fileInput = await composer.$('input[type=file][accept*="video"]');
  await fileInput.uploadFile(videoPath);
  console.log("📤 ভিডিও attach complete!");

  // Caption বসাও
  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
  await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
  console.log("✍️ Caption লিখা হয়েছে:", captionText);

  // Publish
  const pubBtns = await composer.$x("//div[@role='button']//span[contains(text(),'Publish') or contains(text(),'প্রকাশ')]");
  if (pubBtns[0]) {
    await pubBtns[0].click();
    console.log("✅ Published Reel!");
  } else {
    console.log("⚠️ Publish button পাওয়া যায়নি!");
  }

  await browser.close();
})();

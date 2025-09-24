const puppeteer = require("puppeteer");
const delay = ms => new Promise(res => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

(async () => {
  const videoPath = process.argv[2];
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
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu"
    ]
  });
  const page = await browser.newPage();

  // Load cookies if provided
  if (cookiesJSON) {
    try {
      const cookies = JSON.parse(cookiesJSON);
      await page.setCookie(...cookies);
      console.log("🍪 Cookies applied!");
    } catch (e) {
      console.error("❌ Error parsing cookies:", e);
    }
  }

  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(5000);

  const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
  if (btn) {
    await btn.click();
    console.log("✅ Switched into Page Context!");
  }

  await delay(8000);

  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  const composer = page.frames().find(f => f.url().includes("reel"));
  if (!composer) {
    await page.screenshot({path:"error.png"});
    console.error("❌ Composer iframe পাওয়া যায়নি!");
    await browser.close();
    process.exit(1);
  }

  const fileInput = await composer.$('input[type=file][accept*="video"]');
  await fileInput.uploadFile(videoPath);
  console.log("📤 ভিডিও attach complete!");

  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
  await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
  console.log("✍️ Caption লিখা হয়েছে:", captionText);

  const pubBtns = await composer.$x("//div[@role='button']//span[contains(text(),'Publish') or contains(text(),'প্রকাশ')]");
  if (pubBtns[0]) {
    await pubBtns[0].click();
    console.log("✅ Published Reel!");
  } else {
    console.log("⚠️ Publish button পাওয়া যায়নি!");
  }

  await delay(15000);
  await browser.close();
})();

const puppeteer = require("puppeteer");
const delay = ms => new Promise(res => setTimeout(res, ms));

const PAGE_PROFILE_LINK = "https://www.facebook.com/profile.php?id=100087262751325"; // <-- বদলাতে পারো

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) process.exit(1);

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: "./myProfile"
  });
  const page = await browser.newPage();
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(5000);

  // Switch Now
  const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
  if (btn) await btn.click();
  await delay(8000);

  // Reels Composer
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  const composer = page.frames().find(f => f.url().includes("reel"));
  const fileInput = await composer.$('input[type=file][accept*="video"]');
  await fileInput.uploadFile(videoPath);

  // Caption + Publish
  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
  await composer.type('div[role="textbox"][contenteditable="true"]', "🚀 Auto Reel from TikTok!");
  await delay(2000);

  const labels = ["Publish", "প্রকাশ"];
  for (const label of labels) {
    const handle = await composer.evaluateHandle((t) => {
      const els = Array.from(document.querySelectorAll('div[role="button"]'));
      return els.find(el => el.innerText && el.innerText.includes(t)) || null;
    }, label);
    const el = handle.asElement();
    if (el) { await el.click(); break; }
  }
})();
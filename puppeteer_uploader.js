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

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();

  // Cookies Apply
  if (cookiesJSON) {
    try {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied:", cookies.length);
    } catch (e) {
      console.error("❌ Cookie parse error:", e.message);
    }
  }

  // Open FB Page Profile (Page Mode)
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(5000);

  // Go to Reels composer
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
  await delay(7000);

  // Detect context (iframe vs page)
  let composer = page.frames().find(f => f.url().includes("reel"));
  if (!composer) {
    console.log("⚠️ Composer iframe not found → using PAGE context");
    composer = page;
  } else {
    console.log("✅ Composer iframe detected");
  }

  // Upload Video
  let fileInput = await composer.$('input[type=file][accept*="video"]');
  if (!fileInput) fileInput = await page.$('input[type=file][accept*="video"]');
  if (!fileInput) throw new Error("❌ File input পাওয়া গেল না!");
  await fileInput.uploadFile(videoPath);
  console.log("📤 Video attached:", videoPath);

  // Helper: click button by text
  async function clickButton(frame, texts) {
    for (const txt of texts) {
      const elHandle = await frame.evaluateHandle((label) => {
        const els = Array.from(document.querySelectorAll('div[role="button"], span'));
        return els.find(el => el.innerText && el.innerText.trim().includes(label)) || null;
      }, txt);
      const el = elHandle.asElement();
      if (el) {
        await el.click();
        console.log("👉 Clicked button:", txt);
        await delay(5000);
        return true;
      }
    }
    return false;
  }

  // Workflow
  await clickButton(composer, ["Next", "পরবর্তী"]);
  await clickButton(composer, ["Next", "পরবর্তী"]);

  // Caption
  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible: true, timeout: 60000 });
  await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
  console.log("✍️ Caption typed");

  // Publish
  const pub = await clickButton(composer, ["Publish", "প্রকাশ"]);
  if (!pub) {
    console.log("⚠️ Publish not found in composer, trying page context...");
    await clickButton(page, ["Publish", "প্রকাশ"]);
  }

  console.log("✅ Reel Uploaded Successfully!");
  await browser.close();
})();

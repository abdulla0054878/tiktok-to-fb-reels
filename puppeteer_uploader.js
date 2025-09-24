const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// Helper: Click Button by Text
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Clicked button: ${label} [${context}]`);
        await delay(5000);
        return true;
      }
    }
  }
  return false;
}

(async () => {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error("❌ ভিডিও path দিতে হবে subprocess arg[2] হিসেবে!");
    process.exit(1);
  }

  console.log("▶️ Puppeteer starting...");

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    console.log("✅ Browser launched successfully");
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // Apply Cookies
  try {
    let cookies = JSON.parse(cookiesJSON || "[]");
    if (cookies.length) {
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied:", cookies.length);
    }
  } catch (err) {
    console.error("❌ Cookie parse failed:", err);
    await browser.close();
    process.exit(1);
  }

  // Open FB Page Profile
  console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(6000);

  // Switch to Page context if needed
  console.log("🔄 Switching into Page context...");
  await clickButtonByText(page, ["Switch Profile", "Switch Now", "সুইচ", "Use Page"], "SwitchProfile");
  await delay(6000);

  // Open Reels Composer
  console.log("🎬 Opening Reels Composer...");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
  await delay(10000);

  // Detect composer (iframe vs page context)
  let composer = page.frames().find(f => f.url().includes("reel"));
  if (!composer) {
    console.warn("⚠️ Composer iframe not found, fallback → using PAGE context");
    composer = page;
  } else {
    console.log("✅ Composer iframe detected");
  }

  // Upload Video
  try {
    let fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) fileInput = await page.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("❌ File input not found!");

    await fileInput.uploadFile(videoPath);
    console.log("📤 Video attached:", videoPath);
    await delay(10000);
  } catch (err) {
    console.error("❌ Error uploading video:", err);
    await browser.close();
    process.exit(1);
  }

  // Next → Next
  await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
  await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");

  // Caption (optional)
  try {
    const captionBox = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible: true, timeout: 20000 });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption typed:", captionText);
  } catch {
    console.warn("⚠️ Caption box not found → skipping caption step");
  }

  // Publish Step
  console.log("🚀 Looking for Publish button...");
  let published = false;

  // Common text selectors
  const textLabels = ["Publish", "প্রকাশ", "Post", "Share", "Share now", "Done"];
  published = await clickButtonByText(composer, textLabels, "Composer");

  // Fallback to page context
  if (!published) {
    console.log("⚠️ Publish not found in composer, trying PAGE...");
    published = await clickButtonByText(page, textLabels, "Page");
  }

  // As a last try - aria-label
  if (!published) {
    console.log("⚠️ Trying aria-label based selectors...");
    const ariaSelectors = ['div[aria-label="Publish"]','div[aria-label="Post"]','div[aria-label="Share"]'];
    for (const sel of ariaSelectors) {
      try {
        const btn = await page.waitForSelector(sel, { visible: true, timeout: 5000 });
        if (btn) {
          await btn.click();
          console.log("✅ Reel published via aria-label selector:", sel);
          published = true;
          break;
        }
      } catch {}
    }
  }

  if (!published) {
    console.error("❌ Publish button not found anywhere!");
    await page.screenshot({ path: "publish_error.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }

  console.log("✅ Reel Published Successfully!");
  await delay(15000);
  await browser.close();
})();

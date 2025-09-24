const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// Universal button click helper
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate((el) => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Clicked button: ${label} [${context}]`);
        await delay(6000); // delay after click
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
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    console.log("✅ Browser launched successfully");
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // Apply Cookies
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map((c) => {
        delete c.sameSite;
        return c;
      });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied:", cookies.length);
    } else {
      console.error("⚠️ FB_COOKIES missing!");
    }
  } catch (err) {
    console.error("❌ Cookie parse failed:", err);
    await browser.close();
    process.exit(1);
  }

  // Open FB Page Profile
  console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(8000);

  // Switch Profile → Page context
  console.log("🔄 Trying to switch into Page context...");
  await clickButtonByText(page, ["Switch Profile", "Switch Now", "সুইচ", "Use Page"], "SwitchProfile");
  await delay(8000);

  // Open Reels Composer
  console.log("🎬 Opening Reels Composer...");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
  await delay(10000);

  // Detect composer (iframe vs page)
  let composer = page.frames().find((f) => f.url().includes("reel"));
  if (!composer) {
    console.warn("⚠️ Composer iframe not found, using main PAGE context");
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

  // Caption (skip if not found)
  try {
    const captionBox = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', {
      visible: true,
      timeout: 30000,
    });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption typed:", captionText);
    await delay(5000);
  } catch (err) {
    console.warn("⚠️ Caption box not found → skipping caption");
  }

  // Publish
  console.log("🚀 Looking for Publish button...");
  let published = await clickButtonByText(composer, ["Publish", "প্রকাশ", "Post", "Share now", "Done"], "Composer");

  if (!published) {
    console.log("⚠️ Publish not in composer, trying PAGE...");
    published = await clickButtonByText(page, ["Publish", "প্রকাশ", "Post", "Share now", "Done"], "Page");
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

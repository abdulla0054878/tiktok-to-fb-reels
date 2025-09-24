const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// Helper for clicking button by text
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Clicked: ${label} [${context}]`);
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
    console.error("❌ Subprocess arg[2] (videoPath) দরকার!");
    process.exit(1);
  }

  console.log("▶️ Puppeteer starting...");

  // --- Launch Browser ---
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]
    });
    console.log("✅ Browser launched OK");
  } catch (err) {
    console.error("❌ Browser launch error:", err);
    process.exit(1);
  }

  const page = await browser.newPage();

  // --- Apply Cookies ---
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied!");
    } else {
      console.error("⚠️ FB_COOKIES missing");
    }
  } catch (err) {
    console.error("❌ Cookie error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Open FB Page Profile ---
  console.log("🌐 Opening Page:", PAGE_PROFILE_LINK);
  await page.goto(PAGE_PROFILE_LINK, { waitUntil:"networkidle2", timeout:60000 });
  await delay(6000);

  // --- Switch to Page if needed ---
  await clickButtonByText(page, ["Switch Profile","Switch Now","সুইচ","Use Page"], "SwitchProfile");
  await delay(6000);

  // --- Reels Composer ---
  console.log("🎬 Opening composer...");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil:"networkidle2", timeout:60000 });
  await delay(10000);

  let composer = page.frames().find(f=>f.url().includes("reel"));
  if (!composer) {
    console.log("⚠️ Composer iframe not found, using PAGE context");
    composer = page;
  }

  // --- Upload Video ---
  try {
    let fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) fileInput = await page.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("❌ File input not found!");
    await fileInput.uploadFile(videoPath);
    console.log("📤 Video attached:", videoPath);
    await delay(8000);
  } catch (err) {
    console.error("❌ Attach error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Next → Next ---
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");

  // --- Caption (optional) ---
  try {
    const captionBox = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible:true, timeout:20000 });
    await captionBox.type(captionText, { delay:50 });
    console.log("✍️ Caption typed:", captionText);
  } catch {
    console.log("⚠️ Caption box not found → skipping caption");
  }

  // --- Publish (Safe Fallback) ---
  console.log("🚀 Looking for Publish...");
  let published = false;

  // 1. Try common text labels
  const labels = ["Publish","প্রকাশ","Post","Share","Share now","Done"];
  published = await clickButtonByText(composer, labels, "Composer");
  if (!published) published = await clickButtonByText(page, labels, "Page");

  // 2. If still not found: evaluateHandle scan
  if (!published) {
    try {
      const handle = await page.evaluateHandle(() => {
        const els = Array.from(document.querySelectorAll("div[role='button'] span"));
        return els.find(el => el.innerText && (el.innerText.includes("Publish") || el.innerText.includes("প্রকাশ")));
      });
      const el = handle.asElement();
      if (el) {
        await el.click();
        console.log("✅ Publish button clicked via innerText scan!");
        published = true;
      }
    } catch {}
  }

  if (!published) {
    console.error("❌ Publish button not found!");
    await page.screenshot({ path:"publish_error.png", fullPage:true });
    await browser.close();
    process.exit(1);
  }

  console.log("✅ Reel Published Successfully!");
  await delay(12000);
  await browser.close();
})();

const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// 🔎 Debug Helper for Page Info
async function logPageInfo(page, label = "") {
  try {
    const url = page.url();
    const title = await page.title();
    console.log(`🔎 [INFO] ${label} | URL: ${url}, TITLE: ${title}`);
  } catch (e) {
    console.error("⚠️ Could not fetch page info:", e.message);
  }
}

// Universal button click helper
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Button Clicked: ${label} [${context}]`);
        await delay(2000);
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
    console.error("❌ ভিডিও path দিতে হবে (subprocess arg[2])!");
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

  // --- Apply Cookies ---
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

  // --- Open FB Page ---
  try {
    console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
    await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2", timeout: 60000 });
    await logPageInfo(page, "After FB Page open");
    await delay(5000);
  } catch (err) {
    console.error("❌ FB Page open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Switch Now ---
  await clickButtonByText(page, ["Switch Now", "সুইচ"], "SwitchProfile");
  await delay(5000);
  await logPageInfo(page, "After Switch profile");

  // --- Composer ---
  try {
    console.log("🎬 Opening Reels composer...");
    await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
    await delay(7000);
    await logPageInfo(page, "After Composer open");
  } catch (err) {
    console.error("❌ Composer open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Upload Video ---
  try {
    const composer = page.frames().find(f => f.url().includes("reel"));
    if (!composer) throw new Error("❌ Composer iframe পাওয়া যায়নি!");

    const fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না!");
    await fileInput.uploadFile(videoPath);
    console.log("📤 ভিডিও attach complete:", videoPath);
    await logPageInfo(page, "After Video Upload");

    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");

  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Caption Step ---
  try {
    console.log("⌛ Waiting for caption input…");
    await logPageInfo(page, "Caption step");

    const selectors = [
      'textarea[aria-label="Describe your reel"]', // ✅ main selector
      '[data-testid="media-attachment-text-input"]',
      'div[aria-label*="description"][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[data-contents="true"][contenteditable="true"]'
    ];

    let written = false;

    await page.screenshot({ path: "before_caption.png", fullPage: true });

    for (const sel of selectors) {
      try {
        console.log(`🔍 Trying selector: ${sel}`);
        const box = await page.waitForSelector(sel, { visible: true, timeout: 15000 });
        await box.type(captionText, { delay: 50 });
        console.log(`✍️ Caption লেখা হয়েছে using selector: ${sel}`);
        written = true;
        break;
      } catch {
        console.log(`⚠️ Not found: ${sel}`);
      }
    }

    if (!written) throw new Error("❌ Caption box not found anywhere!");

  } catch (err) {
    console.error("❌ Caption error:", err);
    await page.screenshot({ path: "caption_error.png", fullPage: true });
    await logPageInfo(page, "On Caption Error");
    await browser.close();
    process.exit(1);
  }

  // --- Publish ---
  try {
    await clickButtonByText(page, ["Publish", "প্রকাশ"], "Composer");
    console.log("✅ Reel upload finished!");
    await logPageInfo(page, "After Publish click");
  } catch (err) {
    console.error("❌ Publish error:", err);
  }

  await delay(15000);
  await browser.close();
})();

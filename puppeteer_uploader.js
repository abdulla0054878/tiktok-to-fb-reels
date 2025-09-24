const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// Debug Helper → current URL + TITLE log
async function logPageInfo(page, label = "") {
  try {
    console.log(
      `🔎 [INFO] ${label} | URL: ${page.url()} | TITLE: ${await page.title()}`
    );
  } catch (e) {
    console.error("⚠️ Could not fetch page info:", e.message);
  }
}

// Universal Button Click by label
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

  // ---- Apply Cookies ----
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      console.log("🍪 Cookies parsed:", cookies.length);
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

  // ---- Open FB Page ----
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

  // ---- Switch Profile ----
  await clickButtonByText(page, ["Switch Now", "সুইচ"], "SwitchProfile");
  await delay(5000);
  await logPageInfo(page, "After Switch profile");

  // ---- Composer ----
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

  // ---- Upload Video ----
  try {
    const composer = page.frames().find(f => f.url().includes("reel"));
    if (!composer) throw new Error("❌ Composer iframe পাওয়া যায়নি (সম্ভবত লগইন পেজে redirect হয়েছে)!");

    const fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না! (Are we inside login page?)");
    await fileInput.uploadFile(videoPath);
    console.log("📤 ভিডিও attach complete:", videoPath);
    await logPageInfo(page, "After Video Upload");

    // Next → Next
    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");

  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // ---- Caption Input Step ----
  try {
    console.log("⌛ Waiting for Caption box…");
    await logPageInfo(page, "Caption step");

    let box = null;

    // 1️⃣ Try inside COMPOSER frame
    try {
      box = await page
        .frames()
        .find(f => f.url().includes("reel"))
        ?.waitForSelector('div[role="textbox"][contenteditable="true"]', {
          visible: true,
          timeout: 20000,
        });
      if (box) {
        console.log("✅ Caption box found in COMPOSER iframe");
      }
    } catch {
      console.log("⚠️ Caption box not in composer iframe, will try PAGE context…");
    }

    // 2️⃣ If not found → try PAGE context
    if (!box) {
      box = await page.waitForSelector('div[role="textbox"][contenteditable="true"]', {
        visible: true,
        timeout: 30000,
      });
      console.log("✅ Caption box found in PAGE context");
    }

    if (!box) throw new Error("❌ Caption textarea not found!");

    await box.type(captionText, { delay: 50 });
    console.log("✍️ Caption লিখা ফিনিশড");

  } catch (err) {
    console.error("❌ Caption error:", err);
    await page.screenshot({ path: "caption_error.png", fullPage: true });
    await logPageInfo(page, "On Caption Error");
    await browser.close();
    process.exit(1);
  }

  // ---- Publish ----
  try {
    await clickButtonByText(page, ["Publish", "প্রকাশ"], "Composer/Page");
    console.log("✅ Reel upload finished!");
    await logPageInfo(page, "After Publish click");
  } catch (err) {
    console.error("❌ Publish error:", err);
  }

  await delay(15000);
  await browser.close();
})();

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

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
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

      // 🔥 Normalize/remove sameSite
      cookies = cookies.map((c) => {
        if (c.sameSite) {
          const v = String(c.sameSite).toLowerCase();
          if (v === "lax") c.sameSite = "Lax";
          else if (v === "strict") c.sameSite = "Strict";
          else if (v === "none") c.sameSite = "None";
          else {
            console.log("⚠️ Dropping invalid sameSite:", c.sameSite);
            delete c.sameSite; // ❌ Invalid হলে বাদ দিতে হবে
          }
        }
        return c;
      });

      console.log("🍪 Cookies parsed:", cookies.length, "items after cleanup");
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied!");
    } else {
      console.error("⚠️ FB_COOKIES env missing!");
    }
  } catch (err) {
    console.error("❌ Cookie parse/set error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Open FB Page ---
  try {
    console.log("🌐 Opening FB Page Profile:", PAGE_PROFILE_LINK);
    await page.goto(PAGE_PROFILE_LINK, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
  } catch (err) {
    console.error("❌ Cannot open FB PAGE:", err);
    await browser.close();
    process.exit(1);
  }

  await delay(5000);

  // --- Switch Now if needed ---
  try {
    const [btn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
    if (btn) {
      await btn.click();
      console.log("✅ Switched into Page Context!");
      await delay(5000);
    } else {
      console.log("ℹ️ No 'Switch Now' button (maybe already Page context)");
    }
  } catch (err) {
    console.error("❌ Error clicking Switch Now:", err);
  }

  // --- Open Reels Composer ---
  try {
    console.log("🎬 Opening Reels composer...");
    await page.goto("https://www.facebook.com/reels/create", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
  } catch (err) {
    console.error("❌ Cannot open Reels composer:", err);
    await browser.close();
    process.exit(1);
  }

  await delay(7000);

  const composer = page.frames().find((f) => f.url().includes("reel"));
  if (!composer) {
    console.error("❌ Composer iframe পাওয়া যায়নি (সম্ভবত লগইন হয়নি)!");
    await page.screenshot({ path: "composer_error.png" });
    await browser.close();
    process.exit(1);
  }

  // --- Upload video ---
  try {
    const fileInput = await composer.$('input[type=file][accept*="video"]');
    await fileInput.uploadFile(videoPath);
    console.log("📤 Video attached:", videoPath);
  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Write caption ---
  try {
    await composer.waitForSelector('div[role="textbox"][contenteditable="true"]');
    await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
    console.log("✍️ Caption written:", captionText);
  } catch (err) {
    console.error("❌ Error writing caption:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Publish ---
  try {
    const pubBtns = await composer.$x(
      "//div[@role='button']//span[contains(text(),'Publish') or contains(text(),'প্রকাশ')]"
    );
    if (pubBtns[0]) {
      await pubBtns[0].click();
      console.log("✅ Reel published!");
    } else {
      console.error("❌ Publish button পাওয়া যায়নি!");
    }
  } catch (err) {
    console.error("❌ Error clicking publish:", err);
  }

  await delay(15000);
  await browser.close();
})();

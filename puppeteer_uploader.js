const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;
const cookiesJSON = process.env.FB_COOKIES;

// Universal Button click helper
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
    await delay(5000);
  } catch (err) {
    console.error("❌ FB Page open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Switch Now (Page Mode) ---
  await clickButtonByText(page, ["Switch Now", "সুইচ"], "SwitchProfile");
  await delay(5000);

  // --- Open Reels Composer ---
  try {
    console.log("🎬 Opening Reels composer...");
    await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2", timeout: 60000 });
    await delay(7000);
  } catch (err) {
    console.error("❌ Composer open error:", err);
    await browser.close();
    process.exit(1);
  }

  // --- Upload Video ---
  try {
    const composer = page.frames().find(f => f.url().includes("reel"));
    if (!composer) throw new Error("❌ Composer iframe পাওয়া যায়নি (সম্ভবত লগইন পেজ এসেছে)!");

    const fileInput = await composer.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না!");
    await fileInput.uploadFile(videoPath);
    console.log("📤 ভিডিও attach complete:", videoPath);

    // Next → Next
    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");
    await clickButtonByText(composer, ["Next", "পরবর্তী"], "Composer");

    // ---- Directly Publish (Caption বাদ দিয়ে) ----
    await clickButtonByText(composer, ["Publish", "প্রকাশ"], "Composer");
    console.log("✅ Reel upload finished (caption skipped)!");

  } catch (err) {
    console.error("❌ Error uploading/publishing video:", err);
    await browser.close();
    process.exit(1);
  }

  await delay(15000);
  await browser.close();
})();

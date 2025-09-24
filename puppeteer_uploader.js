/**
 * puppeteer_uploader.js (Final)
 * Business Suite → Page Reel Upload
 * Railway serverে TikTok থেকে ডাউনলোড হওয়া /tmp/*.mp4 ভিডিও Attach করবে
 */

const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";
const PAGE_ASSET_ID = process.env.FB_PAGE_ID; // Business Suite Page ID

// Helper → Universal Click by Text
async function clickButtonByText(page, labels, context = "Page") {
  for (const label of labels) {
    const btns = await page.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await page.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Clicked button: ${label} [${context}]`);
        await delay(4000);
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
    console.error("❌ ভিডিও path পাওয়া যায়নি (argv[2])!");
    process.exit(1);
  }

  // Business Suite Reel Composer link
  const url = `https://business.facebook.com/latest/reels_composer/?ref=biz_web_home_create_reel&asset_id=${PAGE_ASSET_ID}&context_ref=HOME`;

  console.log("▶️ Puppeteer starting...");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]
  });
  const page = await browser.newPage();

  // ---- Apply Cookies ----
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ Cookies applied:", cookies.length);
    }
  } catch (err) {
    console.error("❌ Cookie parse error:", err);
    await browser.close();
    process.exit(1);
  }

  // ---- Open Business Suite Composer ----
  console.log("🌐 Opening BizSuite Composer...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await delay(7000);

  // ---- Upload Video (Add Video button first) ----
  try {
    console.log("🎬 Clicking Add Video button...");
    await clickButtonByText(page, ["Add Video","ভিডিও যোগ করুন"], "BizSuite");
    await delay(4000);

    const fileInput = await page.$('input[type="file"][accept*="video"]');
    if (!fileInput) throw new Error("❌ File input পাওয়া গেল না (Add Video modal এ)!");
    
    await fileInput.uploadFile(videoPath);
    console.log("📤 ভিডিও attach complete:", videoPath);
    await delay(10000);
  } catch (err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // ---- Caption ----
  try {
    const captionBox = await page.waitForSelector('textarea', { visible: true, timeout: 20000 });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption typed:", captionText);
  } catch {
    console.warn("⚠️ Caption box not found, skipping caption");
  }

  // ---- Next → Next ----
  await clickButtonByText(page, ["Next","পরবর্তী"], "BizSuite");
  await delay(5000);

  // ---- Publish ----
  console.log("🚀 Looking for Publish button...");
  let published = await clickButtonByText(page, ["Publish","প্রকাশ","Share"], "BizSuite");

  // fallback DOM scan যদি টেক্সট detect না হয়
  if (!published) {
    const handle = await page.evaluateHandle(() => {
      const els = Array.from(document.querySelectorAll("div[role='button'] span"));
      return els.find(el => el.innerText && (el.innerText.includes("Publish") || el.innerText.includes("প্রকাশ")));
    });
    const el = handle.asElement();
    if (el) {
      await el.click();
      console.log("✅ Reel Published via DOM scan!");
      published = true;
    }
  }

  if (!published) {
    console.error("❌ Publish button not found!");
    await page.screenshot({ path:"publish_error.png", fullPage:true });
    await browser.close();
    process.exit(1);
  }

  console.log("✅ Reel Upload + Caption + Publish Done!");
  await delay(10000);
  await browser.close();
})();

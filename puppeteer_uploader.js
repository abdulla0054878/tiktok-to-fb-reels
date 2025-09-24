const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE;     // আপনার ফেসবুক পেজ প্রোফাইল লিঙ্ক
const cookiesJSON = process.env.FB_COOKIES;                // Railway Variable থেকে কুকি JSON আনবে
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Clicked: ${label} [${context}]`);
        await delay(4000);
        return true;
      }
    }
  }
  console.log(`⚠️ Button not found: ${labels.join(" / ")} [${context}]`);
  return false;
}

(async () => {
  const videoPath = process.argv[2]; // Python থেকে argv[2] হিসেবে ফাইলপাথ আসবে (/tmp/..mp4)
  if (!videoPath) {
    console.error("❌ ভিডিও path পাওয়া যায়নি (argv[2])");
    process.exit(1);
  }

  console.log("▶️ Puppeteer starting...");

  // 🚀 Railway-তে headless+chromium
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  const page = await browser.newPage();

  // --- Cookies Apply ---
  try {
    if (cookiesJSON) {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ FB Cookies applied:", cookies.length);
    } else {
      console.error("⚠️ FB_COOKIES missing!");
    }
  } catch(e) {
    console.error("❌ Cookie parse error", e);
    await browser.close();
    process.exit(1);
  }

  // Step 1 → Page Profile Open
  console.log("🌐 Opening Page Profile:", PAGE_PROFILE_LINK);
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(8000);

  // Step 2 → Switch Now
  console.log("👉 Trying to switch profile...");
  await clickButtonByText(page, ["Switch Now","Switch Profile","সুইচ"], "SwitchProfile");
  await delay(8000);

  // Step 3 → Open Reels Composer
  console.log("🎬 Opening Reels Composer...");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(10000);

  // Step 4 → composer iframe
  let composer = page.frames().find(f=>f.url().includes("reel"));
  if (!composer) {
    console.warn("⚠️ Composer iframe নাই → PAGE context fallback");
    composer = page;
  }

  // Step 5 → Upload Video
  try {
    const fileInput = await composer.$('input[type=file][accept*="video"]') || await page.$('input[type=file][accept*="video"]');
    if (!fileInput) throw new Error("❌ File input পাওয়া যায়নি!");
    await fileInput.uploadFile(videoPath);
    console.log("📤 Video attached:", videoPath);
    await delay(8000);
  } catch(err) {
    console.error("❌ Error attaching video:", err);
    await browser.close();
    process.exit(1);
  }

  // Step 6 → Next → Next
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");

  // Step 7 → Caption
  try {
    const captionBox = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible:true, timeout:60000 });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption typed:", captionText);
  } catch(e) {
    console.warn("⚠️ Caption box পাওয়া যায়নি → skipping caption");
  }

  // Step 8 → Publish
  console.log("🚀 Looking for Publish...");
  let published = await clickButtonByText(composer, ["Publish","প্রকাশ","Share","Post"], "Composer");
  if (!published) published = await clickButtonByText(page, ["Publish","প্রকাশ","Share","Post"], "Page");

  // শেষ চেষ্টা → direct DOM scan
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

  console.log("✅ Reel Upload + Caption + Publish done!");
  await delay(12000);
  await browser.close();
})();

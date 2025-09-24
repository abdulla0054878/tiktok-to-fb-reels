const puppeteer = require("puppeteer");
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const cookiesJSON = process.env.FB_COOKIES;
const captionText = process.env.FB_CAPTION || "🚀 Auto Reel Upload";

// Helper → click button by text
async function clickButtonByText(pageOrFrame, labels, context = "Page") {
  for (const label of labels) {
    const btns = await pageOrFrame.$$('div[role="button"], span');
    for (const btn of btns) {
      const txt = await pageOrFrame.evaluate(el => el.innerText, btn);
      if (txt && txt.trim().includes(label)) {
        await btn.click();
        console.log(`👉 Button Clicked: ${label} [${context}]`);
        await delay(5000);
        return true;
      }
    }
  }
  console.log(`⚠️ Button not found: ${labels.join(" / ")} [${context}]`);
  return false;
}

(async () => {
  const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE; // আপনার পেজ লিঙ্ক
  const videoPath = process.argv[2]; // Python থেকে পাঠানো ফাইল path

  if (!videoPath) {
    console.error("❌ ভিডিও path দরকার (argv[2])");
    process.exit(1);
  }

  // Launch browser (Railway server → headless true)
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"]
  });

  const page = await browser.newPage();

  // Cookies load from ENV
  if (cookiesJSON) {
    try {
      let cookies = JSON.parse(cookiesJSON);
      cookies = cookies.map(c => { delete c.sameSite; return c; });
      await page.setCookie(...cookies);
      console.log("✅ FB Cookies applied!");
    } catch (e) {
      console.error("❌ FB_COOKIES parse error", e);
    }
  }

  // Step 1 → Page profile link open
  console.log("🌐 Opening Page profile…");
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(8000);

  // Step 2 → Switch Now
  console.log("👉 Trying to Switch Now…");
  await clickButtonByText(page, ["Switch Now","সুইচ"], "SwitchProfile");
  await delay(10000);

  // Step 3 → Open Reels Composer
  console.log("🌐 Opening Reels Composer in Page context…");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  // Step 4 → composer iframe detect
  let composer = page.frames().find(f=>f.url().includes("reel"));
  if (!composer) throw new Error("⚠️ Reels composer iframe পাওয়া যায়নি!");

  // Step 5 → Upload mp4 from server path
  console.log("📂 Uploading:", videoPath);
  const fileInput = await composer.$('input[type=file][accept*="video"]');
  if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না!");
  await fileInput.uploadFile(videoPath);
  console.log("📤 ভিডিও attach complete!");

  // Step 6 → Next → Next
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");
  await clickButtonByText(composer, ["Next","পরবর্তী"], "Composer");

  // Step 7 → Caption
  console.log("⌛ Waiting for Caption box…");
  try {
    const captionBox = await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', {
      visible: true,
      timeout: 120000,
    });
    await captionBox.type(captionText, { delay: 50 });
    console.log("✍️ Caption লিখা ফিনিশড");
  } catch (e) {
    console.warn("⚠️ Caption box পাওয়া যায়নি → skip");
  }

  // Step 8 → Publish
  await clickButtonByText(composer, ["Publish","প্রকাশ"], "Composer");
  console.log("✅ Reel Upload + Caption + Publish Flow Finished!");

  await browser.close();
})();

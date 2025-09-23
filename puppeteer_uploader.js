// puppeteer_uploader.js
const puppeteer = require("puppeteer");
const delay = ms => new Promise(res => setTimeout(res, ms));

// 👉 FB Page profile link (Env থেকে নেবে অথবা কোডে বদলাতে পারো)
const PAGE_PROFILE_LINK = process.env.FB_PAGE_PROFILE || "https://www.facebook.com/profile.php?id=100087262751325";

(async () => {
  const videoPath = process.argv[2]; // ভিডিও পাথ নেবে args থেকে
  if (!videoPath) {
    console.error("❌ ভিডিও path দিতে হবে!");
    process.exit(1);
  }

  // Railway‑safe Puppeteer Launch
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
    userDataDir: "./myProfile"
  });

  const page = await browser.newPage();

  console.log("🌐 Opening Page profile...");
  await page.goto(PAGE_PROFILE_LINK, { waitUntil: "networkidle2" });
  await delay(5000);

  // 👉 Switch Now
  const [switchNowBtn] = await page.$x("//div[@role='button'][.//span[text()='Switch Now']]");
  if (switchNowBtn) {
    await switchNowBtn.click();
    console.log("✅ Switched into Page Context!");
  } else {
    console.log("⚠️ Switch Now button পাওয়া যায়নি!");
  }

  await delay(8000);

  console.log("🌐 Opening Reels Composer...");
  await page.goto("https://www.facebook.com/reels/create", { waitUntil: "networkidle2" });
  await delay(7000);

  const frames = page.frames();
  const composer = frames.find(f => f.url().includes("reel"));
  if (!composer) throw new Error("⚠️ Reels composer iframe পাওয়া যায়নি!");

  const fileInput = await composer.$('input[type=file][accept*="video"]');
  if (!fileInput) throw new Error("⚠️ File input পাওয়া গেল না!");
  await fileInput.uploadFile(videoPath);
  console.log("📤 ভিডিও attach complete!");

  await delay(5000);

  // Caption
  const captionText = `🚀 Auto Reel Upload from TikTok (${new Date().toLocaleString()})`;
  await composer.waitForSelector('div[role="textbox"][contenteditable="true"]', { visible: true });
  await composer.type('div[role="textbox"][contenteditable="true"]', captionText);
  console.log("✍️ Caption লিখা ফিনিশড");

  // Publish
  const labels = ["Publish", "প্রকাশ"];
  for (const label of labels) {
    const handle = await composer.evaluateHandle((t) => {
      const els = Array.from(document.querySelectorAll('div[role="button"]'));
      return els.find(el => el.innerText && el.innerText.includes(t)) || null;
    }, label);

    const el = handle.asElement();
    if (el) {
      await el.click();
      console.log("✅ Published Reel!");
      break;
    }
  }

  await browser.close();
})();

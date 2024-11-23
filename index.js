const Database = require("better-sqlite3");
const puppeteer = require("puppeteer-core");
const { PuppeteerBlocker } = require("@ghostery/adblocker-puppeteer");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
if (!fs.existsSync(config.screenshotDir)) {
  fs.mkdirSync(config.screenshotDir);
}
let processingState = "stopped"; // Initial state: stopped
let browser;
let page;

// Database Initialization
const db = new Database("./database.db", { verbose: console.log });
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    screenshotPath TEXT,
    createdTime TEXT NOT NULL,
    modifiedTime TEXT,
    currentlyBeingModified INTEGER DEFAULT 0,
    retryCount INTEGER DEFAULT 0
  )
`);

// Initialize Puppeteer
async function initializeBrowser() {
  const executablePath = config.browserPath;
  console.log(`Using browser at: ${executablePath}`);
  browser = await puppeteer.launch({
    product: "chrome",
    executablePath,
    headless: true
  });
  page = await browser.newPage();

  // Load and enable the adblocker
  const blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);
  blocker.enableBlockingInPage(page);

  // Set User-Agent from config
  await page.setUserAgent(config.userAgent);
}

// Add Site to Database
function addSite(url) {
  const domain = new URL(url).hostname;
  const now = new Date().toISOString();
  const uuid = uuidv4();

  try {
    db.prepare(`
      INSERT INTO sites (uuid, url, domain, createdTime, modifiedTime) 
      VALUES (?, ?, ?, ?, ?)
    `).run(uuid, url, domain, now, now);
    console.log(`Added: ${url}`);
  } catch (err) {
    console.error(`Error adding site: ${err.message}`);
  }
}

// Import Links from File
function importLinksFromFile(filename) {
  if (!fs.existsSync(filename)) {
    console.warn(`File not found: ${filename}`);
    return;
  }
  const urls = fs.readFileSync(filename, "utf8").split("\n").filter(Boolean);
  urls.forEach((url) => addSite(url.trim()));
}

// Process Sites
async function processSites() {
  processingState = "running";

  const selectSiteStmt = db.prepare(`
    SELECT * FROM sites WHERE screenshotPath IS NULL AND currentlyBeingModified = 0 LIMIT 1
  `);

  const updateSiteStmt = db.prepare(`
    UPDATE sites SET currentlyBeingModified = 1 WHERE id = ?
  `);

  const completeSiteStmt = db.prepare(`
    UPDATE sites SET screenshotPath = ?, modifiedTime = ?, currentlyBeingModified = 0 WHERE id = ?
  `);

  const resetSiteStmt = db.prepare(`
    UPDATE sites SET currentlyBeingModified = 0 WHERE id = ?
  `);

  const skipSiteStmt = db.prepare(`
    UPDATE sites SET currentlyBeingModified = 0 WHERE id = ?
  `);

  while (processingState === "running") {
    const row = selectSiteStmt.get();
    if (!row) {
      console.log("No sites to process. Pausing...");
      processingState = "paused";
      continue;
    }

    const { id, url, uuid } = row;

    try {
      updateSiteStmt.run(id);

      const screenshotPath = path.join(config.screenshotDir, `${uuid}.png`);
      const newPage = await browser.newPage();
      console.log(`Navigating to URL: ${url}`);

      // Attach adblocker to the new page
      const blocker = await PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch);
      blocker.enableBlockingInPage(newPage);

      // Set User-Agent
      await newPage.setUserAgent(config.userAgent);

      // Navigate and take a screenshot
      await newPage.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      console.log(`Taking screenshot: ${screenshotPath}`);
      await newPage.screenshot({ path: screenshotPath });
      console.log(`Screenshot saved: ${screenshotPath}`);

      const now = new Date().toISOString();
      completeSiteStmt.run(screenshotPath, now, id);

      await newPage.close(); // Ensure the tab is closed after processing
    } catch (error) {
      console.error(`Failed to process ${url}:`, error.message);
      if (retryCount + 1 >= 3) {
        skipSiteStmt.run(id);
      } else {
        resetSiteStmt.run(id);
      }
    } finally {
      await newPage.close();
    }

    while (processingState === "paused") {
      console.log("Paused. Waiting to resume...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (processingState === "stopped") {
      console.log("Stopped. Exiting...");
      break;
    }
  }
}

// Ask User for Input
function askUser(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Terminal Interface
async function handleCommand(command) {
  const parts = command.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case "add":
      const url = parts[1];
      if (url) {
        addSite(url);
      } else {
        console.error("Usage: add <URL>");
      }
      break;

    case "import":
      const filename = parts[1];
      if (filename) {
        importLinksFromFile(filename);
      } else {
        console.error("Usage: import <filename>");
      }
      break;

    case "start":
      if (processingState === "running") {
        console.log("Already running.");
      } else {
        processSites();
      }
      break;

    case "pause":
      processingState = "paused";
      console.log("Paused processing.");
      break;

    case "resume":
      processingState = "running";
      console.log("Resumed processing.");
      break;

    case "clear":
      console.clear();
      break;

    case "exit":
      console.log("Exiting...");
      if (browser) {
        await browser.close();
      }
      db.close();
      process.exit();
      break;

    default:
      console.log(
        "Unknown command. Commands: add <URL>, import <filename>, start, pause, resume, clear, exit"
      );
  }
}

// Start Terminal Interface
async function startTerminalInterface() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "Commands: add <URL>, import <filename>, start, pause, resume, clear, exit"
  );

  rl.on("line", async (line) => {
    await handleCommand(line);
  });
}

// Main Execution
(async () => {
  await initializeBrowser();
  startTerminalInterface();
})();

setInterval(
  fs.stat.bind(null, "database.db-wal", (err, stat) => {
    if (err) {
      if (err.code !== "ENOENT") throw err;
    } else if (stat.size > 64 * 1024 * 1024) {
      db.pragma("wal_checkpoint(RESTART)");
    }
  }),
  5000
).unref();
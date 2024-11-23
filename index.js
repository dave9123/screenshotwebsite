import sqlite3 = require("sqlite3").verbose();
const puppeteer = require("puppeteer-core");
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
const db = new sqlite3.Database("./database.db");
db.pragma("journal_mode = WAL");
db.run(`CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    screenshotPath TEXT,
    createdTime TEXT NOT NULL,
    modifiedTime TEXT,
    currentlyBeingModified INTEGER DEFAULT 0
)`);

// Auto-Discover Browsers
async function discoverBrowsers() {
  console.log("Discovering available browsers...");
  const browserFetcher = puppeteer.createBrowserFetcher();
  const revisions = await browserFetcher.localRevisions();
  if (revisions.length > 0) {
    console.log("Available browsers:");
    revisions.forEach((revision, index) =>
      console.log(`${index + 1}: Revision ${revision}`)
    );
    return browserFetcher.revisionInfo(revisions[0]).executablePath;
  } else {
    console.log("No local browsers found.");
    const downloadBrowser = (await askUser(
      "No local browsers found. Do you want to download a browser? (yes/no): "
    )) as string;
    if (downloadBrowser.toLowerCase() === "yes") {
      const browserName = (await askUser(
        "Enter the name of the browser you want to use (e.g., chrome, firefox): "
      )) as string;
      const browserFetcher = puppeteer.createBrowserFetcher({
        product: browserName,
      });
      const revisionInfo = await browserFetcher.download("latest");
      return revisionInfo.executablePath;
    } else {
      const customPath = (await askUser(
        "Enter path to a browser executable: "
      )) as string;
      return customPath.trim();
    }
  }
}

// Initialize Puppeteer
async function initializeBrowser() {
  const executablePath = await discoverBrowsers();
  console.log(`Using browser at: ${executablePath}`);
  browser = await puppeteer.launch({ executablePath });
  page = await browser.newPage();
}

// Add Site to Database
function addSite(url) {
  const domain = new URL(url).hostname;
  const now = new Date().toISOString();
  const uuid = uuidv4();

  db.run(
    `INSERT INTO sites (uuid, url, domain, createdTime, modifiedTime) VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid, url, domain, now, now],
    (err) => {
      if (err) {
        console.error(`Error adding site: ${err.message}`);
      } else {
        console.log(`Added: ${url}`);
      }
    }
  );
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
  db.each(
    `SELECT * FROM sites WHERE screenshotPath IS NULL AND currentlyBeingModified = 0 LIMIT 1`,
    async (err, row) => {
      if (err) {
        console.error("Error fetching site:", err.message);
        return;
      }

      const { id, url, uuid } = row;

      try {
        db.run(`UPDATE sites SET currentlyBeingModified = 1 WHERE id = ?`, [
          id,
        ]);

        while (processingState === "paused") {
          console.log("Paused. Waiting to resume...");
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        if (processingState === "stopped") {
          console.log("Stopped. Exiting...");
          await db.close();
          return;
        }

        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
        const screenshotPath = path.join(config.screenshotDir, `${uuid}.png`);
        await page.screenshot({ path: screenshotPath });
        console.log(`Screenshot saved: ${screenshotPath}`);

        const now = new Date().toISOString();
        db.run(
          `UPDATE sites SET screenshotPath = ?, modifiedTime = ?, currentlyBeingModified = 0 WHERE id = ?`,
          [screenshotPath, now, id]
        );
      } catch (error) {
        console.error(`Failed to process ${url}:`, error.message);
        db.run(`UPDATE sites SET currentlyBeingModified = 0 WHERE id = ?`, [
          id,
        ]);
      }
    }
  );
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

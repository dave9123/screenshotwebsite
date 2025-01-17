import { Database } from "bun:sqlite";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker"
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import readline from "readline";
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";

dotenv.config();

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0
    });
}

const config = require("./config.json");
if (!fs.existsSync(config.screenshotDir)) {
    fs.mkdirSync(config.screenshotDir);
}
let processingState = "stopped"; // Initial state
let currentJob = "none"; // Initial job
let browser;
let page;

// Puppeteer plugin initialization
console.log(`Available evasions: ${StealthPlugin().availableEvasions}\nEnabled evasions: ${StealthPlugin().enabledEvasions}`)
puppeteer.use(AdblockerPlugin({
    blockTrackers: true,
    blockTrackersAndAnnoyances: true,
    useCache: true
}));
puppeteer.use(StealthPlugin())

// Database Initialization
const db = new Database("./database.db");
db.run("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    screenshottedUrl TEXT,
    domain TEXT NOT NULL,
    screenshottedDomain TEXT,
    screenshotPath TEXT,
    createdTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    modifiedTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    currentlyBeingModified INTEGER DEFAULT 0,
    retryCount INTEGER DEFAULT 0
  )
`);

db.run(`
  CREATE TRIGGER IF NOT EXISTS update_modified_time
  AFTER UPDATE ON sites
  FOR EACH ROW
  BEGIN
    UPDATE sites
    SET modifiedTime = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
  END;
`);

// Initialize Puppeteer
async function initializeBrowser() {
    console.log(`Using browser at: ${config.browserPath}`);
    browser = await puppeteer.launch({
        browser: config.browser,
        dumpio: config.dumpio,
        executablePath: config.browserPath,
        headless: config.headless,
        //extraPrefsFirefox: {
        //    "remote.log.level": "Trace"
        //},
    });
};

// Add Site to Database
function addSite(url) {
    const domain = new URL(url).hostname;
    const uuid = uuidv4();

    try {
        db.run(`
      INSERT INTO sites (uuid, url, domain) VALUES (?, ?, ?)
    `, [uuid, url, domain]);
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
    SELECT * FROM sites WHERE screenshotPath IS NULL AND currentlyBeingModified = 0 AND retryCount < ? LIMIT 1
  `);

    const updateSiteStmt = db.prepare(`
    UPDATE sites SET currentlyBeingModified = 1 WHERE id = ?
  `);

    const completeSiteStmt = db.prepare(`
    UPDATE sites SET screenshotPath = ?, screenshottedDomain = ?, screenshottedUrl = ?, modifiedTime = CURRENT_TIMESTAMP, currentlyBeingModified = 0 WHERE id = ?
  `);

    const retrySiteStmt = db.prepare(`
    UPDATE sites SET currentlyBeingModified = 0, retryCount = retryCount + 1 WHERE id = ?
  `);

    while (processingState === "running") {
        const row = selectSiteStmt.get(config.retryLimit);
        if (!row) {
            console.log("No sites to process. Pausing...");
            processingState = "paused";
            continue;
        }

        const { id, url, uuid } = row;

        let newPage;
        try {
            updateSiteStmt.run(id);

            const screenshotPath = path.join(config.screenshotDir, `${uuid}.png`);
            newPage = await browser.newPage();
            const pages = await browser.pages();
            if (pages.length > 1) {
                await pages[0].close();
            }
            console.log(`Navigating to URL: ${url}`);
            currentJob = `Navigating to ${url}`;

            // Set Viewport
            await newPage.setViewport({
                width: config.viewportWidth,
                height: config.viewportHeight,
                deviceScaleFactor: 1
            })

            // Set User-Agent
            await newPage.setUserAgent(config.userAgent);

            // Navigate and take a screenshot
            await newPage.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
            console.log(`Taking screenshot: ${screenshotPath}`);
            currentJob = `Taking screenshot of ${url}`;
            await newPage.screenshot({ path: screenshotPath });
            console.log(`Screenshot saved: ${screenshotPath}`);
            currentJob = "none";
            completeSiteStmt.run(screenshotPath, new URL(newPage.url()).hostname, newPage.url(), id);
        } catch (error) {
            console.error(`Failed to process ${url}:`, error.message);
            retrySiteStmt.run(id);
        } finally {
            if (newPage) {
                await newPage.goto("about:blank");
            }
        }

        if (processingState === "stopped") {
            console.log("Stopped. Exiting...");
            db.close();
            if (browser) {
                await browser.close();
            }
            process.exit(0);
        }
    }
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

        case "status":
            console.log(`Processing State: ${processingState}`);
            console.log(`Current Job: ${currentJob}`);
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

        case "clear":
            process.stdout.write(process.env.keepHistoryOnClear ? "\x1B[H\x1B[2J" : "\x1B[2J\x1B[3J\x1B[H\x1Bc")
            break;

        case "exit":
            processingState = "stopped";
            if (currentJob !== "none") {
                console.log("Waiting for current job to finish...");
            } else {
                console.log("Exiting...");
                if (browser) {
                    await browser.close();
                }
                db.close();
                process.exit(0);
            }
            break;

        default:
            console.log(
                "Unknown command. Commands: add <URL>, import <filename>, status, start, pause, clear, exit"
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
        "Commands: add <URL>, import <filename>, start, pause, clear, exit"
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

setInterval(() => {
    const walSize = fs.existsSync("database.db-wal")
        ? fs.statSync("database.db-wal").size
        : 0;
    if (walSize > 64 * 1024 * 1024) {
        db.run("PRAGMA wal_checkpoint(RESTART)");
    }
}, 5000).unref();
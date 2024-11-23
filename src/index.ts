import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";
import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer";
import readline from "readline";
import fs from "fs";
import LogRocket from "logrocket";

LogRocket.init('j1bibu/screenshotwebsite');
const state = "./state.json";
const config = "./config.json";
const db = new Database('database.db');
db.pragma('journal_mode = WAL'); // Using WAL mode is better for concurrent access https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

// Generates config.json file if it doesn't exist
if (!fs.existsSync(config)) {
    fs.writeFileSync(config, JSON.stringify({
        state: "running",
        database: "database.db",
        headless: true,
        UserAgent: [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
        ],
        viewport: {
            width: 1920,
            height: 1080,
        },
        useCustomBrowser: false,
        browserPath: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    }));
    console.log("Config file generated. Please edit the config file to your liking.");
    process.exit();
}

// Prevent WAL file from growing too large
setInterval(fs.stat.bind(null, 'database.db-wal', (err, stat) => {
    if (err) {
        if (err.code !== 'ENOENT') throw err;
    } else if (stat.size > 1 * 1024 * 1024) {
        db.pragma('wal_checkpoint(RESTART)');
    }
  }), 5000).unref();

PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInPage(page);
});
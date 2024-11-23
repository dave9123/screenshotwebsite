import { v4 as uuidv4 } from "uuid";
import Database from "better-sqlite3";
import puppeteer from "puppeteer";
import { PuppeteerBlocker } from "@ghostery/adblocker-puppeteer";
import readline from "readline";
import fs from "fs";
import LogRocket from "logrocket";

const config = JSON.parse(fs.readFileSync("config.json", "utf8"));

LogRocket.init('j1bibu/screenshotwebsite');
const db = new Database('database.db');
db.pragma('journal_mode = WAL'); // Using WAL mode is better for concurrent access https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
const browser = await puppeteer.launch({
    headless: config.headless,
    //args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

// Prevent WAL file from growing too large
setInterval(() => {
    fs.stat('database.db-wal', (err: NodeJS.ErrnoException | null, stat: fs.Stats) => {
        if (err) {
            if (err.code !== 'ENOENT') throw err;
        } else if (stat.size > 64 * 1024 * 1024) {
            db.pragma('wal_checkpoint(RESTART)');
        }
    });
}, 5000).unref();

PuppeteerBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
    blocker.enableBlockingInPage(page);
});

process.on('SIGINT', async () => {
    await browser.close();
    await db.close();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await browser.close();
    await db.close();
    process.exit(0);
});
process.on('exit', async () => {
    await browser.close();
    await db.close();
    process.exit(0);
});
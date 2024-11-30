import { Database } from "bun:sqlite";
import fs from "fs";
const db = new Database("database.db");
const target = "output/output.txt";
const list = db.query(`SELECT * FROM sites WHERE currentlyBeingModified = 0 AND screenshotPath NOT NULL AND screenshottedUrl = "https://heylink.me/deactivated/"`).all();
const seenUrls = new Set(); // Prevent duplicates
for (const site of list) {
    if (!seenUrls.has(site.url)) {
        fs.mkdirSync("output", { recursive: true });
        fs.appendFileSync(target, `${site.uuid}.png ${site.url}\n`);
        fs.copyFileSync(site.screenshotPath, `output/${site.uuid}.png`);
        console.log(`Added ${site.url}`);
        seenUrls.add(site.url);
    }
}
import { Database } from "bun:sqlite";
import fs from "fs";
const db = new Database("database.db");
const target = "output.txt";
const list = db.query("SELECT * FROM sites WHERE currentlyBeingModified = 0 AND screenshotPath NOT NULL").get();
const seenUrls = new Set(); // Prevent duplicates
for (const site of list) {
    if (!seenUrls.has(site.url)) {
        fs.appendFileSync(target, `${site.uuid}.png ${site.url}\n`);
        console.log(`Added ${site.url}`);
        seenUrls.add(site.url);
    }
}
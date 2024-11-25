# ScreenshotWebsite

![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

A tool to screenshot websites automatically that has a queue system.

# Setup

<ol type="1">
    <li>Make sure you have <a href="https://bun.sh/">Bun</a> installed</li>
    <li>Install packages by running <code>bun install</code></li>
    <li>Modify config.json to your liking</li>
</ol>

# Configuration

<ul>
    <li>
        <code>screenshotDir</code>
        <p>Directory path to store screenshots, example: <code>"screenshots"</code></p>
    </li>
    <li>
        <code>userAgent</code>
        <p>The User-Agent the browser will use, example: <code>"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"</code></p>
    </li>
    <li>
        <code>browserPath</code>
        <p>Path to installed browser, example: <code>"C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"</code></p</li>
    <li>
        <code>retryLimit</code>
        <p>Limit how many times to retry on error before skipping, example: <code>1</code></p>
    </li>
    <li>
        <code>height</code>
        <p>Screenshot height, example: <code>1920</code></p>
    </li>
    <li>
        <code>width</code>
        <p>Screenshot width, example: <code>1080</code></p>
    </li>
    <li>
        <code>headless</code>
        <p>Runs browser in <a href="https://pptr.dev/guides/headless-modes">headless mode</a>, options: <code>true</code> and <code>false</code>, example: <code>true</code></p>
    </li>
    <li>
        <code>dumpio</code>
        <p>Outputs browser's stdout and stderr, options: <code>true</code> and <code>false</code>, example: <code>false</code></p>
    </li>
    <li>
        <!--<code>browser</code> Browser type that is used (make sure this matches with the browser set on browserPath), options: <code>chrome</code> and <code>firefox</code>, example: <code>chrome</code>-->
        <code>browser</code>
        <p>Browser type that is used (make sure this matches with the browser set on browserPath), option: <code>chrome</code>, example: <code>chrome</code></p>
    </li>
    <li>
        <code>keepHistoryOnClear</code>
        <p><a href="https://www.npmjs.com/package/console-clear">Clears console but keeps scrollback history intact</a>, options: <code>true</code> and <code>false</code>, example: <code>false</code></p>
    </li>
</ul>

# Running

Run <code>bun index.js</code>

# Usage

-   `add <URL>` Adds a URL to the database
-   `import <file>` Imports a text file and adds URL(s) splitted by new line to the database
-   `start` Start or resume job(s)
-   `pause` Pauses job(s)
-   `clear` Clears screen on terminal
-   `exit` Close browser and database then exits

# Todo

<ol type="1">
    <li>Bypass Cloudflare UAM</li>
    <li>Make UI</li>
    <li>Support command arguments</li>
    <li>Support other browsers</li>
</ol>
# ScreenshotWebsite
A tool to screenshot websites automatically that has a queue system.

# Setup
<ol type="1">
    <li>Make sure you have [Bun](https://bun.sh/) installed</li>
    <li>Install packages by running <code>bun install</code></li>
</ol>

# Usage
- `add <URL>` Adds a URL to the database
- `import <file>` Imports a text file and adds URL(s) splitted by new line to the database
- `pause` Pauses job(s)
- `resume` Resumes job(s)
- `exit` Close browser and database then exits
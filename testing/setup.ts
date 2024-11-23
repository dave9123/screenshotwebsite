import readline from "readline";
import fs from "fs";
let configPath = "./config.json";

if (!fs.existsSync(configPath)) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const questions = [
        { question: "State (default: running): ", default: "running" },
        { question: "Database (default: database.db): ", default: "database.db" },
        { question: "Headless (default: true): ", default: true },
        { question: "UserAgent (default: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3): ", default: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3" },
        { question: "Viewport width (default: 1920): ", default: 1920 },
        { question: "Viewport height (default: 1080): ", default: 1080 },
        { question: "Use custom browser (default: false): ", default: false },
        { question: "Browser path (default: C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe): ", default: "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe" }
    ];

    const config: any = {};

    const askQuestion = (index: number) => {
        if (index === questions.length) {
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log("Config file generated. Please edit the config file to your liking.");
            rl.close();
            process.exit();
        } else {
            const { question, default: defaultValue } = questions[index];
            rl.question(question, (answer) => {
                config[questions[index].question.split(" ")[0].toLowerCase()] = answer || defaultValue;
                askQuestion(index + 1);
            });
        }
    };

    askQuestion(0);
}
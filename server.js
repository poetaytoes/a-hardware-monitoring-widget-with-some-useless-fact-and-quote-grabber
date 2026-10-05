const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Detect if we are running inside the packaged Electron app
const isPackaged = process.resourcesPath !== undefined && !process.defaultApp;

// Resolve clean paths for production vs development
const workerPath = isPackaged 
    ? path.join(process.resourcesPath, 'telemetry_worker.exe') 
    : path.join(__dirname, 'telemetry_worker.exe');

const scriptPath = isPackaged 
    ? path.join(process.resourcesPath, 'app_tracker.py') 
    : path.join(__dirname, 'app_tracker.py');



// Serve static frontend dashboard files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Shared state for background telemetry data
let latestMetrics = { cpuName: "Scanning...", cpu: 0, gpus: [] };
let activeApps = {};

// --- 1. Spawn C++ Hardware Telemetry Worker ---
const telemetryWorker = spawn(workerPath);

telemetryWorker.stdout.on('data', (data) => {
    try {
        const jsonString = data.toString().trim();
        const parsed = JSON.parse(jsonString);

        // Normalize GPU metrics so frontend never receives undefined values
        if (parsed.gpus && Array.isArray(parsed.gpus)) {
            parsed.gpus = parsed.gpus.map(gpu => ({
                name: gpu.name || "Unknown GPU",
                util: gpu.util !== undefined ? gpu.util : (gpu.load !== undefined ? gpu.load : (gpu.usage !== undefined ? gpu.usage : 0)),
                vramUtil: gpu.vramUtil !== undefined ? gpu.vramUtil : (gpu.vram !== undefined ? gpu.vram : 0)
            }));
        }

        latestMetrics = parsed;
    } catch (e) {
        // Ignore partial buffer chunks
    }
});

telemetryWorker.stderr.on('data', (err) => {
    console.error(`[C++ Telemetry Error]: ${err}`);
});

// --- 2. Spawn Python App Tracker Worker ---
const pythonTracker = spawn('python', ['-u', scriptPath]);

pythonTracker.stdout.on('data', (data) => {
    try {
        const jsonString = data.toString().trim();
        const parsed = JSON.parse(jsonString);
        activeApps = parsed;
    } catch (e) {
        // Ignore partial buffer chunks
    }
});

pythonTracker.stderr.on('data', (err) => {
    console.error(`[Python Tracker Error]: ${err}`);
});

// --- 3. API Endpoints ---
app.get('/api/metrics', (req, res) => {
    res.json(latestMetrics);
});

app.get('/api/apps', (req, res) => {
    res.json(activeApps);
});

// Stored backup collections for offline/fallback use
const backupQuotes = [
    { quote: "Don't be satisfied with stories, how things have gone with others. Unfold your own myth.", author: "Rumi" },
    { quote: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
    { quote: "Programs must be written for people to read, and only incidentally for machines to execute.", author: "Harold Abelson" },
    { quote: "Controlling complexity is the essence of computer programming.", author: "Brian Kernighan" }
];

const backupFacts = [
    "Fun fact: Python is named after the comedy troupe Monty Python, not the snake!",
    "Fun fact: The first computer bug was an actual real moth found trapped inside a relay in 1947.",
    "Did you know? C++ was originally called 'C with Classes' before being renamed.",
    "Fun fact: The QWERTY keyboard layout was designed to keep typewriter keys from jamming, not for speed."
];
const https = require('https');
// Online quote route using ZenQuotes API
app.get('/api/quote', async (req, res) => {
    try {
        const response = await fetch('https://zenquotes.io/api/random');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // ZenQuotes returns an array containing the quote object
        res.json({ quote: data[0].q, author: data[0].a });
    } catch (e) {
        console.error("Online quote fetch failed, using fallback:", e.message);
        const fallback = backupQuotes[Math.floor(Math.random() * backupQuotes.length)];
        res.json(fallback);
    }
});

// Proxy route for fun facts with full error logging and user-agent headers
app.get('/api/fact', async (req, res) => {
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/random.json?language=en', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        res.json({ fact: data.text || "Python is named after Monty Python." });
    } catch (e) {
        console.error("Fact fetch failed:", e.message); // This will show you the exact error in your terminal!
        const fallback = backupFacts[Math.floor(Math.random() * backupFacts.length)];
        res.json(fallback);
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`[Orchestrator] Server running live at http://localhost:${PORT}`);
});
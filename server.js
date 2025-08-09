const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const PachinkoScraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store scraped data in memory (in production, use a database)
let cachedData = null;
let lastScrapedTime = null;
let isScrapingInProgress = false;

// Function to perform scraping
async function performScraping() {
    if (isScrapingInProgress) {
        console.log('Scraping already in progress, skipping...');
        return cachedData;
    }

    isScrapingInProgress = true;
    const scraper = new PachinkoScraper();
    
    try {
        console.log('Starting real data scrape at', new Date().toISOString());
        const url = 'https://www.p-world.co.jp/_machine/dedama.cgi?hall_id=019662&type=pachi';
        const data = await scraper.scrapeAllData(url);
        
        if (data && data.length > 0) {
            cachedData = data;
            lastScrapedTime = new Date();
            console.log('Real data scraped successfully');
        } else {
            console.log('No data scraped - checking site structure');
        }
        
        return data;
    } catch (error) {
        console.error('Scraping failed:', error);
        return cachedData;
    } finally {
        isScrapingInProgress = false;
    }
}

// API Routes
app.get('/api/scrape', async (req, res) => {
    try {
        const data = await performScraping();
        res.json({
            success: true,
            data: data,
            lastUpdated: lastScrapedTime
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/data', (req, res) => {
    res.json({
        success: true,
        data: cachedData,
        lastUpdated: lastScrapedTime,
        isScrapingInProgress: isScrapingInProgress
    });
});

app.get('/api/analyze', (req, res) => {
    if (!cachedData || cachedData.length === 0) {
        return res.json({
            success: false,
            message: 'No data available. Please scrape first.'
        });
    }

    const analysis = {};
    
    cachedData.forEach(machine => {
        const stats = {
            totalMachines: machine.data.length,
            totalHits: 0,
            totalFirstHits: 0,
            totalSpins: 0,
            avgHitRate: 0,
            avgFirstHitRate: 0,
            maxBalls: 0,
            machines: []
        };

        machine.data.forEach(unit => {
            const totalHits = parseInt(unit.総大当り) || 0;
            const firstHits = parseInt(unit.初当り) || 0;
            const spins = parseInt(unit.回転数) || 0;
            const maxBalls = parseInt(unit.最大持ち玉) || 0;
            
            stats.totalHits += totalHits;
            stats.totalFirstHits += firstHits;
            stats.totalSpins += spins;
            stats.maxBalls = Math.max(stats.maxBalls, maxBalls);
            
            stats.machines.push({
                台番号: unit.台番号,
                回転数: spins,
                総大当り: totalHits,
                初当り: firstHits,
                大当り確率: unit.大当り確率,
                初当り確率: unit.初当り確率,
                最大持ち玉: maxBalls
            });
        });

        // Calculate averages
        if (stats.totalSpins > 0) {
            stats.avgHitRate = (stats.totalHits / stats.totalSpins * 100).toFixed(2);
            stats.avgFirstHitRate = (stats.totalFirstHits / stats.totalSpins * 100).toFixed(2);
        }

        // Sort machines by performance (total hits)
        stats.machines.sort((a, b) => b.総大当り - a.総大当り);
        
        analysis[machine.machineName] = stats;
    });

    res.json({
        success: true,
        analysis: analysis,
        lastUpdated: lastScrapedTime
    });
});

// Schedule scraping every hour
cron.schedule('0 * * * *', () => {
    console.log('Running scheduled scrape');
    performScraping();
});

// Serve the dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Dashboard available at http://localhost:' + PORT);
    
    // Perform initial real data scraping
    console.log('Performing initial real data scrape...');
    performScraping();
});
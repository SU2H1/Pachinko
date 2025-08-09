const puppeteer = require('puppeteer');

class PachinkoScraper {
    constructor() {
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1366, height: 768 }
        });
        this.page = await this.browser.newPage();
        await this.page.setDefaultNavigationTimeout(30000);
        
        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    async scrapeMachineList(url) {
        try {
            console.log('Navigating to:', url);
            await this.page.goto(url, { waitUntil: 'networkidle2' });
            
            // Wait for content to fully load
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Take screenshot for debugging
            await this.page.screenshot({ path: 'scraper-debug.png', fullPage: true });
            
            // More comprehensive machine link extraction
            const machines = await this.page.evaluate(() => {
                const machineData = [];
                const uniqueUrls = new Set();
                
                // Strategy 1: Look for all links containing machine-related parameters
                const allLinks = document.querySelectorAll('a');
                allLinks.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    // Check multiple possible URL patterns
                    if (href && text && !uniqueUrls.has(href)) {
                        if (href.includes('kisyu') || 
                            href.includes('machine_id') || 
                            href.includes('model') ||
                            (href.includes('dedama.cgi') && href.includes('='))) {
                            
                            // Filter out navigation links
                            if (!text.includes('戻る') && 
                                !text.includes('次へ') && 
                                !text.includes('前へ') &&
                                text.length > 2) {
                                
                                uniqueUrls.add(href);
                                machineData.push({
                                    name: text,
                                    url: href
                                });
                            }
                        }
                    }
                });
                
                // Strategy 2: Look for table cells that might contain machine names
                if (machineData.length === 0) {
                    const cells = document.querySelectorAll('td');
                    cells.forEach(cell => {
                        const link = cell.querySelector('a');
                        if (link && link.href) {
                            const text = link.textContent.trim();
                            if (text && !uniqueUrls.has(link.href)) {
                                uniqueUrls.add(link.href);
                                machineData.push({
                                    name: text,
                                    url: link.href
                                });
                            }
                        }
                    });
                }
                
                // Log page structure for debugging
                console.log('Total links found:', document.querySelectorAll('a').length);
                console.log('Total tables found:', document.querySelectorAll('table').length);
                
                return machineData;
            });
            
            console.log(`Extracted ${machines.length} unique machine links`);
            if (machines.length > 0) {
                console.log('Sample machines:', machines.slice(0, 3).map(m => m.name));
            }
            
            return machines;
        } catch (error) {
            console.error('Error scraping machine list:', error);
            return [];
        }
    }

    async scrapeMachineDetails(machineUrl) {
        try {
            await this.page.goto(machineUrl, { waitUntil: 'networkidle2' });
            
            // Wait a bit for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Extract machine details
            const details = await this.page.evaluate(() => {
                const data = [];
                const tables = document.querySelectorAll('table');
                
                // Find the table with machine data
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    
                    rows.forEach((row, index) => {
                        const cells = row.querySelectorAll('td');
                        
                        // Check if this looks like a data row (not header)
                        if (cells.length >= 8) {
                            const firstCell = cells[0]?.textContent?.trim() || '';
                            
                            // Skip header rows
                            if (firstCell && !isNaN(parseInt(firstCell))) {
                                // Parse each row of machine data
                                const machineInfo = {
                                    台番号: cells[0]?.textContent?.trim() || '',
                                    回転数: cells[1]?.textContent?.trim() || '',
                                    累計スタート: cells[2]?.textContent?.trim() || '',
                                    総大当り: cells[3]?.textContent?.trim() || '',
                                    初当り: cells[4]?.textContent?.trim() || '',
                                    確変当り: cells[5]?.textContent?.trim() || '',
                                    大当り確率: cells[6]?.textContent?.trim() || '',
                                    初当り確率: cells[7]?.textContent?.trim() || '',
                                    最大持ち玉: cells[8]?.textContent?.trim() || '',
                                    前日最終スタート: cells[9]?.textContent?.trim() || ''
                                };
                                
                                data.push(machineInfo);
                            }
                        }
                    });
                });
                
                return data;
            });
            
            console.log(`Found ${details.length} machine units`);
            return details;
        } catch (error) {
            console.error('Error scraping machine details:', error);
            return [];
        }
    }

    async scrapeAllData(baseUrl) {
        try {
            await this.initialize();
            
            console.log('Navigating to pachinko data page...');
            await this.page.goto(baseUrl, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Click on "機種名で探す" button
            console.log('Clicking on 機種名で探す button...');
            const searchButtonClicked = await this.page.evaluate(() => {
                // Look for the black button with "機種名で探す" text
                const buttons = document.querySelectorAll('*');
                for (const button of buttons) {
                    const text = button.textContent.trim();
                    if (text === '機種名で探す' || text.includes('機種名')) {
                        button.click();
                        return true;
                    }
                }
                return false;
            });
            
            if (searchButtonClicked) {
                console.log('Successfully clicked search button, waiting for results...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.log('Could not find search button, trying alternative approach...');
            }
            
            // Look for machine links after clicking
            console.log('Searching for machine types...');
            const machines = await this.searchForMachines();
            console.log(`Found ${machines.length} machines`);
            
            const allData = [];
            
            // Process each machine found
            for (let i = 0; i < Math.min(machines.length, 10); i++) {
                console.log(`Processing ${i + 1}/${Math.min(machines.length, 10)}: ${machines[i].name}`);
                
                try {
                    const machineData = await this.scrapeMachineWithDates(machines[i]);
                    if (machineData && machineData.length > 0) {
                        allData.push({
                            machineName: machines[i].name,
                            machineUrl: machines[i].url,
                            data: machineData,
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (error) {
                    console.error(`Error processing machine ${machines[i].name}:`, error);
                }
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            return allData;
        } catch (error) {
            console.error('Scraping error:', error);
            return [];
        } finally {
            await this.close();
        }
    }
    
    async searchForMachines() {
        try {
            // Extract machine links from the current page
            const machines = await this.page.evaluate(() => {
                const machineData = [];
                const uniqueUrls = new Set();
                
                // Look for links that might be machines
                const allLinks = document.querySelectorAll('a');
                allLinks.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    // Check if this looks like a machine link
                    if (href && text && !uniqueUrls.has(href)) {
                        // Look for patterns that suggest machine names
                        if (text.match(/^[PRC][A-Za-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-・]+/)) {
                            uniqueUrls.add(href);
                            machineData.push({
                                name: text,
                                url: href
                            });
                        }
                    }
                });
                
                return machineData;
            });
            
            return machines;
        } catch (error) {
            console.error('Error searching for machines:', error);
            return [];
        }
    }
    
    async scrapeMachineWithDates(machine) {
        try {
            console.log(`Navigating to machine: ${machine.name}`);
            await this.page.goto(machine.url, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Look for date selection options
            const dateOptions = await this.page.evaluate(() => {
                const dates = [];
                
                // Look for date links or selectors
                const links = document.querySelectorAll('a');
                links.forEach(link => {
                    const text = link.textContent.trim();
                    // Match date patterns like "12/25" or "2024/12/25"
                    if (text.match(/\d{1,4}[\/\-]\d{1,2}[\/\-]?\d{0,2}/) || 
                        text.includes('日') || text.includes('今日') || text.includes('昨日')) {
                        dates.push({
                            date: text,
                            url: link.href
                        });
                    }
                });
                
                return dates;
            });
            
            console.log(`Found ${dateOptions.length} date options`);
            
            // Scrape data for multiple dates
            const allDateData = [];
            
            // Start with current page data
            const currentData = await this.scrapeMachineDetails(this.page.url());
            if (currentData.length > 0) {
                allDateData.push({
                    date: new Date().toISOString().split('T')[0],
                    data: currentData
                });
            }
            
            // Try to get historical data from available dates
            for (let i = 0; i < Math.min(dateOptions.length, 7); i++) {
                try {
                    console.log(`Scraping date: ${dateOptions[i].date}`);
                    await this.page.goto(dateOptions[i].url, { waitUntil: 'networkidle2' });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const dateData = await this.scrapeMachineDetails(this.page.url());
                    if (dateData.length > 0) {
                        allDateData.push({
                            date: dateOptions[i].date,
                            data: dateData
                        });
                    }
                } catch (error) {
                    console.error(`Error scraping date ${dateOptions[i].date}:`, error);
                }
            }
            
            return allDateData;
        } catch (error) {
            console.error('Error scraping machine with dates:', error);
            return [];
        }
    }
    
    async scrapeDirectData() {
        try {
            // Try to extract data directly from tables on the current page
            const data = await this.page.evaluate(() => {
                const results = [];
                const tables = document.querySelectorAll('table');
                
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    let machineName = 'Unknown Machine';
                    const machineData = [];
                    
                    // Try to find machine name from headers or nearby elements
                    const headerElement = table.previousElementSibling || table.querySelector('th');
                    if (headerElement && headerElement.textContent) {
                        const possibleName = headerElement.textContent.trim();
                        if (possibleName.length > 2 && possibleName.length < 50) {
                            machineName = possibleName;
                        }
                    }
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 8) {
                            const firstCell = cells[0]?.textContent?.trim() || '';
                            
                            if (firstCell && !isNaN(parseInt(firstCell))) {
                                machineData.push({
                                    台番号: cells[0]?.textContent?.trim() || '',
                                    回転数: cells[1]?.textContent?.trim() || '',
                                    累計スタート: cells[2]?.textContent?.trim() || '',
                                    総大当り: cells[3]?.textContent?.trim() || '',
                                    初当り: cells[4]?.textContent?.trim() || '',
                                    確変当り: cells[5]?.textContent?.trim() || '',
                                    大当り確率: cells[6]?.textContent?.trim() || '',
                                    初当り確率: cells[7]?.textContent?.trim() || '',
                                    最大持ち玉: cells[8]?.textContent?.trim() || '',
                                    前日最終スタート: cells[9]?.textContent?.trim() || ''
                                });
                            }
                        }
                    });
                    
                    if (machineData.length > 0) {
                        results.push({
                            machineName: machineName,
                            machineUrl: window.location.href,
                            data: machineData,
                            timestamp: new Date().toISOString()
                        });
                    }
                });
                
                return results;
            });
            
            console.log(`Direct extraction found ${data.length} machine data sets`);
            return data;
        } catch (error) {
            console.error('Error in direct data extraction:', error);
            return [];
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = PachinkoScraper;
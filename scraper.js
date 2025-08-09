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
            
            // First, try to navigate to the actual data page
            console.log('Navigating to main page...');
            await this.page.goto(baseUrl, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Look for links to actual machine data pages
            const dataPageUrl = await this.page.evaluate(() => {
                // Look for links that might lead to machine data
                const links = document.querySelectorAll('a');
                for (const link of links) {
                    if (link.href.includes('daidata') || 
                        link.href.includes('data') || 
                        link.textContent.includes('データ') ||
                        link.textContent.includes('出玉情報')) {
                        return link.href;
                    }
                }
                return null;
            });
            
            if (dataPageUrl) {
                console.log('Found data page:', dataPageUrl);
                await this.page.goto(dataPageUrl, { waitUntil: 'networkidle2' });
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            console.log('Fetching machine list...');
            const machines = await this.scrapeMachineList(this.page.url());
            console.log(`Found ${machines.length} machines`);
            
            const allData = [];
            
            // If no machines found, try to scrape data directly from current page
            if (machines.length === 0) {
                console.log('No machine links found, attempting direct data extraction...');
                const directData = await this.scrapeDirectData();
                if (directData && directData.length > 0) {
                    return directData;
                }
            }
            
            for (let i = 0; i < machines.length; i++) {
                console.log(`Scraping ${i + 1}/${machines.length}: ${machines[i].name}`);
                const details = await this.scrapeMachineDetails(machines[i].url);
                
                if (details.length > 0) {
                    allData.push({
                        machineName: machines[i].name,
                        machineUrl: machines[i].url,
                        data: details,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Add delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            return allData;
        } catch (error) {
            console.error('Scraping error:', error);
            return [];
        } finally {
            await this.close();
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
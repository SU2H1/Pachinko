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
            
            console.log('Step 1: Navigating to pachinko data page...');
            await this.page.goto(baseUrl, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Step 2: Click on "機種名で探す" button
            console.log('Step 2: Looking for 機種名で探す button...');
            
            // First, let's see what buttons/elements are available
            const pageElements = await this.page.evaluate(() => {
                const elements = [];
                const allElements = document.querySelectorAll('*');
                
                allElements.forEach(el => {
                    const text = el.textContent.trim();
                    if (text && text.length > 0 && text.length < 20) {
                        elements.push({
                            tag: el.tagName,
                            text: text,
                            id: el.id,
                            className: el.className,
                            clickable: el.onclick !== null || el.style.cursor === 'pointer'
                        });
                    }
                });
                
                return elements.slice(0, 20); // Limit output
            });
            
            console.log('Available page elements:', pageElements);
            
            // Try multiple strategies to find and click the button
            const searchButtonClicked = await this.page.evaluate(() => {
                // Strategy 1: Exact text match
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    const text = element.textContent.trim();
                    if (text === '機種名で探す' && element.offsetWidth > 0 && element.offsetHeight > 0) {
                        console.log('Found button with exact text match');
                        element.click();
                        return { strategy: 'exact', element: element.tagName };
                    }
                }
                
                // Strategy 2: Contains text match
                for (const element of allElements) {
                    const text = element.textContent.trim();
                    if (text.includes('機種名') && text.includes('探す') && element.offsetWidth > 0) {
                        console.log('Found button with contains match:', text);
                        element.click();
                        return { strategy: 'contains', element: element.tagName, text: text };
                    }
                }
                
                // Strategy 3: Look for clickable elements with machine-related text
                for (const element of allElements) {
                    const text = element.textContent.trim();
                    if ((text.includes('機種') || text.includes('種名')) && 
                        (element.onclick !== null || element.style.cursor === 'pointer' || 
                         element.tagName === 'BUTTON' || element.tagName === 'A')) {
                        console.log('Found clickable machine-related element:', text);
                        element.click();
                        return { strategy: 'clickable', element: element.tagName, text: text };
                    }
                }
                
                return false;
            });
            
            if (searchButtonClicked) {
                console.log('✅ Search button clicked, waiting for machine list...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                await this.page.screenshot({ path: 'after-search-click.png' });
            } else {
                console.log('❌ Could not find search button');
                return [];
            }
            
            // Step 3: Extract machine list from the results
            console.log('Step 3: Extracting machine list...');
            const machines = await this.extractMachineList();
            console.log(`Found ${machines.length} machines in list`);
            
            if (machines.length === 0) {
                console.log('No machines found, taking screenshot for debugging');
                await this.page.screenshot({ path: 'no-machines-found.png' });
                return [];
            }
            
            const allData = [];
            
            // Step 4: Process each machine
            for (let i = 0; i < Math.min(machines.length, 5); i++) {
                console.log(`\nStep 4.${i+1}: Processing machine: ${machines[i].name}`);
                
                try {
                    const machineData = await this.processIndividualMachine(machines[i]);
                    if (machineData && machineData.dates && machineData.dates.length > 0) {
                        allData.push({
                            machineName: machines[i].name,
                            machineUrl: machines[i].url,
                            data: machineData.dates,
                            timestamp: new Date().toISOString()
                        });
                        console.log(`✅ Successfully processed ${machines[i].name} with ${machineData.dates.length} dates`);
                    } else {
                        console.log(`❌ No data found for ${machines[i].name}`);
                    }
                } catch (error) {
                    console.error(`Error processing machine ${machines[i].name}:`, error);
                }
                
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
            return allData;
        } catch (error) {
            console.error('Scraping error:', error);
            return [];
        } finally {
            await this.close();
        }
    }
    
    async extractMachineList() {
        try {
            const machines = await this.page.evaluate(() => {
                const machineLinks = [];
                const uniqueUrls = new Set();
                
                // Look for all links on the page
                const allLinks = document.querySelectorAll('a');
                allLinks.forEach(link => {
                    const href = link.href;
                    const text = link.textContent.trim();
                    
                    // Filter for machine links (usually contain machine names)
                    if (href && text && !uniqueUrls.has(href)) {
                        // Look for patterns that suggest pachinko machine names
                        const isPachinkoMachine = (
                            text.match(/^[PCR][A-Za-z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s\-・\u0020]+/) ||
                            text.includes('パチンコ') ||
                            text.includes('スロット') ||
                            (text.length > 5 && text.length < 50)
                        );
                        
                        // Exclude navigation and system links
                        const isNotNavigation = (
                            !text.includes('戻る') &&
                            !text.includes('次へ') &&
                            !text.includes('前へ') &&
                            !text.includes('ホール') &&
                            !text.includes('店舗') &&
                            !href.includes('javascript:') &&
                            !href.includes('mailto:')
                        );
                        
                        if (isPachinkoMachine && isNotNavigation) {
                            uniqueUrls.add(href);
                            machineLinks.push({
                                name: text,
                                url: href
                            });
                        }
                    }
                });
                
                console.log(`Found ${machineLinks.length} potential machine links`);
                return machineLinks;
            });
            
            return machines;
        } catch (error) {
            console.error('Error extracting machine list:', error);
            return [];
        }
    }
    
    async processIndividualMachine(machine) {
        try {
            console.log(`  📍 Navigating to: ${machine.name}`);
            await this.page.goto(machine.url, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Take screenshot of machine page
            await this.page.screenshot({ path: `machine-${machine.name.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
            
            // Step 1: Get current date data
            console.log(`  📊 Extracting current data...`);
            const currentData = await this.extractMachineData();
            
            if (!currentData || currentData.length === 0) {
                console.log(`  ❌ No current data found for ${machine.name}`);
                return null;
            }
            
            const allDateData = [{
                date: new Date().toISOString().split('T')[0],
                data: currentData
            }];
            
            // Step 2: Look for date navigation options
            console.log(`  📅 Looking for date options...`);
            const dateLinks = await this.findDateLinks();
            
            console.log(`  Found ${dateLinks.length} date options`);
            
            // Step 3: Process historical dates
            for (let i = 0; i < Math.min(dateLinks.length, 7); i++) {
                try {
                    console.log(`  📅 Processing date: ${dateLinks[i].dateText}`);
                    
                    // Navigate to historical date
                    await this.page.goto(dateLinks[i].url, { waitUntil: 'networkidle2' });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Extract data for this date
                    const dateData = await this.extractMachineData();
                    
                    if (dateData && dateData.length > 0) {
                        allDateData.push({
                            date: dateLinks[i].dateText,
                            data: dateData
                        });
                        console.log(`  ✅ Got ${dateData.length} units for ${dateLinks[i].dateText}`);
                    }
                } catch (error) {
                    console.error(`  ❌ Error processing date ${dateLinks[i].dateText}:`, error);
                }
            }
            
            return {
                dates: allDateData
            };
            
        } catch (error) {
            console.error(`Error processing individual machine ${machine.name}:`, error);
            return null;
        }
    }
    
    async extractMachineData() {
        try {
            const data = await this.page.evaluate(() => {
                const tableData = [];
                const tables = document.querySelectorAll('table');
                
                tables.forEach(table => {
                    const rows = table.querySelectorAll('tr');
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        
                        if (cells.length >= 8) {
                            const firstCell = cells[0]?.textContent?.trim() || '';
                            
                            // Check if this looks like a machine unit row (starts with number)
                            if (firstCell && /^\d+$/.test(firstCell)) {
                                const unitData = {
                                    台番号: cells[0]?.textContent?.trim() || '',
                                    回転数: cells[1]?.textContent?.trim() || '0',
                                    累計スタート: cells[2]?.textContent?.trim() || '0',
                                    総大当り: cells[3]?.textContent?.trim() || '0',
                                    初当り: cells[4]?.textContent?.trim() || '0',
                                    確変当り: cells[5]?.textContent?.trim() || '0',
                                    大当り確率: cells[6]?.textContent?.trim() || '',
                                    初当り確率: cells[7]?.textContent?.trim() || '',
                                    最大持ち玉: cells[8]?.textContent?.trim() || '0',
                                    前日最終スタート: cells[9]?.textContent?.trim() || '0'
                                };
                                
                                tableData.push(unitData);
                            }
                        }
                    });
                });
                
                return tableData;
            });
            
            return data;
        } catch (error) {
            console.error('Error extracting machine data:', error);
            return [];
        }
    }
    
    async findDateLinks() {
        try {
            const dateLinks = await this.page.evaluate(() => {
                const dates = [];
                const allLinks = document.querySelectorAll('a');
                
                allLinks.forEach(link => {
                    const text = link.textContent.trim();
                    const href = link.href;
                    
                    // Look for date patterns
                    const datePatterns = [
                        /\d{1,2}\/\d{1,2}/,           // MM/DD format
                        /\d{4}\/\d{1,2}\/\d{1,2}/,   // YYYY/MM/DD format
                        /\d{1,2}月\d{1,2}日/,        // Japanese date format
                        /昨日|今日|一昨日/             // Yesterday, today, day before yesterday
                    ];
                    
                    const isDateLink = datePatterns.some(pattern => pattern.test(text));
                    
                    if (isDateLink && href && href !== window.location.href) {
                        dates.push({
                            dateText: text,
                            url: href
                        });
                    }
                });
                
                return dates;
            });
            
            return dateLinks;
        } catch (error) {
            console.error('Error finding date links:', error);
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
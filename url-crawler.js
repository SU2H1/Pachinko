const puppeteer = require('puppeteer');
const fs = require('fs');

class URLCrawler {
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
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    }

    async crawlURL(url) {
        try {
            console.log(`Crawling URL: ${url}`);
            await this.page.goto(url, { waitUntil: 'networkidle2' });
            
            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Extract comprehensive page information
            const pageInfo = await this.page.evaluate(() => {
                const info = {
                    title: document.title,
                    url: window.location.href,
                    timestamp: new Date().toISOString(),
                    meta: {
                        description: document.querySelector('meta[name="description"]')?.content || '',
                        keywords: document.querySelector('meta[name="keywords"]')?.content || ''
                    },
                    structure: {
                        totalElements: document.querySelectorAll('*').length,
                        totalLinks: document.querySelectorAll('a').length,
                        totalTables: document.querySelectorAll('table').length,
                        totalForms: document.querySelectorAll('form').length,
                        totalImages: document.querySelectorAll('img').length
                    },
                    content: {
                        headings: [],
                        links: [],
                        tableHeaders: [],
                        formInputs: []
                    }
                };
                
                // Extract headings
                document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                    info.content.headings.push({
                        tag: heading.tagName.toLowerCase(),
                        text: heading.textContent.trim().substring(0, 100)
                    });
                });
                
                // Extract links with href and text
                document.querySelectorAll('a[href]').forEach((link, index) => {
                    if (index < 20) { // Limit to first 20 links
                        info.content.links.push({
                            href: link.href,
                            text: link.textContent.trim().substring(0, 50),
                            hasJSEvent: link.onclick !== null
                        });
                    }
                });
                
                // Extract table headers
                document.querySelectorAll('table th').forEach((th, index) => {
                    if (index < 20) { // Limit to first 20 headers
                        info.content.tableHeaders.push(th.textContent.trim());
                    }
                });
                
                // Extract form inputs
                document.querySelectorAll('input, select, textarea').forEach((input, index) => {
                    if (index < 10) { // Limit to first 10 inputs
                        info.content.formInputs.push({
                            type: input.type || input.tagName.toLowerCase(),
                            name: input.name || '',
                            placeholder: input.placeholder || '',
                            value: input.value || ''
                        });
                    }
                });
                
                // Look for pachinko-specific content
                info.pachinkoRelated = {
                    hasDataTable: false,
                    hasMachineInfo: false,
                    hasGameResults: false,
                    keywords: []
                };
                
                const bodyText = document.body.textContent.toLowerCase();
                const pachinkoKeywords = ['パチンコ', '台番号', '大当り', '回転数', '出玉', 'データ'];
                
                pachinkoKeywords.forEach(keyword => {
                    if (bodyText.includes(keyword.toLowerCase()) || bodyText.includes(keyword)) {
                        info.pachinkoRelated.keywords.push(keyword);
                        if (keyword === 'データ') info.pachinkoRelated.hasDataTable = true;
                        if (keyword === '台番号') info.pachinkoRelated.hasMachineInfo = true;
                        if (keyword === '大当り') info.pachinkoRelated.hasGameResults = true;
                    }
                });
                
                return info;
            });
            
            // Take screenshot
            const screenshotPath = 'url-analysis-screenshot.png';
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            pageInfo.screenshotPath = screenshotPath;
            
            return pageInfo;
            
        } catch (error) {
            console.error('Error crawling URL:', error);
            return {
                error: error.message,
                url: url,
                timestamp: new Date().toISOString()
            };
        }
    }

    async analyzeSiteStructure(url) {
        const pageInfo = await this.crawlURL(url);
        
        // Generate analysis report
        const report = {
            ...pageInfo,
            analysis: {
                isPachinkoRelated: pageInfo.pachinkoRelated?.keywords.length > 0,
                hasDataContent: pageInfo.structure.totalTables > 0,
                hasNavigation: pageInfo.structure.totalLinks > 5,
                isInteractive: pageInfo.structure.totalForms > 0,
                scrapingRecommendations: []
            }
        };
        
        // Add scraping recommendations
        if (report.structure.totalTables > 0) {
            report.analysis.scrapingRecommendations.push('Use table selectors for data extraction');
        }
        
        if (report.content.links.length > 0) {
            report.analysis.scrapingRecommendations.push('Follow links for detailed data pages');
        }
        
        if (report.pachinkoRelated?.hasMachineInfo) {
            report.analysis.scrapingRecommendations.push('Target machine number and game data');
        }
        
        // Save detailed report
        fs.writeFileSync('url-analysis-report.json', JSON.stringify(report, null, 2));
        console.log('Analysis report saved to url-analysis-report.json');
        
        return report;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

// Export for use in other modules
module.exports = URLCrawler;

// Allow direct execution
if (require.main === module) {
    const crawler = new URLCrawler();
    const targetURL = 'https://www.p-world.co.jp/_machine/dedama.cgi?hall_id=019662&type=pachi';
    
    crawler.initialize()
        .then(() => crawler.analyzeSiteStructure(targetURL))
        .then((report) => {
            console.log('\n=== URL ANALYSIS SUMMARY ===');
            console.log(`Title: ${report.title}`);
            console.log(`URL: ${report.url}`);
            console.log(`Pachinko Related: ${report.analysis.isPachinkoRelated}`);
            console.log(`Has Data Content: ${report.analysis.hasDataContent}`);
            console.log(`Keywords Found: ${report.pachinkoRelated.keywords.join(', ')}`);
            console.log(`Tables Found: ${report.structure.totalTables}`);
            console.log(`Links Found: ${report.structure.totalLinks}`);
            console.log('\nScraping Recommendations:');
            report.analysis.scrapingRecommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec}`);
            });
            console.log(`\nDetailed report: url-analysis-report.json`);
            console.log(`Screenshot: ${report.screenshotPath}`);
        })
        .catch(console.error)
        .finally(() => crawler.close());
}
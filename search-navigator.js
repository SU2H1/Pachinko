const puppeteer = require('puppeteer');

async function findCorrectMachineListURL() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    try {
        // Start from the main P-World site
        console.log('🌐 Starting from P-World main site...');
        await page.goto('https://www.p-world.co.jp/', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Look for pachinko machine search
        console.log('🔍 Looking for pachinko machine search...');
        const searchFound = await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                const text = link.textContent.toLowerCase();
                if (text.includes('パチンコ') || text.includes('機種') || text.includes('検索')) {
                    link.click();
                    return { found: true, text: link.textContent, href: link.href };
                }
            }
            return { found: false };
        });
        
        if (searchFound.found) {
            console.log('✅ Found search link:', searchFound.text);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if we're on the right page now
            const currentURL = page.url();
            const hasCorrectStructure = await page.evaluate(() => {
                const targetElements = document.querySelectorAll('body#SearchListPachinko div#Prime-Column article section.list1col ul.m_list li.Pachinko a');
                return {
                    hasBodyId: document.body.id === 'SearchListPachinko',
                    machineCount: targetElements.length,
                    currentURL: window.location.href
                };
            });
            
            console.log('📊 Current page analysis:', hasCorrectStructure);
            
            if (hasCorrectStructure.machineCount > 0) {
                console.log('🎯 SUCCESS! Found working URL with machines:', currentURL);
                return currentURL;
            }
        }
        
        // Try searching for specific hall
        console.log('🏢 Trying specific hall search...');
        await page.goto('https://www.p-world.co.jp/', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to find search by area/prefecture
        const areaSearch = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input, select');
            const buttons = document.querySelectorAll('button, input[type="submit"]');
            
            // Try to find Kanagawa/神奈川 option
            for (const select of document.querySelectorAll('select')) {
                const options = select.querySelectorAll('option');
                for (const option of options) {
                    if (option.textContent.includes('神奈川')) {
                        select.value = option.value;
                        select.dispatchEvent(new Event('change'));
                        return { found: true, type: 'area', value: option.textContent };
                    }
                }
            }
            
            return { found: false };
        });
        
        if (areaSearch.found) {
            console.log('🗾 Selected area:', areaSearch.value);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Try to submit or continue
            await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, input[type="submit"], a');
                for (const btn of buttons) {
                    const text = btn.textContent.toLowerCase();
                    if (text.includes('検索') || text.includes('探す') || text.includes('送信')) {
                        btn.click();
                        return;
                    }
                }
            });
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const finalCheck = await page.evaluate(() => {
                const targetElements = document.querySelectorAll('body#SearchListPachinko div#Prime-Column article section.list1col ul.m_list li.Pachinko a');
                return {
                    url: window.location.href,
                    machineCount: targetElements.length,
                    bodyId: document.body.id
                };
            });
            
            console.log('🎯 Final check:', finalCheck);
            
            if (finalCheck.machineCount > 0) {
                console.log('✅ SUCCESS! Found working URL:', finalCheck.url);
                return finalCheck.url;
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Error during search:', error);
        return null;
    } finally {
        await browser.close();
    }
}

// Export and run
module.exports = findCorrectMachineListURL;

if (require.main === module) {
    findCorrectMachineListURL().then(url => {
        if (url) {
            console.log('\n🎉 WORKING URL FOUND:', url);
        } else {
            console.log('\n❌ No working URL found');
        }
    });
}
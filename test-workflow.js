const PachinkoScraper = require('./scraper');

async function testCompleteWorkflow() {
    console.log('🎰 Testing Complete Pachinko Scraper Workflow');
    console.log('='.repeat(50));
    
    const scraper = new PachinkoScraper();
    const targetURL = 'https://www.p-world.co.jp/_machine/dedama.cgi?hall_id=019662&type=pachi';
    
    try {
        console.log('Starting complete workflow test...\n');
        
        const startTime = Date.now();
        const data = await scraper.scrapeAllData(targetURL);
        const endTime = Date.now();
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 WORKFLOW TEST RESULTS');
        console.log('='.repeat(50));
        
        console.log(`⏱️  Total execution time: ${Math.round((endTime - startTime) / 1000)}s`);
        console.log(`🎰 Machines processed: ${data.length}`);
        
        if (data.length > 0) {
            console.log('\n📋 Machine Summary:');
            
            data.forEach((machine, index) => {
                console.log(`\n${index + 1}. ${machine.machineName}`);
                console.log(`   📅 Dates collected: ${machine.data.length}`);
                
                machine.data.forEach((dateEntry, dateIndex) => {
                    if (dateEntry.data && Array.isArray(dateEntry.data)) {
                        console.log(`   ${dateIndex + 1}) ${dateEntry.date}: ${dateEntry.data.length} units`);
                        
                        // Show sample data from first unit
                        if (dateEntry.data.length > 0) {
                            const sampleUnit = dateEntry.data[0];
                            console.log(`      Sample: 台${sampleUnit.台番号} - ${sampleUnit.総大当り}大当り, ${sampleUnit.回転数}回転`);
                        }
                    }
                });
            });
            
            // Calculate total statistics
            let totalUnits = 0;
            let totalDates = 0;
            
            data.forEach(machine => {
                totalDates += machine.data.length;
                machine.data.forEach(dateEntry => {
                    if (dateEntry.data) {
                        totalUnits += dateEntry.data.length;
                    }
                });
            });
            
            console.log('\n📈 Overall Statistics:');
            console.log(`   Total Units Scraped: ${totalUnits}`);
            console.log(`   Total Date Entries: ${totalDates}`);
            console.log(`   Average Dates per Machine: ${(totalDates / data.length).toFixed(1)}`);
            console.log(`   Average Units per Date: ${(totalUnits / totalDates).toFixed(1)}`);
            
        } else {
            console.log('❌ No data was scraped. Check the workflow steps.');
        }
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
    } finally {
        await scraper.close();
    }
}

// Run the test
if (require.main === module) {
    testCompleteWorkflow();
}
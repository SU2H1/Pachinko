let currentData = null;
let analysisData = null;
let overviewChart = null;
let comparisonChart = null;
let trendChart = null;
let trendPeriod = 30;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setInterval(checkForUpdates, 60000); // Check for updates every minute
});

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

// Fetch data from server
async function fetchData() {
    showLoading(true);
    updateStatus('データを取得中...');
    
    try {
        const response = await fetch('/api/data');
        const result = await response.json();
        
        if (result.success) {
            currentData = result.data;
            
            if (currentData && currentData.length > 0) {
                updateStatus('データ取得完了');
                updateLastUpdated(result.lastUpdated);
                
                // Fetch analysis data
                const analysisResponse = await fetch('/api/analyze');
                const analysisResult = await analysisResponse.json();
                
                if (analysisResult.success) {
                    analysisData = analysisResult.analysis;
                    updateDashboard();
                }
            } else {
                updateStatus('データがありません。スクレイピングを実行してください。');
            }
        } else {
            updateStatus('データ取得エラー');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        updateStatus('データ取得エラー: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Scrape new data
async function scrapeNewData() {
    showLoading(true);
    updateStatus('スクレイピング実行中... これには数分かかる場合があります。');
    
    try {
        const response = await fetch('/api/scrape');
        const result = await response.json();
        
        if (result.success) {
            currentData = result.data;
            updateStatus('スクレイピング完了');
            updateLastUpdated(result.lastUpdated);
            
            // Fetch updated analysis
            const analysisResponse = await fetch('/api/analyze');
            const analysisResult = await analysisResponse.json();
            
            if (analysisResult.success) {
                analysisData = analysisResult.analysis;
                updateDashboard();
            }
        } else {
            updateStatus('スクレイピングエラー: ' + result.error);
        }
    } catch (error) {
        console.error('Error scraping:', error);
        updateStatus('スクレイピングエラー: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Update entire dashboard
function updateDashboard() {
    if (!currentData || !analysisData) return;
    
    updateOverview();
    updateMachineList();
    updateTrendOptions();
    updateTrendChart();
    updateAnalysis();
}

// Update overview section
function updateOverview() {
    let totalMachines = Object.keys(analysisData).length;
    let totalUnits = 0;
    let totalHits = 0;
    let avgHitRates = [];
    
    Object.values(analysisData).forEach(machine => {
        totalUnits += machine.totalMachines;
        totalHits += machine.totalHits;
        if (machine.avgHitRate > 0) {
            avgHitRates.push(parseFloat(machine.avgHitRate));
        }
    });
    
    const avgHitRate = avgHitRates.length > 0 
        ? (avgHitRates.reduce((a, b) => a + b, 0) / avgHitRates.length).toFixed(2)
        : '0';
    
    document.getElementById('totalMachines').textContent = totalMachines;
    document.getElementById('totalUnits').textContent = totalUnits;
    document.getElementById('totalHits').textContent = totalHits.toLocaleString();
    document.getElementById('avgHitRate').textContent = avgHitRate + '%';
    
    // Update overview chart
    updateOverviewChart();
}

// Update overview chart
function updateOverviewChart() {
    const ctx = document.getElementById('overviewChart').getContext('2d');
    
    const labels = Object.keys(analysisData).slice(0, 10);
    const hitData = labels.map(name => analysisData[name].totalHits);
    const spinData = labels.map(name => analysisData[name].totalSpins);
    
    if (overviewChart) {
        overviewChart.destroy();
    }
    
    overviewChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '総大当り回数',
                    data: hitData,
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 1
                },
                {
                    label: '総回転数',
                    data: spinData,
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 1,
                    hidden: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '機種別パフォーマンス'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update machine list
function updateMachineList() {
    const machineList = document.getElementById('machineList');
    machineList.innerHTML = '';
    
    Object.entries(analysisData).forEach(([name, data]) => {
        const card = document.createElement('div');
        card.className = 'machine-card';
        card.innerHTML = `
            <h3>${name}</h3>
            <div class="machine-stats">
                <div class="machine-stat">
                    <label>台数</label>
                    <span>${data.totalMachines}</span>
                </div>
                <div class="machine-stat">
                    <label>総大当り</label>
                    <span>${data.totalHits}</span>
                </div>
                <div class="machine-stat">
                    <label>総初当り</label>
                    <span>${data.totalFirstHits}</span>
                </div>
                <div class="machine-stat">
                    <label>総回転数</label>
                    <span>${data.totalSpins}</span>
                </div>
                <div class="machine-stat">
                    <label>平均大当り率</label>
                    <span>${data.avgHitRate}%</span>
                </div>
                <div class="machine-stat">
                    <label>最大持ち玉</label>
                    <span>${data.maxBalls}</span>
                </div>
            </div>
        `;
        machineList.appendChild(card);
    });
}

// Filter machines
function filterMachines() {
    const searchTerm = document.getElementById('machineSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.machine-card');
    
    cards.forEach(card => {
        const machineName = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = machineName.includes(searchTerm) ? 'block' : 'none';
    });
}

// Sort machines
function sortMachines() {
    const sortBy = document.getElementById('sortBy').value;
    const machineList = document.getElementById('machineList');
    const cards = Array.from(machineList.children);
    
    cards.sort((a, b) => {
        const nameA = a.querySelector('h3').textContent;
        const nameB = b.querySelector('h3').textContent;
        const dataA = analysisData[nameA];
        const dataB = analysisData[nameB];
        
        switch(sortBy) {
            case 'name':
                return nameA.localeCompare(nameB);
            case 'hits':
                return dataB.totalHits - dataA.totalHits;
            case 'rate':
                return parseFloat(dataB.avgHitRate) - parseFloat(dataA.avgHitRate);
            default:
                return 0;
        }
    });
    
    machineList.innerHTML = '';
    cards.forEach(card => machineList.appendChild(card));
}

// Update analysis section
function updateAnalysis() {
    updateTopPerformers();
    updateComparisonChart();
    updateDetailTable();
}

// Update top performers
function updateTopPerformers() {
    const topPerformers = document.getElementById('topPerformers');
    topPerformers.innerHTML = '';
    
    // Collect all individual machines
    const allMachines = [];
    Object.entries(analysisData).forEach(([machineName, data]) => {
        data.machines.forEach(machine => {
            allMachines.push({
                ...machine,
                machineName: machineName
            });
        });
    });
    
    // Sort by total hits
    allMachines.sort((a, b) => b.総大当り - a.総大当り);
    
    // Display top 10
    allMachines.slice(0, 10).forEach((machine, index) => {
        const item = document.createElement('div');
        item.className = 'performer-item';
        item.innerHTML = `
            <div class="performer-rank">#${index + 1}</div>
            <div class="performer-info">
                <div class="performer-name">${machine.machineName} - 台番号 ${machine.台番号}</div>
                <div class="performer-stats">
                    大当り: ${machine.総大当り} | 回転数: ${machine.回転数} | 持ち玉: ${machine.最大持ち玉}
                </div>
            </div>
        `;
        topPerformers.appendChild(item);
    });
}

// Update comparison chart
function updateComparisonChart() {
    const ctx = document.getElementById('machineComparisonChart').getContext('2d');
    
    const labels = Object.keys(analysisData).slice(0, 5);
    const avgHitRates = labels.map(name => parseFloat(analysisData[name].avgHitRate));
    const avgFirstHitRates = labels.map(name => parseFloat(analysisData[name].avgFirstHitRate));
    
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    
    comparisonChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '平均大当り率',
                    data: avgHitRates,
                    backgroundColor: 'rgba(102, 126, 234, 0.2)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    pointBackgroundColor: 'rgba(102, 126, 234, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(102, 126, 234, 1)'
                },
                {
                    label: '平均初当り率',
                    data: avgFirstHitRates,
                    backgroundColor: 'rgba(118, 75, 162, 0.2)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    pointBackgroundColor: 'rgba(118, 75, 162, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(118, 75, 162, 1)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '機種別確率比較'
                }
            }
        }
    });
}

// Update detail table
function updateDetailTable() {
    const detailTable = document.getElementById('detailTable');
    
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>機種名</th>
                    <th>台番号</th>
                    <th>回転数</th>
                    <th>総大当り</th>
                    <th>初当り</th>
                    <th>大当り確率</th>
                    <th>初当り確率</th>
                    <th>最大持ち玉</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Object.entries(analysisData).forEach(([machineName, data]) => {
        data.machines.slice(0, 5).forEach(machine => {
            tableHTML += `
                <tr>
                    <td>${machineName}</td>
                    <td>${machine.台番号}</td>
                    <td>${machine.回転数}</td>
                    <td>${machine.総大当り}</td>
                    <td>${machine.初当り}</td>
                    <td>${machine.大当り確率}</td>
                    <td>${machine.初当り確率}</td>
                    <td>${machine.最大持ち玉}</td>
                </tr>
            `;
        });
    });
    
    tableHTML += '</tbody></table>';
    detailTable.innerHTML = tableHTML;
}

// Helper functions
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (show) {
        spinner.classList.remove('hidden');
    } else {
        spinner.classList.add('hidden');
    }
}

function updateStatus(message) {
    document.getElementById('statusMessage').textContent = message;
}

function updateLastUpdated(timestamp) {
    if (timestamp) {
        const date = new Date(timestamp);
        const formatted = date.toLocaleString('ja-JP');
        document.getElementById('lastUpdated').textContent = `最終更新: ${formatted}`;
    }
}

// Trend analysis functions
function updateTrendOptions() {
    const trendMachineSelect = document.getElementById('trendMachine');
    trendMachineSelect.innerHTML = '<option value="">全機種</option>';
    
    if (currentData && currentData.length > 0) {
        currentData.forEach(machine => {
            const option = document.createElement('option');
            option.value = machine.machineName;
            option.textContent = machine.machineName;
            trendMachineSelect.appendChild(option);
        });
    }
}

function updateTrendPeriod() {
    trendPeriod = parseInt(document.getElementById('datePeriod').value);
    updateTrendChart();
}

function updateTrendChart() {
    if (!currentData || currentData.length === 0) return;
    
    const selectedMachine = document.getElementById('trendMachine').value;
    const selectedMetric = document.getElementById('trendMetric').value;
    
    // Generate trend data based on selected machine and metric
    const trendData = generateTrendData(selectedMachine, selectedMetric, trendPeriod);
    
    if (trendData.labels.length === 0) {
        console.log('No trend data available');
        return;
    }
    
    // Update trend chart
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChart) {
        trendChart.destroy();
    }
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.labels,
            datasets: trendData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${selectedMachine || '全機種'} - ${getMetricName(selectedMetric)}の推移`
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '日付'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: getMetricName(selectedMetric)
                    },
                    beginAtZero: true
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Update trend statistics
    updateTrendStats(trendData);
}

function generateTrendData(selectedMachine, selectedMetric, periodDays) {
    if (!currentData || currentData.length === 0) {
        return { labels: [], datasets: [] };
    }
    
    // Collect all available dates from the data
    const allDates = new Set();
    currentData.forEach(machine => {
        if (machine.data && Array.isArray(machine.data)) {
            machine.data.forEach(dateEntry => {
                if (dateEntry.date) {
                    allDates.add(dateEntry.date);
                }
            });
        }
    });
    
    // Sort dates and limit to the specified period
    const sortedDates = Array.from(allDates).sort().slice(-periodDays);
    
    if (sortedDates.length === 0) {
        // Fallback: create a date range if no dates in data
        const labels = [];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - periodDays);
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            labels.push(d.toLocaleDateString('ja-JP'));
        }
        
        return generateSimulatedTrendData(selectedMachine, selectedMetric, labels);
    }
    
    const labels = sortedDates.map(date => {
        try {
            return new Date(date).toLocaleDateString('ja-JP');
        } catch {
            return date; // Use original date string if parsing fails
        }
    });
    
    const datasets = [];
    
    if (selectedMachine) {
        // Single machine trend using real date data
        const machine = currentData.find(m => m.machineName === selectedMachine);
        if (machine && machine.data && Array.isArray(machine.data)) {
            const values = sortedDates.map(date => {
                const dateEntry = machine.data.find(entry => entry.date === date);
                if (dateEntry && dateEntry.data) {
                    return calculateMetricValue(dateEntry.data, selectedMetric);
                }
                return null; // null for missing dates
            });
            
            datasets.push({
                label: machine.machineName,
                data: values,
                borderColor: 'rgba(102, 126, 234, 1)',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                spanGaps: true // Connect lines across null values
            });
        }
    } else {
        // Multiple machines trend using real date data
        const colors = [
            'rgba(102, 126, 234, 1)',
            'rgba(118, 75, 162, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)'
        ];
        
        currentData.slice(0, 5).forEach((machine, index) => {
            if (machine.data && Array.isArray(machine.data)) {
                const values = sortedDates.map(date => {
                    const dateEntry = machine.data.find(entry => entry.date === date);
                    if (dateEntry && dateEntry.data) {
                        return calculateMetricValue(dateEntry.data, selectedMetric);
                    }
                    return null;
                });
                
                // Only add if there's some data
                if (values.some(v => v !== null)) {
                    datasets.push({
                        label: machine.machineName,
                        data: values,
                        borderColor: colors[index % colors.length],
                        backgroundColor: colors[index % colors.length].replace('1)', '0.1)'),
                        tension: 0.4,
                        fill: false,
                        spanGaps: true
                    });
                }
            }
        });
    }
    
    return { labels, datasets };
}

function generateSimulatedTrendData(selectedMachine, selectedMetric, labels) {
    const datasets = [];
    
    if (selectedMachine) {
        const machine = currentData.find(m => m.machineName === selectedMachine);
        if (machine && machine.data && Array.isArray(machine.data)) {
            // Use first available date's data as baseline
            const baseData = machine.data[0]?.data;
            if (baseData) {
                const baseValue = calculateMetricValue(baseData, selectedMetric);
                const values = labels.map((label, index) => {
                    const variation = (Math.sin(index * 0.3) + Math.random() - 0.5) * 0.1;
                    return Math.max(0, Math.round(baseValue * (1 + variation)));
                });
                
                datasets.push({
                    label: machine.machineName + ' (推定)',
                    data: values,
                    borderColor: 'rgba(102, 126, 234, 0.7)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderDash: [5, 5] // Dashed line to indicate simulation
                });
            }
        }
    } else {
        const colors = [
            'rgba(102, 126, 234, 0.7)',
            'rgba(118, 75, 162, 0.7)',
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)'
        ];
        
        currentData.slice(0, 5).forEach((machine, index) => {
            if (machine.data && Array.isArray(machine.data)) {
                const baseData = machine.data[0]?.data;
                if (baseData) {
                    const baseValue = calculateMetricValue(baseData, selectedMetric);
                    const values = labels.map((label, labelIndex) => {
                        const variation = (Math.sin(labelIndex * 0.3 + index) + Math.random() - 0.5) * 0.15;
                        return Math.max(0, Math.round(baseValue * (1 + variation)));
                    });
                    
                    datasets.push({
                        label: machine.machineName + ' (推定)',
                        data: values,
                        borderColor: colors[index % colors.length],
                        backgroundColor: colors[index % colors.length].replace('0.7)', '0.1)'),
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5]
                    });
                }
            }
        });
    }
    
    return { labels, datasets };
}

function calculateMetricValue(machineData, metric) {
    if (!machineData || !Array.isArray(machineData)) return 0;
    
    switch (metric) {
        case 'totalHits':
            return machineData.reduce((sum, unit) => sum + (parseInt(unit.総大当り) || 0), 0);
        case 'firstHits':
            return machineData.reduce((sum, unit) => sum + (parseInt(unit.初当り) || 0), 0);
        case 'spins':
            return machineData.reduce((sum, unit) => sum + (parseInt(unit.回転数) || 0), 0);
        case 'hitRate':
            const totalHits = machineData.reduce((sum, unit) => sum + (parseInt(unit.総大当り) || 0), 0);
            const totalSpins = machineData.reduce((sum, unit) => sum + (parseInt(unit.回転数) || 0), 0);
            return totalSpins > 0 ? ((totalHits / totalSpins) * 100) : 0;
        default:
            return 0;
    }
}

function getMetricName(metric) {
    const names = {
        'totalHits': '総大当り',
        'firstHits': '初当り',
        'spins': '回転数',
        'hitRate': '大当り確率(%)'
    };
    return names[metric] || metric;
}

function updateTrendStats(trendData) {
    if (!trendData || !trendData.datasets || trendData.datasets.length === 0) {
        document.getElementById('trendAverage').textContent = '-';
        document.getElementById('trendMax').textContent = '-';
        document.getElementById('trendChange').textContent = '-';
        document.getElementById('trendDirection').textContent = '-';
        return;
    }
    
    // Calculate stats from the first dataset
    const data = trendData.datasets[0].data.filter(val => val !== null && val !== undefined);
    
    if (data.length === 0) {
        document.getElementById('trendAverage').textContent = '-';
        document.getElementById('trendMax').textContent = '-';
        document.getElementById('trendChange').textContent = '-';
        document.getElementById('trendDirection').textContent = '-';
        return;
    }
    
    const average = (data.reduce((sum, val) => sum + val, 0) / data.length).toFixed(1);
    const max = Math.max(...data);
    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    const change = firstValue > 0 ? (((lastValue - firstValue) / firstValue) * 100).toFixed(1) : 0;
    
    document.getElementById('trendAverage').textContent = average;
    document.getElementById('trendMax').textContent = max;
    document.getElementById('trendChange').textContent = `${change}%`;
    
    // Determine trend direction
    const trendElement = document.getElementById('trendDirection');
    if (change > 5) {
        trendElement.textContent = '上昇 ↗';
        trendElement.className = 'trend-direction-up';
    } else if (change < -5) {
        trendElement.textContent = '下降 ↘';
        trendElement.className = 'trend-direction-down';
    } else {
        trendElement.textContent = '安定 →';
        trendElement.className = 'trend-direction-stable';
    }
}

// Check for updates periodically
async function checkForUpdates() {
    try {
        const response = await fetch('/api/data');
        const result = await response.json();
        
        if (result.success && result.lastUpdated) {
            updateLastUpdated(result.lastUpdated);
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}
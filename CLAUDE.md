# Claude Development Guidelines

## MANDATORY Git Workflow
**ALWAYS execute these commands after making changes:**
1. `git add .` - Stage all changes
2. `git commit -m "descriptive message"` - Commit with clear message
3. `git push origin main` - Push to GitHub repository

## MANDATORY Process Termination
**ALWAYS terminate localhost processes before ending session:**
```bash
netstat -ano | findstr :3000
taskkill //F //PID [PID_NUMBER]
```

## Development Principles
- **NEVER use mock/fake/placeholder data** - Only real data from actual sources
- **NO test data generators** - Always scrape/fetch real data
- **DELETE any mock data files immediately**
- Always work with production-ready, real data
- **ALWAYS terminate running localhost processes**

## Gemini CLI Usage (REQUIRED)
**Aggressively use Gemini CLI for all development tasks:**

### How to use Gemini:
```bash
echo "your question or request" | gemini
```

### Use Gemini for:
- Debugging scraper issues: `echo "debug puppeteer scraper error: [error]" | gemini`
- Optimization: `echo "optimize this JavaScript code: [code]" | gemini`
- Architecture decisions: `echo "best practice for [task]" | gemini`
- Data analysis: `echo "analyze this data pattern: [data]" | gemini`
- Performance improvements: `echo "improve performance of [function]" | gemini`

## Project Files Structure
### Core Files:
- `server.js` - Express API server with real-time scraping
- `scraper.js` - Enhanced Puppeteer scraper with 機種名で探す button interaction
- `url-crawler.js` - URL content analysis tool
- `public/index.html` - Dashboard with trend analysis tab
- `public/styles.css` - Responsive styling with trend components
- `public/dashboard.js` - Interactive dashboard with line graphs

### Analysis Files:
- `url-analysis-report.json` - Site structure analysis
- `url-analysis-screenshot.png` - Visual site inspection

## Pachinko Project Discoveries & Features
- **Target URL**: https://www.p-world.co.jp/_machine/dedama.cgi?hall_id=019662&type=pachi
- **Site Type**: Search interface for pachinko data (not direct data page)
- **Scraper Enhancement**: ✅ Automatically clicks 機種名で探す button
- **Date Selection**: ✅ Extracts historical data from available date options
- **Required Data Fields**: 台番号, 回転数, 累計スタート, 総大当り, 初当り, 確変当り, 大当り確率, 初当り確率, 最大持ち玉, 前日最終スタート
- **Update Frequency**: Every hour via cron job
- **Dashboard**: http://localhost:3000

### New Dashboard Features:
- **📊 Trend Analysis Tab**: Line graphs for machine statistics over time
- **📅 Period Controls**: 7, 14, 30, or 60-day analysis periods
- **🎰 Machine Selection**: Individual machine or all machines comparison
- **📈 Metric Selection**: Total hits, first hits, spins, hit rate analysis
- **📊 Trend Statistics**: Average, maximum, change rate, and direction indicators
- **📱 Responsive Design**: Mobile-optimized interface

## URL Analysis Results
```json
{
  "title": "アビバ湘南台店出玉情報 - P-WORLD",
  "isPachinkoRelated": true,
  "hasDataContent": false,
  "totalLinks": 1,
  "totalTables": 0,
  "keywords": ["出玉", "データ"],
  "scrapingStrategy": "Must interact with search interface to access actual data"
}
```

## Development Workflow
1. **Terminate any running processes**: `taskkill //F //PID [PID]`
2. Make changes to code
3. Use Gemini to validate/optimize: `echo "review this code: [code]" | gemini`
4. Use URL crawler for site analysis: `node url-crawler.js`
5. Test with real data only
6. `git add .`
7. `git commit -m "feat: description of change"`
8. `git push origin main`

## Commit Message Format
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation updates
- `style:` - Formatting changes
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

## Tools and Commands
- **URL Analysis**: `node url-crawler.js`
- **Start Server**: `npm start`
- **Check Processes**: `netstat -ano | findstr :3000`
- **Kill Process**: `taskkill //F //PID [PID]`
- **Gemini AI**: `echo "query" | gemini`
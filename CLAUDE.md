# Claude Development Guidelines

## MANDATORY Git Workflow
**ALWAYS execute these commands after making changes:**
1. `git add .` - Stage all changes
2. `git commit -m "descriptive message"` - Commit with clear message
3. `git push origin main` - Push to GitHub repository

## Development Principles
- **NEVER use mock/fake/placeholder data** - Only real data from actual sources
- **NO test data generators** - Always scrape/fetch real data
- **DELETE any mock data files immediately**
- Always work with production-ready, real data

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

## Pachinko Project Specific
- **Target URL**: https://www.p-world.co.jp/_machine/dedama.cgi?hall_id=019662&type=pachi
- **Required Data Fields**: 台番号, 回転数, 累計スタート, 総大当り, 初当り, 確変当り, 大当り確率, 初当り確率, 最大持ち玉, 前日最終スタート
- **Update Frequency**: Every hour via cron job
- **Dashboard**: http://localhost:3000

## Development Workflow
1. Make changes to code
2. Use Gemini to validate/optimize: `echo "review this code: [code]" | gemini`
3. Test with real data only
4. `git add .`
5. `git commit -m "feat: description of change"`
6. `git push origin main`

## Commit Message Format
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code refactoring
- `docs:` - Documentation
- `style:` - Formatting changes
- `perf:` - Performance improvements
# Claude Development Guidelines

## Git Workflow
- Always use `git add .` to stage changes
- Always use `git commit -m "descriptive message"` to commit changes
- Always use `git push origin main` to push changes to remote repository

## Development Principles
- NO false data or placeholders - use real data only
- NO mock data in production code
- Always fetch and work with actual live data from sources

## Gemini CLI Integration
- Actively use Gemini CLI for AI assistance
- Access Gemini by typing `gemini` in terminal
- Use Gemini aggressively for:
  - Code optimization suggestions
  - Bug fixing assistance
  - Architecture decisions
  - Data analysis insights
  - Performance improvements

## Commands to Run
When making changes to the codebase:
1. `git add .`
2. `git commit -m "descriptive commit message"`
3. `git push origin main`

For AI assistance:
- `gemini "your question or request"`

## Project-Specific Requirements
- Scrape real data from p-world.co.jp
- No mock data generators in production
- Always validate scraped data
- Use Gemini for scraping strategy improvements
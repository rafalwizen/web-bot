# Web Bot

Automated web scraper that captures screenshots and extracts email addresses from websites.

## Features

- 📸 Automated website screenshot capture
- 📧 Email address extraction from web pages
- 📄 Process multiple URLs from a text file
- 💾 Export results to JSON format

## Requirements

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rafalwizen/web-bot.git
cd web-bot
```

2. Install dependencies:
```bash
npm install
```

## Usage

### Prepare URLs File

Create a `urls.txt` file in the project root and add URLs (one per line):

```
https://example1.com
https://example2.com
https://example3.com
```

### Run the Bot

```bash
node bot.js
```

The bot will automatically:
1. Read URLs from `urls.txt`
2. Open each website in Chromium browser
3. Take a screenshot and save it to `screenshots/` folder
4. Search for email addresses on the page
5. Save results to `results.json`

### Results

Results are saved in `results.json`:

```json
[
  {
    "url": "https://example.com",
    "email": "contact@example.com",
    "screenshot": "screenshots/2026-03-11-18-05-03-495Z-example-com.png",
    "timestamp": "2026-03-11T18:05:03.495Z"
  }
]
```

## Project Structure

```
web-bot/
├── bot.js              # Main bot file
├── package.json        # Dependencies and scripts
├── urls.txt           # List of URLs to process
├── results.json       # Processing results
├── screenshots/       # Folder with screenshots
└── node_modules/      # Dependencies (auto-generated)
```

## Dependencies

- `puppeteer` - Chromium browser automation library

## Example Usage

```bash
# Run the bot with default urls.txt file
node bot.js

# Output:
# === Web Bot ===
# Found 3 URLs to process
#
# Launching browser...
# Processing: https://example.com
#   ✓ Screenshot saved: screenshots/2026-03-11-18-05-03-495Z-example-com.png
#   ✓ Email found: contact@example.com
#
# ✅ Processed pages: 3/3
# ✅ Emails found: 2/3
```

## Optional Configurations

The bot can be customized in `bot.js`:
- Page load timeout
- Screenshot dimensions
- Output file format

## Notes

- Bot requires internet connection
- Pages with heavy JavaScript may need longer loading times
- Email addresses are extracted by analyzing page text
- Screenshots are saved in PNG format with timestamp in filename

## License

MIT

## Author

Created by Claude Code & Rafal Wizen

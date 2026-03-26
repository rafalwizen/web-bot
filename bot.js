const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Reads URLs from a TXT file
 * @param {string} filePath - path to the file
 * @returns {string[]} - array of URLs
 */
function readUrlsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Skip empty lines and comments
  } catch (error) {
    console.error(`Error while loading file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Searches for emails on the page
 * @param {Page} page - Puppeteer page
 * @returns {string|null} - found email or null
 */
async function findEmails(page) {
  try {
    // Search for mailto links
    const mailtoLinks = await page.$$eval('a[href^="mailto:"]', links => {
      return links.map(link => {
        const href = link.getAttribute('href');
        return href ? href.replace('mailto:', '').trim() : null;
      }).filter(email => email !== null);
    });

    if (mailtoLinks.length > 0) {
      return mailtoLinks[0]; // Return the first found email
    }

    // Search for emails in text content
    const bodyText = await page.evaluate(() => document.body.innerText);
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
    const emails = bodyText.match(emailRegex);

    if (emails && emails.length > 0) {
      return emails[0]; // Return the first found email
    }

    return null;
  } catch (error) {
    console.error('Error while searching for emails:', error.message);
    return null;
  }
}

/**
 * Generates a safe filename from URL
 * @param {string} url - URL address
 * @returns {string} - safe filename
 */
function generateSafeFileName(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '-');
    return `${timestamp}-${hostname}.png`;
  } catch (error) {
    return `screenshot-${Date.now()}.png`;
  }
}

/**
 * Scrapes the page: takes screenshot and searches for emails
 * @param {string} url - URL address
 * @param {Browser} browser - Puppeteer browser
 * @param {number} index - ordinal number of the currently processed page
 * @returns {Object} - scraping result {url, email, screenshot}
 */
async function scrapePage(url, browser, index) {
  console.log(`Przetwarzanie: ${index}. ${url}`);

  try {
    const page = await browser.newPage();

    // Set timeout and viewport
    page.setDefaultTimeout(30000); // 30 seconds timeout
    await page.setViewport({ width: 1920, height: 1080 });

    // Open the page
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Take screenshot
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const screenshotName = generateSafeFileName(url);
    const screenshotPath = path.join(screenshotsDir, screenshotName);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`  ✓ Screenshot zapisany: ${screenshotName}`);

    // Search for email
    const email = await findEmails(page);
    if (email) {
      console.log(`  ✓ Email found: ${email}`);
    } else {
      console.log(`  ✗ Email not found`);
    }

    await page.close();

    return {
      url: url,
      email: email,
      screenshot: screenshotPath
    };

  } catch (error) {
    console.error(`  ✗ Error while processing ${url}:`, error.message);
    return {
      url: url,
      email: null,
      screenshot: null,
      error: error.message
    };
  }
}

/**
 * Saves results to JSON file
 * @param {Array} results - array of results
 */
function saveResults(results) {
  try {
    const filePath = path.join(__dirname, 'results.json');
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✓ Results saved to: ${filePath}`);
  } catch (error) {
    console.error('Error while saving results:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Web Bot ===\n');

  // Read URL from file
  const urlsFilePath = path.join(__dirname, 'urls.txt');
  const urls = readUrlsFromFile(urlsFilePath);

  if (urls.length === 0) {
    console.error('No URLs found in urls.txt file');
    console.log('Add URLs to urls.txt file (one URL per line)');
    return;
  }

  console.log(`Found ${urls.length} URLs to process\n`);

  // Launch browser
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  // Process each page
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await scrapePage(urls[i], browser, i + 1);
    results.push(result);
    // Short pause between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Close browser
  await browser.close();
  console.log('\n✓ Browser closed');

  // Save results
  saveResults(results);

  // Summary
  console.log('\n=== Summary ===');
  const successful = results.filter(r => r.error === undefined).length;
  const withEmails = results.filter(r => r.email !== null).length;
  console.log(`Pages processed: ${successful}/${urls.length}`);
  console.log(`Emails found: ${withEmails}/${urls.length}`);
}

// Run the bot
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  readUrlsFromFile,
  findEmails,
  scrapePage,
  saveResults
};

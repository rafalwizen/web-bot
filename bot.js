const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Wczytuje adresy URL z pliku TXT
 * @param {string} filePath - ścieżka do pliku
 * @returns {string[]} - tablica adresów URL
 */
function readUrlsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#')); // Pomijaj puste linie i komentarze
  } catch (error) {
    console.error(`Błąd podczas wczytywania pliku ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Wyszukuje emaile na stronie
 * @param {Page} page - strona Puppeteer
 * @returns {string|null} - znaleziony email lub null
 */
async function findEmails(page) {
  try {
    // Szukaj linków mailto:
    const mailtoLinks = await page.$$eval('a[href^="mailto:"]', links => {
      return links.map(link => {
        const href = link.getAttribute('href');
        return href ? href.replace('mailto:', '').trim() : null;
      }).filter(email => email !== null);
    });

    if (mailtoLinks.length > 0) {
      return mailtoLinks[0]; // Zwróć pierwszy znaleziony email
    }

    // Szukaj emaili w treści tekstowej
    const bodyText = await page.evaluate(() => document.body.innerText);
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi;
    const emails = bodyText.match(emailRegex);

    if (emails && emails.length > 0) {
      return emails[0]; // Zwróć pierwszy znaleziony email
    }

    return null;
  } catch (error) {
    console.error('Błąd podczas wyszukiwania emaili:', error.message);
    return null;
  }
}

/**
 * Generuje bezpieczną nazwę pliku z URL
 * @param {string} url - adres URL
 * @returns {string} - bezpieczna nazwa pliku
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
 * Scrapuje stronę: robi screenshot i szuka emaili
 * @param {string} url - adres URL
 * @param {Browser} browser - przeglądarka Puppeteer
 * @param {number} index - numer porządkowy aktualnie przetwarzanej strony
 * @returns {Object} - wynik scrapowania {url, email, screenshot}
 */
async function scrapePage(url, browser, index) {
  console.log(`Przetwarzanie: ${index}. ${url}`);

  try {
    const page = await browser.newPage();

    // Ustaw timeout i viewport
    page.setDefaultTimeout(30000); // 30 sekund timeout
    await page.setViewport({ width: 1920, height: 1080 });

    // Otwórz stronę
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Zrób screenshot
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

    // Szukaj emaila
    const email = await findEmails(page);
    if (email) {
      console.log(`  ✓ Znaleziono email: ${email}`);
    } else {
      console.log(`  ✗ Nie znaleziono emaila`);
    }

    await page.close();

    return {
      url: url,
      email: email,
      screenshot: screenshotPath
    };

  } catch (error) {
    console.error(`  ✗ Błąd podczas przetwarzania ${url}:`, error.message);
    return {
      url: url,
      email: null,
      screenshot: null,
      error: error.message
    };
  }
}

/**
 * Zapisuje wyniki do pliku JSON
 * @param {Array} results - tablica wyników
 */
function saveResults(results) {
  try {
    const filePath = path.join(__dirname, 'results.json');
    fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✓ Wyniki zapisane w: ${filePath}`);
  } catch (error) {
    console.error('Błąd podczas zapisywania wyników:', error.message);
  }
}

/**
 * Funkcja główna
 */
async function main() {
  console.log('=== Web Bot ===\n');

  // Wczytaj URL z pliku
  const urlsFilePath = path.join(__dirname, 'urls.txt');
  const urls = readUrlsFromFile(urlsFilePath);

  if (urls.length === 0) {
    console.error('Brak adresów URL w pliku urls.txt');
    console.log('Dodaj adresy do pliku urls.txt (jeden adres w każdej linii)');
    return;
  }

  console.log(`Znaleziono ${urls.length} adresów do przetworzenia\n`);

  // Uruchom przeglądarkę
  console.log('Uruchamianie przeglądarki...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  // Przetwarzaj każda stronę
  const results = [];
  for (let i = 0; i < urls.length; i++) {
    const result = await scrapePage(urls[i], browser, i + 1);
    results.push(result);
    // Krótka pauza między żądaniami
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Zamknij przeglądarkę
  await browser.close();
  console.log('\n✓ Przeglądarka zamknięta');

  // Zapisz wyniki
  saveResults(results);

  // Podsumowanie
  console.log('\n=== Podsumowanie ===');
  const successful = results.filter(r => r.error === undefined).length;
  const withEmails = results.filter(r => r.email !== null).length;
  console.log(`Przetworzonych stron: ${successful}/${urls.length}`);
  console.log(`Znalezionych emaili: ${withEmails}/${urls.length}`);
}

// Uruchom bota
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  readUrlsFromFile,
  findEmails,
  scrapePage,
  saveResults
};

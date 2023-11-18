import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import fs from 'fs-extra';
puppeteer.use(StealthPlugin());

export default async function (url, scrapeID = undefined, allowRedirects = false) {
  var result = {};
  if (scrapeID == undefined) { scrapeID = 'time-' + process.hrtime.bigint(); }
  const options = {
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--disable-web-security",
      "--disable-dev-profile",
      "--no-zygote",
      `--user-data-dir="/tmp/puppeteer-scraper-${scrapeID}"`
    ],
  };

  const browser = await puppeteer.launch(options);

  // Find chrome user data dir (puppeteer_dev_profile-XXXXX) to delete it after it had been used
  let chromeTmpDataDir = null;
  let chromeSpawnArgs = browser.process().spawnargs;
  for (let i = 0; i < chromeSpawnArgs.length; i++) {
    if (chromeSpawnArgs[i].indexOf("--user-data-dir=") === 0) {
      chromeTmpDataDir = chromeSpawnArgs[i].replace("--user-data-dir=", "");
    }
  }

  const page = await browser.newPage()

  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.isInterceptResolutionHandled()) { return; }

    try {
      if (request.isNavigationRequest() && request.redirectChain().length) {
        // Block or allow redirects
        return allowRedirects ? request.continue(request.continueRequestOverrides(), 0) : request.abort('blockedbyclient', 1)       
      } else if (result['info'] !== undefined) {
        // Block anything other than the first request
        return request.abort('blockedbyclient', 1);
      } else {
        // Allow first request.
        return request.continue(request.continueRequestOverrides(), 0);
      }
    } catch (_) {
      if (result['info'] == undefined) {
        result = { 'info': { 'version': '2', 'error': 'There was an unknown error with the request.' } };
      }
    }
  });

  page.on('response', async response => {
    try {
      result['info'] = {
        'version': '2',
        'headers': response.headers(),
        'statusCode': response.status(),
        'statusMessage': response.statusText(),
        'allowRedirects': allowRedirects,
        'requestUrl': url,
        'finalUrl': response.url(),
      };

      if (response.status() == 200) {
        result['body'] = await response.text();
      } else {
        result['body'] = '';
      }
    } catch (_) {
      if (result['info'] == undefined) {
        result = { 'info': { 'version': '2', 'error': 'There was an unknown error with the response.' } };
      }
    }
  });

  await page.goto(url, { waitUntil: 'networkidle0' }).catch(async error => {
    if (result['info'] == undefined) {
      result = { 'info': { 'version': '2', 'error': 'There was an unknown error.' } };
    }
  });

  await page.goto('about:blank');

  await browser.close();

  if (chromeTmpDataDir !== null) {
    fs.removeSync(chromeTmpDataDir);
  }

  return result;
}
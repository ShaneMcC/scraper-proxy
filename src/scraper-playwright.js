import { chromium } from 'patchright'
import fs from 'fs-extra';

export default async function (url, scrapeID = undefined, allowRedirects = false) {
  var result = {};
  if (scrapeID == undefined) { scrapeID = 'time-' + process.hrtime.bigint(); }

  const userDataDir = `/tmp/playwright-scraper-${scrapeID}`;

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--disable-web-security",
      "--disable-dev-profile",
      "--no-zygote",
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  });

  const page = await context.newPage();

  let firstRequestProcessed = false;

  await page.route('**/*', async (route, request) => {
    try {
      const isNavigationRequest = request.isNavigationRequest();
      const redirectedFrom = request.redirectedFrom();

      if (isNavigationRequest && redirectedFrom) {
        if (!allowRedirects) {
          await route.abort('blockedbyclient');
          return;
        }
      }

      if (result['info'] !== undefined && !firstRequestProcessed) {
        await route.abort('blockedbyclient');
        return;
      }

      await route.continue();
    } catch (_) {
      if (result['info'] == undefined) {
        result = { 'info': { 'version': '2', 'error': 'There was an unknown error with the request.' } };
      }
    }
  });

  page.on('response', async response => {
    try {
      if (!firstRequestProcessed) {
        firstRequestProcessed = true;

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
      }
    } catch (_) {
      if (result['info'] == undefined) {
        result = { 'info': { 'version': '2', 'error': 'There was an unknown error with the response.' } };
      }
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    if (result['info'] == undefined) {
      result = { 'info': { 'version': '2', 'error': 'There was an unknown error.' } };
    }
  }

  await page.goto('about:blank');
  await context.close();
  await browser.close();

  if (fs.existsSync(userDataDir)) {
    fs.removeSync(userDataDir);
  }

  return result;
}

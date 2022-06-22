import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
puppeteer.use(StealthPlugin());

export default async function (url) {
  var result = {};
  const options = {
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-sandbox",
    ],
  };

  const browser = await puppeteer.launch(options);
  const page = await browser.newPage()

  await page.setRequestInterception(true);
  page.on('request', request => {
    try {
      if (request.isNavigationRequest() && request.redirectChain().length) {
        request.abort();
      } else if (result['info'] !== undefined) {
        request.abort();
      } else {
        request.continue();
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
        'statusText': response.statusText(),
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

  await browser.close();

  return result;
}
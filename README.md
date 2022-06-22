# Scraper-Proxy

Scraper proxy to bypass cloudflare detecting us as a bot for doign TLS differently than real browsers.

Idea based on reading https://pixeljets.com/blog/scrape-ninja-bypassing-cloudflare-403-code-1020-errors/

Somewhat API-Compatible with https://rapidapi.com/restyler/api/scrapeninja for basic usage but self-hosted so not costing me money for every request.

# Running

Run with docker.

```bash
docker run -p 8765:8765 registry.shanemcc.net/scraper-proxy/scraper-proxy
```

Accepts some env vars for config:

`HOST` - Host to listen on (Default: `0.0.0.0`)
`PORT` - Port to listen on (Default: `8765`)
`APIKEY` - API Key to accept (Default: `SOMEAPIKEY`)
`MAXREQUESTS` - Max concurrent requests to allow (Default: `5`)

# Usage

Make a request through the proxy with curl:

```bash
curl --request POST \
     --url http://localhost:8765/scrape \
     --header 'X-RapidAPI-Key: SOMEAPIKEY' \
     --header 'content-type: application/json' \
     --data '{"url": "https://icanhazip.com/"}'
```

Will give you some nice json something like:

```json
{
  "info": {
    "version": "2",
    "headers": {
      "access-control-allow-methods": "GET",
      "access-control-allow-origin": "*",
      "alt-svc": "h3=\":443\"; ma=86400, h3-29=\":443\"; ma=86400",
      "cf-ray": "71f1d8fead1be62c-LHR",
      "content-length": "16",
      "content-type": "text/plain",
      "date": "Wed, 22 Jun 2022 03:20:21 GMT",
      "expect-ct": "max-age=604800, report-uri=\"https://report-uri.cloudflare.com/cdn-cgi/beacon/expect-ct\"",
      "server": "cloudflare",
      "set-cookie": "__cf_bm=SOMETHINGHERE; path=/; expires=Wed, 22-Jun-22 03:50:21 GMT; domain=.icanhazip.com; HttpOnly; Secure; SameSite=None",
      "vary": "Accept-Encoding"
    },
    "statusCode": 200,
    "statusText": ""
  },
  "body": "1.1.1.1\n"
}
```

# Known Issues

This is probably buggy, I don't reccomend running it in production.

If there is a lot of requests going through it, it seems to sometimes leak chromium instances, I don't know why, I'll look at some point but for now I don't care too much.

Currently uses puppeteer for the actual scraping, may rewrite at some point if I figure out an alternative way of doing it.


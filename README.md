# Scraper-Proxy

Scraper proxy to bypass pesky cloudflare pages.

Idea based on reading https://pixeljets.com/blog/scrape-ninja-bypassing-cloudflare-403-code-1020-errors/

API-Compatible with https://rapidapi.com/restyler/api/scrapeninja but self-hosted so not costing me money.

Run with docker.

Accepts some env vars:

`HOST` - Host to listen on (Default: `0.0.0.0`)
`PORT` - Port to listen on (Default: `8765`)
`APIKEY` - API Key to accept (Default: `SOMEAPIKEY`)
`MAXREQUESTS` - Max concurrent requests to allow (Default: `5`)

This is probably buggy, I don't reccomend running it in production.

Currently uses puppeteer for the actual scraping, may rewrite at some point, probably not.
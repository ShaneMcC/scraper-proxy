#!/usr/bin/env node

"use strict";

import dotenv from 'dotenv'
dotenv.config()

import http from 'http'
import { default as nodeurl, URLSearchParams } from 'url'

import scrape from './src/scraper.js'

import consolestamp from 'console-stamp'
consolestamp(console, '[yyyy-mm-dd HH:MM:ss.l]');

import { Semaphore } from 'async-mutex';

const host = process.env.LISTEN_HOST || '0.0.0.0';
const port = process.env.LISTEN_PORT || '8765';
const validKEY = process.env.APIKEY || 'SOMEAPIKEY';
const maxConcurrentRequests = process.env.MAXREQUESTS || 5;

const semaphore = new Semaphore(maxConcurrentRequests);

var scrapeID = 0;

const handleScrapeRequest = async function(res, url) {
    const thisScrapeID = `req-${scrapeID++}`;
    await semaphore.runExclusive(async () => {
        console.log(`\t{${thisScrapeID}} Got lock`);
        console.log(`\t{${thisScrapeID}} Scraping: ${url}`);
        const result = await scrape(url, thisScrapeID);
        var statusCode; 

        if (result['info']['error'] === undefined) {
            console.log(`\t\t{${thisScrapeID}} Success.`);
            statusCode = 200;
        } else {
            console.log(`\t\t{${thisScrapeID}} Failed. (${result['info']['error']})`);
            statusCode = 500;
        }

        result['info']['scrape-id'] = thisScrapeID;
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
    });
}

const handleScrapeError = async function(res, message, extra, code = 400) {
    console.log(`\tError ${message} ${extra}`);
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 'info': { 'version': '2', 'code': code, 'error': message } }, null, 2));
}

const scrapeHandler = async function (req, res) {
    if (req.method === "GET") {
        console.log(`\tGET - Handling.`);

        const searchParams = new URLSearchParams(nodeurl.parse(req.url).search);
        const url = searchParams.get('url');
        const key = searchParams.get('key');

        if (key !== null && key === validKEY) {
            if (url !== null) {
                await handleScrapeRequest(res, url);
            } else {
                await handleScrapeError(res, 'Invalid or missing URL');
            }
        } else {
            await handleScrapeError(res, 'Invalid or missing API Key', key);
        }
        
    } else if (req.method === "POST") {
        console.log(`\tPOST - Handling.`);

        if (req.headers['x-rapidapi-key'] === validKEY) {
            var body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                const bodyjson = JSON.parse(body);

                if (bodyjson['url'] !== undefined) {
                    await handleScrapeRequest(res, bodyjson['url']);
                } else {
                    await handleScrapeError(res, 'Invalid or missing URL');
                }
            });
        } else {
            await handleScrapeError(res, 'Invalid or missing API Key', req.headers['x-rapidapi-key']);
        }
    }
}

const requestListener = async function (req, res) {
    req.on('error', async err => {
        console.err('Request error:');
        console.error(err);

        await handleScrapeError(res, 'Bad Request');
        return;
    });

    res.on('error', err => {
        console.err('Response error:');
        console.error(err);
    });

    const remoteIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const urlbits = nodeurl.parse(req.url);

    console.log('Request from ' + remoteIP + ' for: ' + urlbits.pathname);

    if (urlbits.pathname.toLowerCase() == '/scrape') {
        scrapeHandler(req, res);
    } else {
        console.log('No handler');
        
        await handleScrapeError(res, 'Unknown URL', '', 404);
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`API Key is ${validKEY}`);
});

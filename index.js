#!/usr/bin/env node

"use strict";

import dotenv from 'dotenv'
dotenv.config()

import http from 'http'

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

const scrapeHandler = async function (req, res) {
    const thisScrapeID = scrapeID++;

    if (req.method === "GET") {
        console.log("\t" + '{req-' + thisScrapeID + '} GET - Ignoring.');

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end('There might be something here.');
    } else if (req.method === "POST") {
        console.log("\t" + '{req-' + thisScrapeID + '} POST - Handling.');

        var valid = (req.headers['x-rapidapi-key'] === validKEY);

        if (valid) {
            var body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async _ => {
                const bodyjson = JSON.parse(body);
                if (bodyjson['url'] !== undefined) {
                    await semaphore.runExclusive(async () => {
                        console.log("\t" + '{req-' + thisScrapeID + '} Got lock');
                        console.log("\t" + '{req-' + thisScrapeID + '} Scraping: ' + bodyjson['url']);
                        const result = await scrape(bodyjson['url']);

                        if (result['info']['error'] === undefined) {
                            console.log("\t\t" + '{req-' + thisScrapeID + '} Success.');
                            res.writeHead(200, { "Content-Type": "application/json" });
                        } else {
                            console.log("\t\t" + '{req-' + thisScrapeID + '} Failed.');
                            res.writeHead(500, { "Content-Type": "application/json" });
                        }

                        res.end(JSON.stringify(result, null, 2));
                    });
                }
            });
        } else {
            console.log("\t" + '{req-' + thisScrapeID + '} Invalid or missing API Key: ' + req.headers['x-rapidapi-key']);
            const result = { 'info': { 'version': '2', 'error': 'Invalid or missing API Key' } };
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify(result, null, 2));
        }
    }
}

const requestListener = async function (req, res) {
    req.on('error', err => {
        console.err('Request error:');
        console.error(err);

        const result = { 'info': { 'version': '2', 'error': 'Bad Request' } };

        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
        return;
    });

    res.on('error', err => {
        console.err('Response error:');
        console.error(err);
    });

    var remoteIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    console.log('Request from ' + remoteIP + ' for: ' + req.url);

    if (req.url.toLowerCase() == '/scrape') {
        scrapeHandler(req, res);
    } else {
        console.log('No handler');
        const result = { 'info': { 'version': '2', 'error': 'Unknown URL' } };

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result, null, 2));
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`API Key is ${validKEY}`);
});

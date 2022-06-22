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
    if (req.method === "GET") {
        console.log(`\tGET - Ignoring.`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 'info': { 'version': '2', 'message': 'There might be something here.' } }, null, 2));
    } else if (req.method === "POST") {
        console.log(`\tPOST - Handling.`);

        if (req.headers['x-rapidapi-key'] === validKEY) {
            var body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", async () => {
                const bodyjson = JSON.parse(body);

                if (bodyjson['url'] !== undefined) {
                    const thisScrapeID = `req-${scrapeID++}`;
                    await semaphore.runExclusive(async () => {
                        console.log(`\t{${thisScrapeID}} Got lock`);
                        console.log(`\t{${thisScrapeID}} Scraping: ${bodyjson['url']}`);
                        const result = await scrape(bodyjson['url']);
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
            });
        } else {
            console.log(`\tInvalid or missing API Key: ${req.headers['x-rapidapi-key']}`);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 'info': { 'version': '2', 'error': 'Invalid or missing API Key' } }, null, 2));
        }
    }
}

const requestListener = async function (req, res) {
    req.on('error', err => {
        console.err('Request error:');
        console.error(err);

        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 'info': { 'version': '2', 'error': 'Bad Request' } }, null, 2));
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

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 'info': { 'version': '2', 'error': 'Unknown URL' } }, null, 2));
    }
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`API Key is ${validKEY}`);
});

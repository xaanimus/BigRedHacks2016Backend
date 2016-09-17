const express = require('express'),
      path    = require('path'),
      sysInfo = require('./utils/sys-info.js'),
      env     = process.env;

let app = express();

app.get("/a|b", (req, res) => {
    res.send("hi");
});

app.get("health", (req, res) => {
    res.writeHead(200);
    res.end();
});

app.get("/info/gen|info/poll", (req, res) => {
    let url = req.url;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.end(JSON.stringify(sysInfo[url.slice(6)]()));
});

app.listen(env.NODE_PORT || 3000, env.NODE_IP || 'localhost', () => {
  console.log(`Application worker ${process.pid} started...`);
});


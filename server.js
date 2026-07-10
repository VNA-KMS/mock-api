const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Channel, Platform");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

app.all("/*", (req, res) => {
    const requested = (req.params[0] || "").replace(/\.json$/, "");
    const file = path.join(__dirname, "apiV4", requested + ".json");

    if (!fs.existsSync(file)) {
        return res.status(404).json({
            message: "Not found"
        });
    }

    res.sendFile(file);
});

app.get("/apiV3/*", (req, res) => {
    const requested = (req.params[0] || "").replace(/\.json$/, "");
    const file = path.join(__dirname, "apiV3", requested + ".json");

    if (!fs.existsSync(file)) {
        return res.status(404).json({
            message: "Not found"
        });
    }

    res.sendFile(file);
});

app.listen(8081, '0.0.0.0');

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (_req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

app.get("/*", (req, res) => {
    const requested = (req.params[0] || "").replace(/\.json$/, "");
    const file = path.join(__dirname, requested + ".json");

    if (!fs.existsSync(file)) {
        return res.status(404).json({
            message: "Not found"
        });
    }

    res.sendFile(file);
});

app.listen(8081);

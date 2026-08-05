const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", req.headers["access-control-request-method"] || "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type, Authorization, Channel, Platform, X-Requested-With, Accept");
    res.header("Access-Control-Expose-Headers", "Content-Type, Content-Length, X-Total-Count");
    res.header("Vary", "Origin");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

const LOGIN_FIXTURE_PATH = path.join(__dirname, "apiV5", "auth", "login", "index.json")
const LOGIN_FIXTURE = JSON.parse(fs.readFileSync(LOGIN_FIXTURE_PATH, "utf-8"))

const USERS = LOGIN_FIXTURE.map(function(entry) {
  return { username: entry.username, password: entry.password, data: entry.data }
})

function findUserFromAuth(req) {
  const auth = req.headers.authorization || ""
  const token = auth.replace(/^Bearer\s+/i, "")
  const match = token.match(/mock_(\w+)/)
  if (!match) return null
  return USERS.find((u) => u.username === match[1]) || null
}

function userProfile(user) {
  var u = user.data && user.data.user ? user.data.user : {}
  var roles = u.roles || []
  return {
    id: u.id || "usr_" + user.username,
    username: u.username || user.username,
    email: u.email || user.username + "@vietnamairlines.com.vn",
    fullName: u.fullName || "",
    avatar: u.avatar || "https://api.dicebear.com/7.x/initials/svg?seed=" + user.username,
    phone: u.phone || "",
    status: u.status || "ACTIVE",
    emailVerified: u.emailVerified !== undefined ? u.emailVerified : true,
    phoneVerified: u.phoneVerified !== undefined ? u.phoneVerified : true,
    lastLoginAt: new Date().toISOString(),
    createdAt: u.createdAt || "2024-01-10T08:00:00Z",
    roles: Array.isArray(roles) ? (roles[0] || "") : (roles || ""),
    permissions: u.permissions || ["dashboard.view", "kpi.view", "reports.view", "reports.create", "tcnl.view", "cmdv.view"],
    profile: u.profile || { gender: "MALE", birthday: "1990-01-01", language: "vi", timezone: "Asia/Ho_Chi_Minh", country: "VN" },
  }
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {}
  const user = USERS.find((u) => u.username === username && u.password === password)
  if (!user) {
    return res.status(401).json({ message: "invalid_credentials" })
  }
  res.json({
    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_" + user.username,
    refresh_token: "mock_refresh_" + user.username + "_" + Date.now().toString(36),
    token_type: "Bearer",
    expires_in: 3600,
    refresh_expires_in: 604800,
    scope: "openid profile",
    session_state: "mock_session_" + Date.now().toString(36),
    user: userProfile(user),
  })
})

app.get("/api/me", (req, res) => {
  const user = findUserFromAuth(req)
  if (!user) {
    return res.status(401).json({ message: "unauthorized" })
  }
  res.json(userProfile(user))
})

app.post("/api/refresh-token", (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) {
    return res.status(401).json({ message: "missing_refresh_token" })
  }
  const username = refreshToken.replace(/^mock_refresh_/, "").replace(/_.*$/, "")
  const user = USERS.find((u) => u.username === username)
  if (!user) {
    return res.status(401).json({ message: "invalid_refresh_token" })
  }
  res.json({
    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_" + user.username,
    refresh_token: "mock_refresh_" + user.username + "_" + Date.now().toString(36),
    token_type: "Bearer",
    expires_in: 3600,
    refresh_expires_in: 604800,
  })
})

app.get("/apiV4/*", (req, res) => {
    const requested = (req.params[0] || "").replace(/\.json$/, "");
    const file = path.join(__dirname, "apiV4", requested + ".json");

    if (!fs.existsSync(file)) {
        return res.status(404).json({
            message: "Not found"
        });
    }

    res.sendFile(file);
});

app.get("/apiV5/*", (req, res) => {
    const requested = (req.params[0] || "").replace(/\.json$/, "");
    const file = path.join(__dirname, "apiV5", requested + ".json");

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

if (require.main === module) {
    const PORT = process.env.PORT || 8081;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`mock-api listening on ${PORT}`);
    });
}

module.exports = app;

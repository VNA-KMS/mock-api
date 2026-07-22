const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Channel, Platform");
    res.header("Access-Control-Allow-Credentials", "true");
    if (_req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

const USERS = [
  { username: "admin", password: "admin@123", fullName: "Quản Trị Viên", roles: ["ADMIN"] },
  { username: "hdqt", password: "hdqt@123", fullName: "Nguyễn Văn An", roles: ["HDQT"] },
  { username: "bgd", password: "bgd@123", fullName: "Trần Thị Bích", roles: ["BGD"] },
  { username: "vptc", password: "vptc@123", fullName: "Lê Văn Cường", roles: ["VPTC", "MANAGER"] },
  { username: "ktm", password: "ktm@123", fullName: "Phạm Thị Dung", roles: ["KHOI_THUONG_MAI", "MANAGER"] },
  { username: "kkth", password: "kkth@123", fullName: "Phan Văn Ơn", roles: ["KHOI_KY_THUAT", "MANAGER"] },
  { username: "bkt", password: "bkt@123", fullName: "Cao Thị Phúc", roles: ["BAN_KY_THUAT", "USER"] },
  { username: "cqdv", password: "cqdv@123", fullName: "Lê Văn Quân", roles: ["CQDV", "MANAGER"] },
]

function findUserFromAuth(req) {
  const auth = req.headers.authorization || ""
  const token = auth.replace(/^Bearer\s+/i, "")
  const match = token.match(/mock_(\w+)/)
  if (!match) return null
  return USERS.find((u) => u.username === match[1]) || null
}

function userProfile(user) {
  return {
    id: "usr_" + user.username,
    username: user.username,
    email: user.username + "@vietnamairlines.com.vn",
    fullName: user.fullName,
    avatar: "https://api.dicebear.com/7.x/initials/svg?seed=" + user.username,
    phone: "+84901" + user.username,
    status: "ACTIVE",
    emailVerified: true,
    phoneVerified: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: "2024-01-10T08:00:00Z",
    roles: user.roles[0] || "",
    permissions: ["dashboard.view", "kpi.view", "reports.view", "reports.create", "tcnl.view", "cmdv.view"],
    profile: { gender: "MALE", birthday: "1990-01-01", language: "vi", timezone: "Asia/Ho_Chi_Minh", country: "VN" },
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

app.listen(8081, '0.0.0.0');

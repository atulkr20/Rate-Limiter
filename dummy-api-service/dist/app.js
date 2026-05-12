"use strict";
// this is a fake backend service with three routes 
// Before each resposne, it checks with our rate limiter microservice
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rateLimitClient_1 = require("./rateLimitClient");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
// Serve the static simulator UI at the root path in production builds
const publicDir = path_1.default.join(__dirname, 'simulator');
app.use(express_1.default.static(publicDir));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(publicDir, 'index.html'));
});
// Enable CORS for the simulator
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-User-ID, X-User-Plan, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
    res.header('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
});
// helper functiopn to extract identoty from the request headers
// Same headers the rate limiter middleware uses 
function getIdentity(req) {
    return {
        userId: req.headers["x-user-id"] || "anonymous",
        plan: req.headers['x-user-plan'] || "free",
        ip: req.ip || "unknown"
    };
}
// /login - strictest rate limit (5 per 60s)
app.post("/login", async function (req, res) {
    try {
        const { userId, plan, ip } = getIdentity(req);
        const result = await (0, rateLimitClient_1.checkLimit)(userId, ip, "/login", plan);
        // Set the headers so the client can see their limit status
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader("X-RateLimit-Reset", result.resetAfter);
        if (!result.allowed) {
            res.status(429).json({ success: false, message: "Too many login attempts" });
            return;
        }
        res.status(200).json({ success: true, message: "Login Atempted" });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// /posts - relaxed limit(200 per 60s)
app.get("/posts", async function (req, res) {
    try {
        const { userId, plan, ip } = getIdentity(req);
        const result = await (0, rateLimitClient_1.checkLimit)(userId, ip, "/posts", plan);
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader("X-RateLimit-Reset", result.resetAfter);
        if (!result.allowed) {
            res.status(429).json({ success: false, message: "Too many requests" });
            return;
        }
        res.status(200).json({
            success: true,
            posts: [
                { id: 1, title: "Post one" },
                { id: 2, title: "Post two" }
            ]
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// /profile - medium limit (50 per 60s)
app.get("/profile", async function (req, res) {
    try {
        const { userId, plan, ip } = getIdentity(req);
        const result = await (0, rateLimitClient_1.checkLimit)(userId, ip, "/profile", plan);
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader("X-RateLimit-Reset", result.resetAfter);
        if (!result.allowed) {
            res.status(429).json({ success: false, message: " Too many requests" });
            return;
        }
        res.status(200).json({
            success: true,
            profile: { userId, plan, name: "Atul" }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// /api/data - plan-based limit
app.get("/api/data", async function (req, res) {
    try {
        const { userId, plan, ip } = getIdentity(req);
        const result = await (0, rateLimitClient_1.checkLimit)(userId, ip, "/api/data", plan);
        res.setHeader("X-RateLimit-Limit", result.limit);
        res.setHeader("X-RateLimit-Remaining", result.remaining);
        res.setHeader("X-RateLimit-Reset", result.resetAfter);
        if (!result.allowed) {
            res.status(429).json({ success: false, message: "Too many requests" });
            return;
        }
        res.status(200).json({
            success: true,
            data: { timestamp: new Date().toISOString(), userId, plan }
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});
exports.default = app;

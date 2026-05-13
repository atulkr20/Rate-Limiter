"use strict";
// This is the HTTP client that talks to our rate limitter microservice 
// Every route in the dummy API calls this before responding
// This simulates how a real backend service would consume our rate limiter
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkLimit = checkLimit;
const axios_1 = __importDefault(require("axios"));
// Read the rate limiter URL from env
const RATE_LIMITER_URL = process.env.RATE_LIMITER_URL || "http://localhost:3001";
async function checkLimit(userId, ip, route, plan) {
    try {
        const response = await axios_1.default.post(`${RATE_LIMITER_URL}/check`, {
            userId,
            ip,
            route,
            plan
        });
        return response.data;
    }
    catch (err) {
        //if the rate limiter service itself is down
        //  fail-open - don't block the user because our infra  is down 
        if (err.response && err.response.status === 429) {
            //  rate limiter responded with 429 -- properly blocked
            return err.response.data;
        }
        // rate limiter is unreachable - fail closed so requests do not bypass policy
        return {
            allowed: false,
            limit: 0,
            remaining: 0,
            resetAfter: 0,
            reason: "Rate limiter unreachable"
        };
    }
}

// This is the HTTP client that talks to our rate limitter microservice 
// Every route in the dummy API calls this before responding
// This simulates how a real backend service would consume our rate limiter


import axios from 'axios'
import { RateLimitResult } from './types'

// Read the rate limiter URL from env
const RATE_LIMITER_URL: string = process.env.RATE_LIMITER_URL || "http://localhost:3001"

export async function checkLimit(
    userId: string,
    ip: string,
    route: string,
    plan: string,   
): Promise<RateLimitResult> {
    try {
        const response = await axios.post(`${RATE_LIMITER_URL}/check`, {
            userId,
            ip,
            route,
            plan
        })

        return response.data
    } catch (err: any) {

        //if the rate limiter service itself is down
        //  fail-open - don't block the user because our infra  is down 
        
        if(err.response && err.response.status === 429) {
            //  rate limiter responded with 429 -- properly blocked
            return err.response.data
        }

          // rate limiter is unreachable - fail closed so requests do not bypass policy
            return {
                allowed: false,
                limit: 0,
                remaining: 0,
                resetAfter: 0,
                reason: "Rate limiter unreachable"
            }
    }
}
-- this runs scripts runs ATOMICALLY inside Redis
-- Atomic means that no other command can interrupt this while it runs and this helps us to prevent race conditions too


local key = KEYS[1]    -- The Redis key for this user + route combination
local now = tonumber(ARGV[1])  -- Current timestampos in milliseconds
local windowMs = tonumber(ARGV[2])  -- window size in  milliseconds
local limit = tonumber(ARGV[3])  -- this is the request limit
local sequenceKey = key .. ":seq"

-- 1. Removing all timestamps older than our window
redis.call("ZREMRANGEBYSCORE", key, 0, now - windowMs)
-- ZREMRANGEBYSCORE removes members with score between min and max
-- ANything older than (now -windowMs) is outside our sliding window

-- 2. Count how many requests are left in the window
local currentCount = redis.call("ZCARD", key)

-- 3. Decide - allowed or blocked
if currentCount < limit then 

-- if allowed - add this request's timestamp to the sorted set
-- score = timestamp, member = unique request id
-- use a per-key sequence so multiple requests in the same millisecond do not collide
local sequence = redis.call("INCR", sequenceKey)
redis.call("ZADD", key, now, tostring(now) .. "-" .. tostring(sequence))

-- setting TL on the key so the redis auto clean it after the window expires 
-- this prevents memory leaking for inactive users
redis.call("EXPIRE", key, math.ceil(windowMs / 1000))
redis.call("EXPIRE", sequenceKey, math.ceil(windowMs / 1000))

-- return allowed = 1, remaining requests
return { 1, limit - currentCount - 1}
else 
    -- if blocked don't add anything, just return blocked
    return {0, 0}
end
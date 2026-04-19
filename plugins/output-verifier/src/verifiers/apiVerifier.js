"use strict";
/**
 * API Verifier
 * Verifies agent claims by making independent API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiVerifier = void 0;
const uuid_1 = require("uuid");
class ApiVerifier {
    type = 'api';
    name = 'API Verifier';
    config;
    constructor(config) {
        this.config = config;
    }
    canVerify(claim) {
        // Can verify if tool calls include API-related operations
        if (!claim.toolCalls || claim.toolCalls.length === 0)
            return false;
        return claim.toolCalls.some(tc => tc.tool.includes('api') ||
            tc.tool.includes('fetch') ||
            tc.tool.includes('http') ||
            tc.tool.includes('request') ||
            tc.tool.includes('post') ||
            tc.tool.includes('get') ||
            tc.args?.url !== undefined);
    }
    async verify(claim) {
        const startTime = Date.now();
        const details = [];
        let score = 100;
        // Extract API-related tool calls
        const apiCalls = (claim.toolCalls || []).filter(tc => tc.tool.includes('api') ||
            tc.tool.includes('fetch') ||
            tc.tool.includes('http') ||
            tc.tool.includes('request') ||
            tc.tool.includes('post') ||
            tc.tool.includes('get') ||
            tc.args?.url !== undefined);
        if (apiCalls.length === 0) {
            return this.buildResult(claim.id, 'skipped', 100, 'No API calls found to verify', details, startTime);
        }
        // Check each API call
        for (const call of apiCalls) {
            const url = call.args?.url || call.args?.endpoint;
            const method = (call.args?.method || 'GET').toUpperCase();
            // 1. Check if API call returned a result
            if (call.result === undefined || call.result === null) {
                details.push({
                    field: `${call.tool}.result`,
                    passed: false,
                    message: `API call "${call.tool}" returned no result`,
                });
                score -= 30;
                continue;
            }
            // 2. Check if result indicates success
            const resultObj = call.result;
            const statusCode = resultObj?.status ||
                resultObj?.statusCode ||
                resultObj?.code;
            if (statusCode !== undefined) {
                const successCodes = this.config.expectedStatusCodes || [200, 201, 204];
                const isSuccess = successCodes.includes(Number(statusCode));
                details.push({
                    field: `${call.tool}.status`,
                    expected: successCodes.join(' or '),
                    actual: statusCode,
                    passed: isSuccess,
                    message: isSuccess
                        ? `API returned status ${statusCode} (expected)`
                        : `API returned unexpected status ${statusCode}`,
                });
                if (!isSuccess)
                    score -= 30;
            }
            // 3. Check if result has meaningful data
            const responseData = resultObj?.data || resultObj?.body || resultObj?.result;
            if (responseData !== undefined) {
                const hasData = responseData !== null &&
                    (typeof responseData !== 'object' || Object.keys(responseData).length > 0);
                details.push({
                    field: `${call.tool}.data`,
                    passed: hasData,
                    message: hasData
                        ? `API returned data (${typeof responseData})`
                        : 'API returned empty data',
                });
                if (!hasData)
                    score -= 20;
            }
            // 4. Verify the API is actually reachable (if baseUrl configured)
            if (url && this.config.baseUrl) {
                try {
                    const verifyUrl = url.startsWith('http') ? url : `${this.config.baseUrl}${url}`;
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 5000);
                    const response = await fetch(verifyUrl, {
                        method: 'GET',
                        headers: {
                            ...this.config.headers,
                            ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                        },
                        signal: controller.signal,
                    });
                    clearTimeout(timeout);
                    const liveStatus = response.status;
                    details.push({
                        field: `${call.tool}.live_check`,
                        expected: 'reachable',
                        actual: `status ${liveStatus}`,
                        passed: liveStatus < 500,
                        message: `Live API check: ${verifyUrl} returned ${liveStatus}`,
                    });
                    if (liveStatus >= 500)
                        score -= 15;
                }
                catch (err) {
                    details.push({
                        field: `${call.tool}.live_check`,
                        passed: false,
                        message: `Live API check failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
                    });
                    score -= 15;
                }
            }
            // 5. Check response time (if duration recorded)
            if (call.duration !== undefined) {
                const slowThreshold = this.config.timeoutMs || 10000;
                const isSlow = call.duration > slowThreshold;
                details.push({
                    field: `${call.tool}.duration`,
                    expected: `<${slowThreshold}ms`,
                    actual: `${call.duration}ms`,
                    passed: !isSlow,
                    message: isSlow
                        ? `API call was slow: ${call.duration}ms (threshold: ${slowThreshold}ms)`
                        : `API call completed in ${call.duration}ms`,
                });
                if (isSlow)
                    score -= 10;
            }
        }
        score = Math.max(0, score);
        const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
        const message = status === 'passed'
            ? `API verification passed (score: ${score}/100, ${apiCalls.length} calls checked)`
            : `API verification ${status} (score: ${score}/100)`;
        return this.buildResult(claim.id, status, score, message, details, startTime);
    }
    buildResult(claimId, status, score, message, details, startTime) {
        return {
            id: (0, uuid_1.v4)(),
            claimId,
            verifierType: this.type,
            status,
            score,
            message,
            details,
            timestamp: new Date(),
            durationMs: Date.now() - startTime,
            suggestedFix: status === 'failed'
                ? '检查 API 端点是否可达，确认返回值符合预期'
                : undefined,
        };
    }
}
exports.ApiVerifier = ApiVerifier;
//# sourceMappingURL=apiVerifier.js.map
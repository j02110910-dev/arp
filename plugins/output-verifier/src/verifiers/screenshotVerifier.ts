/**
 * Screenshot Verifier
 * Uses AI vision models to analyze screenshots and verify agent claims
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Verifier, VerifierType, AgentClaim, VerificationResult, ScreenshotVerifierConfig } from '../types';

export class ScreenshotVerifier implements Verifier {
  type: VerifierType = 'screenshot';
  name = 'Screenshot Verifier';

  private config: ScreenshotVerifierConfig;
  private apiEndpoint: string;
  private model: string;

  constructor(config: ScreenshotVerifierConfig) {
    this.config = config;
    this.model = config.model || 'gpt-4o';
    // Default to OpenAI-compatible endpoint
    this.apiEndpoint = (config.settings?.apiEndpoint as string) || 'https://api.openai.com/v1/chat/completions';
  }

  canVerify(claim: AgentClaim): boolean {
    // Can verify if there's a screenshot or if the claim involves UI
    if (claim.screenshotPath) return true;
    if (claim.description && (
      claim.description.includes('截图') ||
      claim.description.includes('screenshot') ||
      claim.description.includes('页面') ||
      claim.description.includes('UI') ||
      claim.description.includes('界面')
    )) return true;
    // Check if any tool call involves screenshot
    if (claim.toolCalls) {
      return claim.toolCalls.some(tc =>
        tc.tool.includes('screenshot') ||
        tc.tool.includes('capture') ||
        tc.tool.includes('screen') ||
        tc.args?.screenshot !== undefined ||
        tc.args?.image !== undefined
      );
    }
    return false;
  }

  async verify(claim: AgentClaim): Promise<VerificationResult> {
    const startTime = Date.now();
    const details: VerificationResult['details'] = [];

    // Check if API key is configured
    if (!this.config.apiKey) {
      return this.buildResult(claim.id, 'skipped', 100,
        'Screenshot verification skipped: no vision API key configured. Set OUTPUT_VERIFIER_VISION_API_KEY.',
        details, startTime);
    }

    // Get screenshot path from claim
    const screenshotPath = this.getScreenshotPath(claim);
    if (!screenshotPath) {
      return this.buildResult(claim.id, 'skipped', 100,
        'Screenshot verification skipped: no screenshot found in claim.',
        details, startTime);
    }

    // Check if screenshot file exists
    if (!fs.existsSync(screenshotPath)) {
      return this.buildResult(claim.id, 'error', 0,
        `Screenshot file not found: ${screenshotPath}`,
        details, startTime);
    }

    // Read and encode screenshot
    let base64Image: string;
    try {
      const imageBuffer = fs.readFileSync(screenshotPath);
      base64Image = imageBuffer.toString('base64');
    } catch (err) {
      return this.buildResult(claim.id, 'error', 0,
        `Failed to read screenshot: ${err instanceof Error ? err.message : 'Unknown error'}`,
        details, startTime);
    }

    // Build the analysis prompt
    const prompt = this.buildAnalysisPrompt(claim);

    // Call vision model
    try {
      const mimeType = this.getMimeType(screenshotPath);
      const analysis = await this.callVisionModel(prompt, base64Image, mimeType);

      // Parse the analysis result
      const result = this.parseAnalysis(analysis, claim, details);

      return this.buildResult(claim.id, result.status, result.score, result.message, details, startTime, analysis);
    } catch (err) {
      return this.buildResult(claim.id, 'error', 0,
        `Vision model call failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        details, startTime);
    }
  }

  private getScreenshotPath(claim: AgentClaim): string | null {
    if (claim.screenshotPath) return claim.screenshotPath;

    // Check tool calls for screenshot paths
    if (claim.toolCalls) {
      for (const tc of claim.toolCalls) {
        const screenshotPath = tc.args?.screenshot as string || tc.args?.image as string || tc.args?.path as string;
        if (screenshotPath) return screenshotPath;
        // Check result for screenshot paths
        if (tc.result && typeof tc.result === 'object') {
          const resultObj = tc.result as Record<string, unknown>;
          const resultPath = resultObj.screenshot as string || resultObj.path as string || resultObj.url as string;
          if (resultPath && typeof resultPath === 'string') return resultPath;
        }
      }
    }

    return null;
  }

  private buildAnalysisPrompt(claim: AgentClaim): string {
    let prompt = `你是一个 UI 截图验证专家。请分析这张截图，验证 Agent 声称完成的任务是否真实完成。

Agent 的声明：${claim.description}

`;

    if (claim.output && typeof claim.output === 'object') {
      prompt += `Agent 声称的输出结果：\n${JSON.stringify(claim.output, null, 2)}\n\n`;
    }

    if (claim.toolCalls && claim.toolCalls.length > 0) {
      prompt += `Agent 执行的操作：\n`;
      for (const tc of claim.toolCalls) {
        prompt += `- ${tc.tool}: ${JSON.stringify(tc.args || {})}\n`;
      }
      prompt += '\n';
    }

    prompt += `请检查截图并回答以下问题（用 JSON 格式回复）：
{
  "visible": true/false,           // 截图是否清晰可读
  "claimMatch": true/false,        // Agent 声称的功能是否在截图中可见
  "errors": true/false,            // 截图中是否有错误提示
  "unexpectedElements": true/false,// 截图中是否有不该出现的内容
  "details": "详细分析说明",       // 具体看到了什么
  "issues": ["问题1", "问题2"],    // 发现的问题列表
  "score": 0-100                   // 验证得分
}`;

    return prompt;
  }

  private async callVisionModel(prompt: string, base64Image: string, mimeType: string): Promise<string> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vision API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Vision API returned empty response');
    }
    return content;
  }

  private parseAnalysis(
    analysis: string,
    claim: AgentClaim,
    details: VerificationResult['details']
  ): { status: VerificationResult['status']; score: number; message: string } {
    // Try to extract JSON from the response
    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found, treat as text analysis
      details.push({
        field: 'visual_analysis',
        passed: true,
        message: analysis.substring(0, 500),
      });
      return {
        status: 'partial',
        score: 50,
        message: 'Vision model returned text analysis (no structured result)',
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        visible?: boolean;
        claimMatch?: boolean;
        errors?: boolean;
        unexpectedElements?: boolean;
        details?: string;
        issues?: string[];
        score?: number;
      };

      let score = parsed.score ?? 100;

      // Check visibility
      details.push({
        field: 'screenshot_visible',
        passed: parsed.visible !== false,
        message: parsed.visible !== false ? 'Screenshot is readable' : 'Screenshot is not readable',
      });

      // Check claim match
      details.push({
        field: 'claim_match',
        passed: parsed.claimMatch !== false,
        message: parsed.claimMatch !== false
          ? 'Claimed functionality is visible in screenshot'
          : 'Claimed functionality NOT found in screenshot',
      });
      if (parsed.claimMatch === false) score -= 40;

      // Check for errors
      details.push({
        field: 'no_errors',
        passed: parsed.errors !== true,
        message: parsed.errors ? 'Screenshot shows error messages' : 'No errors visible in screenshot',
      });
      if (parsed.errors) score -= 30;

      // Check for unexpected elements
      details.push({
        field: 'no_unexpected',
        passed: parsed.unexpectedElements !== true,
        message: parsed.unexpectedElements
          ? 'Screenshot shows unexpected content'
          : 'Screenshot looks as expected',
      });
      if (parsed.unexpectedElements) score -= 20;

      // Add issues as details
      if (parsed.issues && parsed.issues.length > 0) {
        for (const issue of parsed.issues) {
          details.push({
            field: 'issue',
            passed: false,
            message: issue,
          });
        }
      }

      score = Math.max(0, score);
      const status = score >= 80 ? 'passed' : score >= 50 ? 'partial' : 'failed';
      const message = parsed.details || `Screenshot analysis: score ${score}/100`;

      return { status, score, message };
    } catch {
      // JSON parse failed
      details.push({
        field: 'visual_analysis',
        passed: true,
        message: analysis.substring(0, 500),
      });
      return {
        status: 'partial',
        score: 50,
        message: 'Could not parse vision model response as JSON',
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    return mimeMap[ext] || 'image/png';
  }

  private buildResult(
    claimId: string,
    status: VerificationResult['status'],
    score: number,
    message: string,
    details: VerificationResult['details'],
    startTime: number,
    visualAnalysis?: string
  ): VerificationResult {
    return {
      id: uuidv4(),
      claimId,
      verifierType: this.type,
      status,
      score,
      message,
      details,
      timestamp: new Date(),
      durationMs: Date.now() - startTime,
      suggestedFix: status === 'failed'
        ? '截图验证失败：Agent 声称的功能未在截图中找到，或截图中有错误'
        : undefined,
      evidence: visualAnalysis ? { visualAnalysis } : undefined,
    };
  }
}

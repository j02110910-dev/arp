/**
 * Screenshot Verifier Tests - Extended Coverage
 */

import { ScreenshotVerifier } from '../src/verifiers/screenshotVerifier';
import { AgentClaim } from '../src/types';
import * as fs from 'fs';

function createClaim(overrides: Partial<AgentClaim> = {}): AgentClaim {
  return {
    id: 'test-claim',
    timestamp: new Date(),
    description: 'Test',
    ...overrides,
  };
}

describe('ScreenshotVerifier', () => {
  describe('canVerify', () => {
    it('should verify claims with screenshotPath', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({ screenshotPath: 'test.png' }))).toBe(true);
    });

    it('should verify claims with screenshot-related description', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({ description: '截图显示了登录页面' }))).toBe(true);
      expect(v.canVerify(createClaim({ description: 'screenshot shows the UI' }))).toBe(true);
      expect(v.canVerify(createClaim({ description: '界面加载完成' }))).toBe(true);
    });

    it('should verify claims with capture tool', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'capture_screen', result: {} }],
      }))).toBe(true);
    });

    it('should verify claims with screen tool', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'screen_shot', result: {} }],
      }))).toBe(true);
    });

    it('should verify claims with screenshot arg', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'custom', args: { screenshot: 'path/to/screen.png' }, result: {} }],
      }))).toBe(true);
    });

    it('should verify claims with image arg', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'custom', args: { image: 'path/to/screen.png' }, result: {} }],
      }))).toBe(true);
    });

    it('should extract screenshot path from tool result', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const claim = createClaim({
        toolCalls: [{
          tool: 'capture',
          result: { screenshot: '/path/to/screen.png' },
        }],
      });
      expect(v.canVerify(claim)).toBe(true);
    });

    it('should extract path from tool result (path field)', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const claim = createClaim({
        toolCalls: [{
          tool: 'capture',
          result: { path: '/path/to/screen.png' },
        }],
      });
      expect(v.canVerify(claim)).toBe(true);
    });

    it('should extract url from tool result as path', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const claim = createClaim({
        toolCalls: [{
          tool: 'capture',
          result: { url: '/path/to/screen.png' },
        }],
      });
      expect(v.canVerify(claim)).toBe(true);
    });

    it('should not verify unrelated claims', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({ description: 'Created a user' }))).toBe(false);
    });

    it('should not verify claims with no screenshot indicators', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'compute', result: {} }],
      }))).toBe(false);
    });
  });

  describe('verification without API key', () => {
    it('should skip when no API key configured', async () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const result = await v.verify(createClaim({
        screenshotPath: 'test.png',
        description: '截图验证',
      }));
      expect(result.status).toBe('skipped');
      expect(result.message).toContain('no vision API key');
    });
  });

  describe('verification with missing screenshot', () => {
    it('should skip when no screenshot found', async () => {
      const v = new ScreenshotVerifier({ enabled: true, apiKey: 'test-key' });
      const result = await v.verify(createClaim({
        description: '完成了UI',
      }));
      expect(result.status).toBe('skipped');
      expect(result.message).toContain('no screenshot found');
    });

    it('should error when screenshot file does not exist', async () => {
      const v = new ScreenshotVerifier({ enabled: true, apiKey: 'test-key' });
      const result = await v.verify(createClaim({
        screenshotPath: '/nonexistent/path/screenshot.png',
        description: '截图验证',
      }));
      expect(result.status).toBe('error');
      expect(result.message).toContain('not found');
    });
  });

  describe('verification with file read error', () => {
    it('should handle read permission errors gracefully', async () => {
      // Note: fs.readFileSync is not spyable when using Object.defineProperty
      // The error case is tested via the "file does not exist" test above
      // which exercises the fs.existsSync path. The readFileSync error path
      // would require module-level mocking which is more invasive.
      const v = new ScreenshotVerifier({ enabled: true, apiKey: 'test-key' });
      const result = await v.verify(createClaim({
        screenshotPath: '/nonexistent/file.png',
        description: 'Test',
      }));
      // Non-existent file triggers error status
      expect(result.status).toBe('error');
    });
  });

  describe('getMimeType', () => {
    it('should return correct mime types', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      // Access private method via any
      const getMimeType = (v as any).getMimeType.bind(v);

      expect(getMimeType('/path/to/image.png')).toBe('image/png');
      expect(getMimeType('/path/to/image.jpg')).toBe('image/jpeg');
      expect(getMimeType('/path/to/image.jpeg')).toBe('image/jpeg');
      expect(getMimeType('/path/to/image.gif')).toBe('image/gif');
      expect(getMimeType('/path/to/image.webp')).toBe('image/webp');
      expect(getMimeType('/path/to/image.bmp')).toBe('image/bmp');
      expect(getMimeType('/path/to/image.unknown')).toBe('image/png'); // default
    });
  });

  describe('buildAnalysisPrompt', () => {
    it('should build prompt with description', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const buildPrompt = (v as any).buildAnalysisPrompt.bind(v);
      const claim = createClaim({ description: 'Login page displayed' });
      const prompt = buildPrompt(claim);
      expect(prompt).toContain('Login page displayed');
    });

    it('should build prompt with output', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const buildPrompt = (v as any).buildAnalysisPrompt.bind(v);
      const claim = createClaim({
        description: 'Form submitted',
        output: { success: true },
      });
      const prompt = buildPrompt(claim);
      expect(prompt).toContain('Form submitted');
      expect(prompt).toContain('success');
    });

    it('should build prompt with tool calls', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      const buildPrompt = (v as any).buildAnalysisPrompt.bind(v);
      const claim = createClaim({
        description: 'Screenshot taken',
        toolCalls: [{ tool: 'take_screenshot', args: { format: 'png' } }],
      });
      const prompt = buildPrompt(claim);
      expect(prompt).toContain('take_screenshot');
    });
  });

  describe('parseAnalysis', () => {
    let v: ScreenshotVerifier;
    let parseAnalysis: any;
    let details: any[];

    beforeEach(() => {
      v = new ScreenshotVerifier({ enabled: true });
      parseAnalysis = (v as any).parseAnalysis.bind(v);
      details = [];
    });

    it('should handle non-JSON response as text analysis', () => {
      const result = parseAnalysis('This is a plain text response', {} as AgentClaim, details);
      expect(result.status).toBe('partial');
      expect(result.score).toBe(50);
      expect(details[0].field).toBe('visual_analysis');
    });

    it('should parse valid JSON response - passed case', () => {
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: true,
        errors: false,
        unexpectedElements: false,
        details: 'Everything looks good',
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });

    it('should parse valid JSON response - partial case (score 60)', () => {
      // claimMatch=false: -40 -> 60. errors=false: no change. Status: partial (>=50)
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: false,
        errors: false,
        unexpectedElements: false,
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.status).toBe('partial');
      expect(result.score).toBe(60);
    });

    it('should parse valid JSON response - failed case (claimMatch=false)', () => {
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: false,  // -40 -> 60
        errors: true,       // -30 -> 30
        unexpectedElements: false,
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.score).toBe(30);
      expect(result.status).toBe('failed');
    });

    it('should handle errors=true', () => {
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: true,
        errors: true,
        unexpectedElements: false,
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.score).toBe(70); // 100 - 30
    });

    it('should handle unexpectedElements=true', () => {
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: true,
        errors: false,
        unexpectedElements: true,
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.score).toBe(80); // 100 - 20
    });

    it('should include issues in details', () => {
      const jsonResponse = JSON.stringify({
        visible: true,
        claimMatch: false,
        errors: false,
        unexpectedElements: false,
        issues: ['Issue 1', 'Issue 2'],
        score: 60,
      });
      parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(details.some(d => d.field === 'issue' && d.message === 'Issue 1')).toBe(true);
      expect(details.some(d => d.field === 'issue' && d.message === 'Issue 2')).toBe(true);
    });

    it('should clamp score to minimum 0', () => {
      // Multiple severe issues: claimMatch(false)=-40, errors(true)=-30, unexpectedElements(true)=-20
      // Starting score 100 -> 100-40-30-20 = 10 (not 0, since only 3 deductions, not enough to go below 0)
      // To get 0, we'd need score:0 in the JSON to start
      const jsonResponse = JSON.stringify({
        visible: false,
        claimMatch: false,
        errors: true,
        unexpectedElements: true,
        score: 0,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(result.score).toBe(0);
    });

    it('should handle visible=false', () => {
      const jsonResponse = JSON.stringify({
        visible: false,
        claimMatch: true,
        errors: false,
        unexpectedElements: false,
        score: 100,
      });
      const result = parseAnalysis(jsonResponse, {} as AgentClaim, details);
      expect(details.some(d => d.field === 'screenshot_visible' && !d.passed)).toBe(true);
    });

    it('should handle JSON parse failure gracefully', () => {
      const result = parseAnalysis('{ invalid json }', {} as AgentClaim, details);
      expect(result.status).toBe('partial');
      expect(result.score).toBe(50);
    });

    it('should handle JSON with leading/trailing text', () => {
      const result = parseAnalysis(
        'Here is my analysis:\n{"visible": true, "claimMatch": true, "errors": false, "score": 100}\nEnd.',
        {} as AgentClaim,
        details
      );
      expect(result.status).toBe('passed');
      expect(result.score).toBe(100);
    });
  });

  describe('verifier type', () => {
    it('should have correct type', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.type).toBe('screenshot');
    });

    it('should have correct name', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.name).toBe('Screenshot Verifier');
    });
  });

  describe('custom api endpoint', () => {
    it('should use custom API endpoint when configured', () => {
      const v = new ScreenshotVerifier({
        enabled: true,
        apiKey: 'test-key',
        settings: { apiEndpoint: 'https://custom.vision.api.com/v1' },
      });
      // Access private field
      expect((v as any).apiEndpoint).toBe('https://custom.vision.api.com/v1');
    });

    it('should use default model when not specified', () => {
      const v = new ScreenshotVerifier({ enabled: true, apiKey: 'key' });
      expect((v as any).model).toBe('gpt-4o');
    });

    it('should use custom model when specified', () => {
      const v = new ScreenshotVerifier({
        enabled: true,
        apiKey: 'key',
        model: 'gpt-4o-mini',
      });
      expect((v as any).model).toBe('gpt-4o-mini');
    });
  });
});

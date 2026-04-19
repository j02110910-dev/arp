/**
 * Screenshot Verifier Tests
 */

import { ScreenshotVerifier } from '../src/verifiers/screenshotVerifier';
import { AgentClaim } from '../src/types';

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
      expect(v.canVerify(createClaim({ description: 'UI looks correct' }))).toBe(true);
      expect(v.canVerify(createClaim({ description: '页面加载完成' }))).toBe(true);
    });

    it('should verify claims with screenshot tool calls', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({
        toolCalls: [{ tool: 'take_screenshot', result: { path: 'screen.png' } }],
      }))).toBe(true);
    });

    it('should not verify unrelated claims', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.canVerify(createClaim({ description: 'Created a user' }))).toBe(false);
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

  describe('verifier type', () => {
    it('should have correct type', () => {
      const v = new ScreenshotVerifier({ enabled: true });
      expect(v.type).toBe('screenshot');
    });
  });
});

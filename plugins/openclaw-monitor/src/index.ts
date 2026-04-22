/**
 * ARP OpenClaw Integration Plugin
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync, watch } from 'fs';
import { join } from 'path';

export interface OpenClawSession {
  id: string;
  agentId: string;
  startedAt: number;
  messageCount: number;
  toolCalls: number;
  alerts: string[];
}

export interface OpenClawMonitorConfig {
  openClawPath?: string;
  watchSessions?: boolean;
  notifyOnAlert?: boolean;
  alertChannels?: {
    wechat?: { key: string };
    telegram?: { botToken: string; chatId: string };
  };
}

export class OpenClawMonitor extends EventEmitter {
  private config: Required<OpenClawMonitorConfig>;
  private sessions: Map<string, OpenClawSession> = new Map();
  private openclawProcess: ChildProcess | null = null;
  private eventLogPath: string;

  constructor(config: OpenClawMonitorConfig = {}) {
    super();
    
    this.config = {
      openClawPath: config.openClawPath || 'openclaw',
      watchSessions: config.watchSessions ?? true,
      notifyOnAlert: config.notifyOnAlert ?? true,
      alertChannels: config.alertChannels || {},
    };
    
    this.eventLogPath = join(process.env.HOME || '/root', '.openclaw', 'sessions', 'events.jsonl');
  }

  async start(): Promise<void> {
    console.log('[ARP/OpenClaw] Starting monitor...');
    
    const isRunning = await this.checkOpenClawRunning();
    if (!isRunning) {
      console.warn('[ARP/OpenClaw] OpenClaw gateway not detected');
    }
    
    if (this.config.watchSessions) {
      this.watchSessionFiles();
    }
    
    console.log('[ARP/OpenClaw] Monitor started');
  }

  stop(): void {
    if (this.openclawProcess) {
      this.openclawProcess.kill();
      this.openclawProcess = null;
    }
    console.log('[ARP/OpenClaw] Monitor stopped');
  }

  recordToolCall(sessionId: string, tool: string, args: Record<string, unknown>, result: unknown, duration: number): void {
    const session = this.sessions.get(sessionId) || this.createSession(sessionId);
    session.toolCalls++;
    session.messageCount++;
    this.sessions.set(sessionId, session);
    this.emit('toolCall', { sessionId, tool, args, duration });
  }

  recordResponse(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId) || this.createSession(sessionId);
    session.messageCount++;
    this.sessions.set(sessionId, session);
    this.emit('response', { sessionId, content });
  }

  getStats(): { totalSessions: number; activeSessions: number; sessions: OpenClawSession[] } {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => Date.now() - s.startedAt < 3600000).length,
      sessions,
    };
  }

  private createSession(id: string): OpenClawSession {
    return {
      id,
      agentId: 'openclaw',
      startedAt: Date.now(),
      messageCount: 0,
      toolCalls: 0,
      alerts: [],
    };
  }

  private async checkOpenClawRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.config.openClawPath, ['gateway', 'status'], { timeout: 3000 });
      proc.on('error', () => resolve(false));
      proc.on('close', (code) => resolve(code === 0));
    });
  }

  private watchSessionFiles(): void {
    try {
      const sessionDir = join(process.env.HOME || '/root', '.openclaw', 'sessions');
      watch(sessionDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.json')) {
          this.handleSessionFileChange(join(sessionDir, filename));
        }
      });
      console.log('[ARP/OpenClaw] Watching session files');
    } catch (error) {
      console.warn('[ARP/OpenClaw] Could not watch session files');
    }
  }

  private handleSessionFileChange(filepath: string): void {
    try {
      const content = readFileSync(filepath, 'utf-8');
      const events = content.split('\n').filter(Boolean);
      const lastEvent = events[events.length - 1];
      if (lastEvent) {
        const event = JSON.parse(lastEvent);
        this.emit('sessionEvent', event);
      }
    } catch {}
  }
}

export default OpenClawMonitor;

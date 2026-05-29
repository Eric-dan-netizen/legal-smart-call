import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { CallLog } from './call-log.entity';

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);
  private readonly storageDir: string;

  constructor(
    @InjectRepository(CallLog)
    private readonly logRepo: Repository<CallLog>,
  ) {
    this.storageDir = path.join(process.cwd(), 'data', 'recordings');
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  getDir(tenantId: string): string {
    const dir = path.join(this.storageDir, tenantId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  getFilePath(tenantId: string, callId: string): string {
    return path.join(this.getDir(tenantId), `${callId}.mp3`);
  }

  /**
   * 从阿里云临时 URL 下载录音并永久存储
   */
  async downloadAndStore(tenantId: string, callId: string, recordingUrl: string): Promise<string | null> {
    try {
      this.logger.log(`下载录音: ${callId} ← ${recordingUrl}`);
      const resp = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      const filePath = this.getFilePath(tenantId, callId);
      fs.writeFileSync(filePath, Buffer.from(resp.data));

      await this.logRepo.update(
        { callId },
        { localRecordingPath: filePath },
      );

      this.logger.log(`录音已保存: ${filePath} (${(resp.data.length / 1024).toFixed(1)} KB)`);
      return filePath;
    } catch (e) {
      this.logger.error(`录音下载失败: ${callId} — ${e.message}`);
      return null;
    }
  }

  /**
   * 保存 TTS 合成的音频为通话录音（模拟/测试用）
   */
  async saveFromTts(
    tenantId: string,
    callId: string,
    audioBuffer: Buffer,
  ): Promise<string> {
    const filePath = this.getFilePath(tenantId, callId);
    fs.writeFileSync(filePath, audioBuffer);
    this.logger.log(`录音已保存(TTS): ${filePath} (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
    return filePath;
  }

  /**
   * 保存对话记录为 JSON（无实际音频时）
   */
  async saveTranscript(
    tenantId: string,
    callId: string,
    conversation: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const dir = this.getDir(tenantId);
    const filePath = path.join(dir, `${callId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
    this.logger.log(`对话记录已保存: ${filePath}`);
    return filePath;
  }

  /**
   * 检查录音文件是否存在
   */
  exists(tenantId: string, callId: string): boolean {
    return fs.existsSync(this.getFilePath(tenantId, callId));
  }

  /**
   * 读取录音文件
   */
  readFile(tenantId: string, callId: string): Buffer | null {
    const filePath = this.getFilePath(tenantId, callId);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  /**
   * 读取对话记录 JSON
   */
  readTranscript(tenantId: string, callId: string): any | null {
    const dir = this.getDir(tenantId);
    const filePath = path.join(dir, `${callId}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }
}

import { ScriptPromptBuilder } from './script-prompt.builder';
import { Script } from '../scripts/script.entity';

describe('ScriptPromptBuilder', () => {
  let builder: ScriptPromptBuilder;

  beforeEach(() => {
    builder = new ScriptPromptBuilder();
  });

  describe('buildSystemPrompt', () => {
    it('should build default general template when no script provided', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('AI 智能法律顾问');
      expect(prompt).toContain('合规红线');
    });

    it('should build divorce template', () => {
      const script = { tags: ['divorce'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('婚姻家事');
      expect(prompt).toContain('离婚');
    });

    it('should build labor template', () => {
      const script = { tags: ['labor'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('劳动');
      expect(prompt).toContain('欠薪');
    });

    it('should build debt template', () => {
      const script = { tags: ['debt'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('借贷');
      expect(prompt).toContain('债权');
    });

    it('should build traffic template', () => {
      const script = { tags: ['traffic'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('交通事故');
      expect(prompt).toContain('保险');
    });

    it('should build criminal template', () => {
      const script = { tags: ['criminal'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('刑事');
      expect(prompt).toContain('辩护');
    });

    it('should use script.textContent when available', () => {
      const script = { textContent: '自定义法律话术内容', tags: ['divorce'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('自定义法律话术内容');
      expect(prompt).toContain('合规红线提醒');
    });

    it('should replace tenant name in context', () => {
      const prompt = builder.buildSystemPrompt(undefined, { tenantName: '正义律师事务所' });
      expect(prompt).toContain('正义律师事务所');
    });

    it('should fallback to general for unknown tag', () => {
      const script = { tags: ['unknown_type'] } as Script;
      const prompt = builder.buildSystemPrompt(script);
      expect(prompt).toContain('综合性');
    });
  });

  describe('compliance', () => {
    it('should include compliance red lines in every template', () => {
      const tags = ['divorce', 'labor', 'debt', 'traffic', 'criminal', 'general'];
      for (const tag of tags) {
        const script = { tags: [tag] } as Script;
        const prompt = builder.buildSystemPrompt(script);
        expect(prompt).toContain('不得承诺');
        expect(prompt).toContain('个人信息保护法');
      }
    });

    it('should include barge-in reminder in all templates', () => {
      const prompt = builder.buildSystemPrompt();
      expect(prompt).toContain('简洁、自然');
    });
  });

  describe('buildOpening', () => {
    it('should use script textContent when available', () => {
      const opening = builder.buildOpening({ textContent: '您好，这里是XX律师事务所' } as Script);
      expect(opening).toContain('律师事务所');
    });

    it('should return default opening when no script', () => {
      const opening = builder.buildOpening();
      expect(opening).toContain('法律顾问');
      expect(opening).toContain('咨询');
    });
  });

  describe('buildClosing', () => {
    it('should include firm name', () => {
      const closing = builder.buildClosing(undefined, { tenantName: '正义律师事务所' });
      expect(closing).toContain('正义律师事务所');
      expect(closing).toContain('祝您生活愉快');
    });
  });

  describe('buildObjectionHandling', () => {
    it('should serialize keywords as JSON when present', () => {
      const script = { keywords: { '不需要': '了解您的顾虑' } } as unknown as Script;
      const result = builder.buildObjectionHandling(script);
      expect(result).toBe('{"不需要":"了解您的顾虑"}');
    });

    it('should return default objection tips when no keywords', () => {
      const result = builder.buildObjectionHandling();
      expect(result).toContain('常见反对处理');
      expect(result).toContain('不需要');
    });
  });
});

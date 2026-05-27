import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AliyunSignatureService } from '../aliyun-signature.service';

describe('AliyunSignatureService', () => {
  let service: AliyunSignatureService;

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'ALIYUN_ACCESS_KEY_ID') return 'test-key-id';
      if (key === 'ALIYUN_ACCESS_KEY_SECRET') return 'test-key-secret';
      return '';
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AliyunSignatureService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AliyunSignatureService);
  });

  describe('percentEncode', () => {
    it('should encode spaces as %20', () => {
      expect(service.percentEncode('hello world')).toBe('hello%20world');
    });

    it('should encode asterisk as %2A', () => {
      expect(service.percentEncode('a*b')).toBe('a%2Ab');
    });

    it('should preserve tilde', () => {
      expect(service.percentEncode('~test')).toBe('~test');
    });

    it('should encode Chinese characters', () => {
      const encoded = service.percentEncode('测试');
      expect(encoded).not.toBe('测试');
      expect(encoded.length).toBeGreaterThan(4);
    });
  });

  describe('buildSignedQuery', () => {
    it('should produce a sorted query string with Signature', () => {
      const query = service.buildSignedQuery({
        Action: 'TestAction',
        Version: '2019-08-23',
      }, 'GET');

      expect(query).toMatch(/Action=TestAction/);
      expect(query).toMatch(/Signature=/);
      expect(query).toMatch(/Version=2019-08-23/);
    });

    it('should produce different signatures for GET vs POST', () => {
      const getQuery = service.buildSignedQuery({ Action: 'Test', Version: '1.0' }, 'GET');
      const postQuery = service.buildSignedQuery({ Action: 'Test', Version: '1.0' }, 'POST');

      const getSig = getQuery.match(/Signature=([^&]+)/)![1];
      const postSig = postQuery.match(/Signature=([^&]+)/)![1];
      expect(getSig).not.toBe(postSig);
    });

    it('should include all system params', () => {
      const query = service.buildSignedQuery({ Action: 'Test', Version: '1.0' }, 'GET');

      expect(query).toMatch(/AccessKeyId=test-key-id/);
      expect(query).toMatch(/SignatureMethod=HMAC-SHA1/);
      expect(query).toMatch(/SignatureVersion=1.0/);
      expect(query).toMatch(/Format=JSON/);
    });
  });

  describe('generateNonce', () => {
    it('should produce unique values', () => {
      const a = service.generateNonce();
      const b = service.generateNonce();
      expect(a).not.toBe(b);
    });
  });
});

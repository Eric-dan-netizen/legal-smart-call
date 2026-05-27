import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlacklistService } from './blacklist.service';
import { Blacklist } from './blacklist.entity';
import { BadRequestException } from '@nestjs/common';

describe('BlacklistService', () => {
  let service: BlacklistService;
  let repo: jest.Mocked<Repository<Blacklist>>;

  const mockRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlacklistService,
        { provide: getRepositoryToken(Blacklist), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BlacklistService>(BlacklistService);
    repo = module.get(getRepositoryToken(Blacklist));
  });

  afterEach(() => jest.clearAllMocks());

  describe('add', () => {
    it('should add a phone to blacklist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({ tenantId: 't1', phoneHash: 'hash', reason: '测试' });
      mockRepo.save.mockResolvedValue({ id: '1', tenantId: 't1', phoneHash: 'hash' } as any);

      const result = await service.add('t1', { phone: '13800000001', reason: '客户退订' });

      expect(mockRepo.findOne).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw if phone already blacklisted', async () => {
      mockRepo.findOne.mockResolvedValue({ id: '1' } as any);

      await expect(
        service.add('t1', { phone: '13800000001' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('isBlacklisted', () => {
    it('should return true when phone is in blacklist', async () => {
      mockRepo.findOne.mockResolvedValue({ id: '1' } as any);
      const result = await service.isBlacklisted('t1', '13800000001');
      expect(result).toBe(true);
    });

    it('should return false when phone is not in blacklist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.isBlacklisted('t1', '13800000002');
      expect(result).toBe(false);
    });

    it('should produce same hash for the same phone', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await service.isBlacklisted('t1', '13800000001');
      await service.isBlacklisted('t1', '13800000001');

      const calls = mockRepo.findOne.mock.calls;
      expect(calls[0][0].where.phoneHash).toBe(calls[1][0].where.phoneHash);
    });
  });

  describe('remove', () => {
    it('should remove from blacklist', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 } as any);
      const result = await service.remove('t1', '13800000001');
      expect(result.removed).toBe(true);
    });

    it('should throw if phone not in blacklist', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 } as any);
      await expect(service.remove('t1', '13800000002')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll('t1', 1, 20);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('batchAdd', () => {
    it('should handle mixed success/failure', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({});
      mockRepo.save
        .mockResolvedValueOnce({ id: '1' })
        .mockRejectedValueOnce(new Error('DB error'));

      const results = await service.batchAdd('t1', [
        { phone: '13800000001' },
        { phone: '13800000002' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });
});

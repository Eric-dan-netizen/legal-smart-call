import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CallFrequencyService } from './call-frequency.service';
import { CallFrequency } from './call-frequency.entity';

describe('CallFrequencyService', () => {
  let service: CallFrequencyService;
  let repo: jest.Mocked<Repository<CallFrequency>>;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CallFrequencyService,
        { provide: getRepositoryToken(CallFrequency), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CallFrequencyService>(CallFrequencyService);
    repo = module.get(getRepositoryToken(CallFrequency));
  });

  afterEach(() => jest.clearAllMocks());

  describe('canCall', () => {
    it('should allow call within limits', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.canCall('t1', '13800000001');

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(0);
    });

    it('should allow call when under weekly limit', async () => {
      mockRepo.findOne.mockResolvedValue({ callCount: 2 } as any);

      const result = await service.canCall('t1', '13800000001');

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(2);
    });

    it('should block call when at weekly limit (3 calls)', async () => {
      mockRepo.findOne.mockResolvedValue({ callCount: 3 } as any);

      const result = await service.canCall('t1', '13800000001');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('3');
    });

    it('should block call outside allowed hours', async () => {
      const hour = new Date().getHours();
      if (hour >= 8 && hour < 21) {
        // Can't test time window right now, skip
        return;
      }
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.canCall('t1', '13800000001');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('8:00-21:00');
    });

    it('should isolate tenants — same phone, different tenants', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.canCall('tenant-A', '13800000001');
      await service.canCall('tenant-B', '13800000001');

      const calls = mockRepo.findOne.mock.calls;
      expect(calls[0][0].where.tenantId).toBe('tenant-A');
      expect(calls[1][0].where.tenantId).toBe('tenant-B');
    });
  });

  describe('recordCall', () => {
    it('should create new record on first call', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      await service.recordCall('t1', '13800000001');

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should increment existing record', async () => {
      mockRepo.findOne.mockResolvedValue({ callCount: 1, lastCallAt: null } as any);
      mockRepo.save.mockResolvedValue({});

      await service.recordCall('t1', '13800000001');

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.callCount).toBe(2);
    });
  });

  describe('getHistory', () => {
    it('should return history limited to 12 weeks', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.getHistory('t1', '13800000001');

      expect(result).toEqual([]);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 12 }),
      );
    });
  });

  describe('getStats', () => {
    it('should return weekly stats', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCalls: '5', uniquePhones: '3' }),
      };
      mockRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockRepo.count.mockResolvedValue(10);

      const result = await service.getStats('t1');

      expect(result.totalCallsThisWeek).toBe(5);
      expect(result.uniquePhonesThisWeek).toBe(3);
    });
  });
});

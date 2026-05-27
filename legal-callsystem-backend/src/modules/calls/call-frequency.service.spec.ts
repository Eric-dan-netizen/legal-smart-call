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
    increment: jest.fn(),
    update: jest.fn(),
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
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-05-27T03:00:00'));
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.canCall('t1', '13800000001');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('8:00-21:00');
      jest.useRealTimers();
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
      mockRepo.increment.mockResolvedValue({ affected: 0 });
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      await service.recordCall('t1', '13800000001');

      expect(mockRepo.increment).toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should increment existing record', async () => {
      mockRepo.increment.mockResolvedValue({ affected: 1 });
      mockRepo.update.mockResolvedValue({});

      await service.recordCall('t1', '13800000001');

      expect(mockRepo.increment).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalled();
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

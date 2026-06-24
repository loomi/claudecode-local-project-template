import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@prisma-svc/prisma.service';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  const prismaMock = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
    prismaMock.$queryRaw.mockReset();
  });

  it('returns ok status', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
    expect(typeof result.timestamp).toBe('string');
  });

  it('liveness returns ok without touching the DB', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('readiness returns ready when the DB responds', async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '1': 1 }]);
    const result = await controller.ready();
    expect(result).toEqual({ status: 'ready', db: 'up' });
  });

  it('readiness throws 503 when the DB is unreachable', async () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('down'));
    await expect(controller.ready()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

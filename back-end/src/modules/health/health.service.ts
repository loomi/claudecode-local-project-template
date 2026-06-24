import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '@prisma-svc/prisma.service';

export interface HealthStatus {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

export interface LivenessStatus {
  status: 'ok';
}

export interface ReadinessStatus {
  status: 'ready';
  db: 'up';
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check(): HealthStatus {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  // Liveness: cheap, no I/O. The process is up — never fail on slow deps,
  // or Kubernetes would kill a pod that is merely waiting on the DB.
  live(): LivenessStatus {
    return { status: 'ok' };
  }

  // Readiness: must fail when the DB is unreachable so traffic stops routing
  // to this pod. Parameterized tagged template (never $queryRawUnsafe).
  async ready(): Promise<ReadinessStatus> {
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      return { status: 'ready', db: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        db: 'down',
      });
    }
  }
}

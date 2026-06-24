import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import {
  HealthService,
  type HealthStatus,
  type LivenessStatus,
  type ReadinessStatus,
} from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Application health check' })
  @ApiOkResponse({ description: 'Service is up and running' })
  check(): HealthStatus {
    return this.healthService.check();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe (process is up, no DB call)' })
  @ApiOkResponse({ description: 'Process is alive' })
  live(): LivenessStatus {
    return this.healthService.live();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (verifies DB connectivity)' })
  @ApiOkResponse({ description: 'Service is ready to receive traffic' })
  @ApiServiceUnavailableResponse({ description: 'Database is unreachable' })
  ready(): Promise<ReadinessStatus> {
    return this.healthService.ready();
  }
}

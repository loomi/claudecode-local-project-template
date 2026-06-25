import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AppConfig } from '@config/configuration';
import { PrismaService } from '@prisma-svc/prisma.service';

const PASSWORD_SALT_ROUNDS = 10;

/**
 * Idempotent default-user seed.
 *
 * Why a bootstrap hook (not `prisma db seed`):
 *   The prod image is a compiled JS bundle without ts-node/tsx. Running the
 *   seed inline from the app process avoids shipping the seed runner + source
 *   files in the runtime image. Cost is one DB roundtrip per pod start — the
 *   row is checked by the unique-on-email index, so it's cheap.
 *
 * Why upsert (not create):
 *   Idempotent across restarts. Lets the operator change `SEED_ADMIN_PASSWORD`
 *   between deploys and have the new value take effect on the next pod boot
 *   — without having to manually delete the row first.
 *
 * Skip behavior:
 *   Setting `SEED_ADMIN_EMAIL=` (empty string) disables the seed entirely.
 *   Useful for tests + for projects that want to manage their own users from
 *   day one.
 */
@Injectable()
export class UsersBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersBootstrap.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const seed = this.config.get('seedAdmin', { infer: true });
    if (!seed.email) {
      this.logger.log('SEED_ADMIN_EMAIL is empty — skipping default-user seed.');
      return;
    }

    const hashed = await bcrypt.hash(seed.password, PASSWORD_SALT_ROUNDS);
    await this.prisma.user.upsert({
      where: { email: seed.email },
      update: { password: hashed, name: seed.name },
      create: { email: seed.email, password: hashed, name: seed.name },
    });

    // Log the email so operators can see what to log in with; never log
    // the password.
    this.logger.log(`Default user upserted: ${seed.email}`);
  }
}

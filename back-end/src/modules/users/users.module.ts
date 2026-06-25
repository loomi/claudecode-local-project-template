import { Module } from '@nestjs/common';
import { UsersBootstrap } from './users.bootstrap';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersBootstrap],
  exports: [UsersService],
})
export class UsersModule {}

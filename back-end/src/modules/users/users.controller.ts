import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@modules/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '@modules/auth/strategies/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './dto/user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiCreatedResponse({ type: UserEntity })
  async create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    const user = await this.usersService.create(dto);
    return UserEntity.fromPrisma(user);
  }

  // SECURITY: this lists every user. Acceptable for the template, but a real
  // app must restrict it to admins (e.g. a RolesGuard) before exposing it.
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users' })
  @ApiOkResponse({ type: UserEntity, isArray: true })
  async findAll(): Promise<UserEntity[]> {
    const users = await this.usersService.findAll();
    return users.map((u) => UserEntity.fromPrisma(u));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a user by id (own account only)' })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({ description: 'Cannot access another user' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<UserEntity> {
    this.assertOwnership(current, id);
    const user = await this.usersService.findOne(id);
    return UserEntity.fromPrisma(user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a user (own account only)' })
  @ApiOkResponse({ type: UserEntity })
  @ApiForbiddenResponse({ description: 'Cannot access another user' })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<UserEntity> {
    this.assertOwnership(current, id);
    const user = await this.usersService.update(id, dto);
    return UserEntity.fromPrisma(user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user (own account only)' })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Cannot access another user' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<void> {
    this.assertOwnership(current, id);
    return this.usersService.remove(id);
  }

  // SECURITY: authorization, not just authentication — a logged-in user may
  // only act on their own record (root rule 8).
  private assertOwnership(current: AuthenticatedUser, id: string): void {
    if (current.id !== id) {
      throw new ForbiddenException('You can only access your own account');
    }
  }
}

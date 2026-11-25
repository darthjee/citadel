import { Get, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentOwner } from '../../core/current-owner.decorator.js';
import type { OwnerContext } from '../../core/owner-context.js';
import { OwnerScopedController } from '../../core/owner-scoped.decorator.js';
import { StrictBody } from '../../core/strict-validation.pipe.js';

// Body accepted by the test-only echo route: `label` only.
export class WidgetEchoDto {
  @IsString()
    label!: string;
}

// Test-only owner-scoped controller (test code only, never registered in the app): mounted under
// both `/widgets/...` and `/orgs/:orgId/widgets/...`, it exposes the resolved `OwnerContext` so the
// e2e spec can assert what `OwnerContextGuard` resolved — no test-only entity or table needed.
@OwnerScopedController('widgets')
export class WidgetsTestController {
  @Get('owner.json')
  owner(@CurrentOwner() owner: OwnerContext): OwnerContext {
    return owner;
  }

  @Post('echo.json')
  echo(@CurrentOwner() owner: OwnerContext, @StrictBody() dto: WidgetEchoDto): { owner: OwnerContext; label: string } {
    return { owner, label: dto.label };
  }
}

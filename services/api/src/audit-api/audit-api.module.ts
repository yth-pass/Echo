import { Module } from '@nestjs/common';
import { AuditApiController } from './audit-api.controller';
import { AuditApiService } from './audit-api.service';

@Module({ controllers: [AuditApiController], providers: [AuditApiService] })
export class AuditApiModule {}

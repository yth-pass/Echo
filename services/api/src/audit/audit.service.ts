import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId: string;
    cloneId?: string;
    eventType: string;
    referenceId?: string;
    summaryZh: string;
  }) {
    return this.prisma.auditEvent.create({ data: params });
  }
}

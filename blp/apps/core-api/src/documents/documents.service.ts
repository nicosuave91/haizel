import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { EventsProducerService } from '../events/producer.service';
import { RequestContext } from '../common/interfaces';

interface UploadDocumentDto {
  name: string;
  contentType: string;
  content: string;
}

interface StoredObject {
  key: string;
  body: Buffer;
  contentType: string;
}

@Injectable()
export class DocumentsService {
  private readonly objects = new Map<string, StoredObject>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsProducerService,
  ) {}

  async upload(context: RequestContext, loanId: string, dto: UploadDocumentDto) {
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const storageKey = `${loanId}/${randomUUID()}`;
    this.objects.set(storageKey, {
      key: storageKey,
      body: Buffer.from(dto.content, 'base64'),
      contentType: dto.contentType,
    });

    const document = await this.prisma.document.create({
      data: {
        tenantId: context.tenantId,
        loanId,
        name: dto.name,
        contentType: dto.contentType,
        storageKey,
      },
    });

    this.events.emit({
      type: 'document.uploaded',
      tenantId: context.tenantId,
      payload: { loanId, documentId: document.id },
      timestamp: new Date(),
    });

    return document;
  }

  async list(context: RequestContext, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id_tenantId: { id: loanId, tenantId: context.tenantId } },
    });
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return this.prisma.document.findMany({ where: { tenantId: context.tenantId, loanId } });
  }

  getStoredObject(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }
}

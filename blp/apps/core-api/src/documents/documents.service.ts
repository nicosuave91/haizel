import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { EventsProducerService } from '../events/producer.service';
import { RequestContext } from '../common/interfaces';
import { OpaService } from '../opa/opa.service';

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
    private readonly opa: OpaService,
  ) {}

  async upload(context: RequestContext, loanId: string, dto: UploadDocumentDto) {
    await this.opa.authorize(context.user, {
      action: 'document:upload',
      resourceTenant: context.tenantId,
    });

    const loan = await this.prisma.findLoanModel(context.tenantId, loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const storageKey = `${loanId}/${randomUUID()}`;
    this.objects.set(storageKey, {
      key: storageKey,
      body: Buffer.from(dto.content, 'base64'),
      contentType: dto.contentType,
    });

    const document = await this.prisma.transaction((tx) =>
      this.prisma.createDocument(loan, { name: dto.name, contentType: dto.contentType, storageKey }, tx),
    );

    this.events.emit({
      type: 'document.uploaded',
      tenantId: context.tenantId,
      payload: { loanId, documentId: document.id },
      timestamp: new Date(),
    });

    return document;
  }

  async list(context: RequestContext, loanId: string) {
    await this.opa.authorize(context.user, {
      action: 'document:list',
      resourceTenant: context.tenantId,
    });

    const loan = await this.prisma.findLoanModel(context.tenantId, loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    return this.prisma.listDocuments(loan);
  }

  getStoredObject(key: string): StoredObject | undefined {
    return this.objects.get(key);
  }
}

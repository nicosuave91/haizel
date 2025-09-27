import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { IsBase64, IsNotEmpty, IsString } from 'class-validator';
import { DocumentsService } from './documents.service';
import { Request } from 'express';
import { getRequestContext } from '../common/utils';

class UploadDocumentRequest {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @IsBase64()
  content!: string;
}

@Controller('loans/:loanId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  upload(@Param('loanId') loanId: string, @Body() body: UploadDocumentRequest, @Req() req: Request) {
    return this.documents.upload(getRequestContext(req), loanId, body);
  }

  @Get()
  list(@Param('loanId') loanId: string, @Req() req: Request) {
    return this.documents.list(getRequestContext(req), loanId);
  }
}

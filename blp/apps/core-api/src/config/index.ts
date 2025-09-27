import { Injectable, Module } from '@nestjs/common';

export interface Auth0Config {
  audience: string;
  issuer: string;
  secret: string;
}

export interface StorageConfig {
  bucket: string;
}

export interface TemporalConfig {
  namespace: string;
}

export interface CoreApiConfig {
  auth0: Auth0Config;
  storage: StorageConfig;
  temporal: TemporalConfig;
}

@Injectable()
export class ConfigService implements CoreApiConfig {
  public readonly auth0: Auth0Config;
  public readonly storage: StorageConfig;
  public readonly temporal: TemporalConfig;

  constructor() {
    this.auth0 = {
      audience: process.env.AUTH0_AUDIENCE ?? 'https://core-api.test',
      issuer: process.env.AUTH0_ISSUER ?? 'https://auth0.local/',
      secret: process.env.AUTH0_SECRET ?? 'local-dev-secret',
    };

    this.storage = {
      bucket: process.env.DOCUMENT_BUCKET ?? 'local-documents',
    };

    this.temporal = {
      namespace: process.env.TEMPORAL_NAMESPACE ?? 'default',
    };
  }
}

@Module({
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

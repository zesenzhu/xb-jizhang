import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createObjectStorage } from './object-storage.factory';
import { DisabledObjectStorage } from './disabled-object-storage';
import { OBJECT_STORAGE } from './object-storage.port';

@Global()
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        configService.get<string>('ATTACHMENT_ENABLED') === 'true'
          ? createObjectStorage(configService)
          : new DisabledObjectStorage(),
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class ObjectStorageModule {}

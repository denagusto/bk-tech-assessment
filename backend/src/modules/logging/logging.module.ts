import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggingService } from './logging.service';
import { loggingConfig } from '../../config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(loggingConfig)],
  providers: [LoggingService],
  exports: [LoggingService],
})
export class LoggingModule {}

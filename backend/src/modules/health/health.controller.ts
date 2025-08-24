import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return 'OK';
  }

  @Get('test')
  test() {
    return { message: 'Test endpoint working' };
  }
}

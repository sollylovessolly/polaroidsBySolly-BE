import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Logger,
  Param,
  Post,
  Req,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaymentsService } from './payments.service';
import { PaystackService } from './paystack.service';
import { Public } from '../auth/public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';
import { PaymentFiltersDto } from './dto/payment-filters.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paystack: PaystackService,
  ) {}

  @Post('initialize')
  @Public()
  @RateLimit('PAYMENT_RATE_LIMIT_PER_MINUTE', 20)
  @HttpCode(200)
  @ApiOperation({ summary: 'Initialize a Paystack transaction for an order' })
  @ApiOkResponse({
    schema: {
      example: {
        authorizationUrl: 'https://checkout.paystack.com/test-code',
        accessCode: 'test-code',
        reference: 'pbs_test_reference',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Order is paid or email is missing' })
  @ApiNotFoundResponse({ description: 'Order was not found' })
  initialize(@Body() dto: InitializePaymentDto) {
    return this.paymentsService.initialize(dto);
  }

  @Post('verify')
  @Public()
  @RateLimit('PAYMENT_RATE_LIMIT_PER_MINUTE', 20)
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify Paystack payment and fulfill the order' })
  @ApiOkResponse({ description: 'Verified paid order' })
  @ApiConflictResponse({
    description:
      'Payment was received, but inventory fulfillment is blocked and requires an admin retry',
  })
  @ApiBadRequestResponse({
    description:
      'Failed transaction, amount/currency mismatch, or invalid reference',
  })
  verify(@Body() dto: VerifyPaymentDto) {
    return this.paymentsService.verify(dto);
  }

  @Post('webhook')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack webhook receiver' })
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature?: string,
  ) {
    if (
      !request.rawBody ||
      !this.paystack.verifyWebhookSignature(request.rawBody, signature)
    ) {
      this.logger.warn({ event: 'paystack_webhook_signature_invalid' });
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }

    return this.paymentsService.handleWebhook(
      request.body as { event?: string; data?: { reference?: string } },
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all payments' })
  findAll(@Query() filters: PaymentFiltersDto) {
    return this.paymentsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one payment' })
  @ApiNotFoundResponse({ description: 'Payment was not found' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }
}

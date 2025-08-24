import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Purchase } from '../../database/entities/purchase.entity';
import { FlashSale } from '../../database/entities/flash-sale.entity';
import { User } from '../../database/entities/user.entity';

export interface TransactionMessage {
  username: string;
  flashSaleId: string;
  amount: number;
  timestamp: string;
  redisTransactionId: string;
  kafkaTimestamp: string;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private isConnected = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {
    const brokers = this.configService.get<string[]>('kafka.brokers') || ['localhost:29092'];
    
    this.kafka = new Kafka({
      clientId: this.configService.get<string>('kafka.clientId') || 'flash-sale-consumer',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'flash-sale-db-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupConsumer();
      this.logger.log('Kafka consumer service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Kafka consumer service: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    try {
      await this.disconnect();
      this.logger.log('Kafka consumer service disconnected successfully');
    } catch (error) {
      this.logger.error(`Failed to disconnect Kafka consumer service: ${error.message}`, error.stack);
    }
  }

  /**
   * Connect to Kafka broker
   */
  private async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.isConnected = true;
      this.logger.log('Connected to Kafka broker as consumer');
    } catch (error) {
      this.logger.error(`Failed to connect to Kafka: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka broker
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.consumer) {
        await this.consumer.disconnect();
      }
      this.isConnected = false;
      this.logger.log('Disconnected from Kafka broker');
    } catch (error) {
      this.logger.error(`Failed to disconnect from Kafka: ${error.message}`, error.stack);
    }
  }

  /**
   * Setup consumer for processing database update messages
   */
  private async setupConsumer(): Promise<void> {
    try {
      // Subscribe to flash sale transactions topic
      await this.consumer.subscribe({
        topic: 'flash-sale-transactions',
        fromBeginning: false,
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await this.processDatabaseUpdate(topic, partition, message);
          } catch (error) {
            this.logger.error(`Error processing database update message: ${error.message}`, error.stack);
          }
        },
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
      });

      this.logger.log('Kafka consumer setup completed for database updates');
    } catch (error) {
      this.logger.error(`Failed to setup Kafka consumer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process database update message from Kafka
   */
  private async processDatabaseUpdate(
    topic: string,
    partition: number,
    message: KafkaMessage,
  ): Promise<void> {
    try {
      const messageValue = JSON.parse(message.value.toString()) as TransactionMessage;
      const messageKey = message.key?.toString() || 'unknown';

      this.logger.log(`Processing database update from topic ${topic}: ${messageKey}`);

      // Update database with transaction data
      await this.updateDatabase(messageValue);

      this.logger.log(`Database update processed successfully: ${messageKey}`);
    } catch (error) {
      this.logger.error(`Failed to process database update message: ${error.message}`, error.stack);
      
      // In a production environment, you might want to:
      // 1. Send to a dead letter queue
      // 2. Retry processing
      // 3. Alert monitoring systems
    }
  }

  /**
   * Update database with transaction data
   */
  private async updateDatabase(transactionData: TransactionMessage): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find user by username
      const user = await queryRunner.manager.findOne(User, {
        where: { username: transactionData.username },
      });

      if (!user) {
        throw new Error(`User not found: ${transactionData.username}`);
      }

      // Find flash sale
      const flashSale = await queryRunner.manager.findOne(FlashSale, {
        where: { id: transactionData.flashSaleId },
      });

      if (!flashSale) {
        throw new Error(`Flash sale not found: ${transactionData.flashSaleId}`);
      }

      // Create purchase record
      const purchase = new Purchase();
      purchase.userId = user.id;
      purchase.flash_sale_id = flashSale.id;
      purchase.purchaseId = transactionData.redisTransactionId;
      purchase.timestamp = new Date(transactionData.timestamp);

      await queryRunner.manager.save(Purchase, purchase);

      // Update flash sale stock
      flashSale.current_stock = Math.max(0, flashSale.current_stock - transactionData.amount);
      await queryRunner.manager.save(FlashSale, flashSale);

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log(`Database updated successfully for transaction: ${transactionData.redisTransactionId}`);

    } catch (error) {
      this.logger.error(`Database update failed: ${error.message}`, error.stack);
      
      // Rollback transaction on error
      await queryRunner.rollbackTransaction();
      
      throw error;
    } finally {
      // Release the query runner
      await queryRunner.release();
    }
  }

  /**
   * Health check for Kafka consumer service
   */
  async healthCheck(): Promise<{ status: string; kafka: boolean; database: boolean }> {
    try {
      const kafkaHealth = this.isConnected;
      
      // Check database connection
      const databaseHealth = await this.dataSource.query('SELECT 1') !== null;

      return {
        status: kafkaHealth && databaseHealth ? 'healthy' : 'unhealthy',
        kafka: kafkaHealth,
        database: databaseHealth,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);
      return {
        status: 'unhealthy',
        kafka: false,
        database: false,
      };
    }
  }

  /**
   * Get consumer lag information
   */
  async getConsumerLag(): Promise<any> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const consumerGroups = await admin.listGroups();
      const groupId = 'flash-sale-db-consumer-group';
      
      if (consumerGroups.groups.some(group => group.groupId === groupId)) {
        const offsets = await admin.fetchOffsets({
          groupId,
          topics: ['flash-sale-transactions'],
        });
        
        await admin.disconnect();
        
        return {
          groupId,
          offsets,
        };
      }
      
      await admin.disconnect();
      return { groupId, message: 'Consumer group not found' };
    } catch (error) {
      this.logger.error(`Failed to get consumer lag: ${error.message}`, error.stack);
      throw error;
    }
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { ConfigService } from '@nestjs/config';

export interface KafkaMessageData {
  key: string;
  value: any;
  topic: string;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    const brokers = this.configService.get<string[]>('kafka.brokers') || ['localhost:29092'];
    
    this.kafka = new Kafka({
      clientId: this.configService.get<string>('kafka.clientId') || 'flash-sale-service',
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    this.consumer = this.kafka.consumer({
      groupId: 'flash-sale-consumer-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async onModuleInit() {
    try {
      await this.connect();
      await this.setupConsumer();
      this.logger.log('Kafka service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Kafka service: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    try {
      await this.disconnect();
      this.logger.log('Kafka service disconnected successfully');
    } catch (error) {
      this.logger.error(`Failed to disconnect Kafka service: ${error.message}`, error.stack);
    }
  }

  /**
   * Connect to Kafka broker
   */
  private async connect(): Promise<void> {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Connected to Kafka broker');
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
      if (this.producer) {
        await this.producer.disconnect();
      }
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
   * Publish message to Kafka topic
   */
  async publish(topic: string, message: KafkaMessageData): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Kafka service is not connected');
    }

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: message.key,
            value: JSON.stringify(message.value),
            timestamp: Date.now().toString(),
          },
        ],
      });

      this.logger.debug(`Message published to topic ${topic}: ${message.key}`);
    } catch (error) {
      this.logger.error(`Failed to publish message to Kafka: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Setup consumer for processing messages
   */
  private async setupConsumer(): Promise<void> {
    try {
      await this.consumer.connect();
      
      // Subscribe to flash sale transactions topic
      await this.consumer.subscribe({
        topic: 'flash-sale-transactions',
        fromBeginning: false,
      });

      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await this.processMessage(topic, partition, message);
          } catch (error) {
            this.logger.error(`Error processing message: ${error.message}`, error.stack);
          }
        },
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
      });

      this.logger.log('Kafka consumer setup completed');
    } catch (error) {
      this.logger.error(`Failed to setup Kafka consumer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process incoming Kafka messages
   */
  private async processMessage(
    topic: string,
    partition: number,
    message: KafkaMessage,
  ): Promise<void> {
    try {
      const messageValue = JSON.parse(message.value.toString());
      const messageKey = message.key?.toString() || 'unknown';

      this.logger.log(`Processing message from topic ${topic}: ${messageKey}`);

      // Here you would typically:
      // 1. Parse the transaction data
      // 2. Update the database
      // 3. Handle any business logic
      // 4. Log the successful processing

      this.logger.log(`Message processed successfully: ${messageKey}`);
    } catch (error) {
      this.logger.error(`Failed to process message: ${error.message}`, error.stack);
      
      // In a production environment, you might want to:
      // 1. Send to a dead letter queue
      // 2. Retry processing
      // 3. Alert monitoring systems
    }
  }

  /**
   * Health check for Kafka service
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      // Try to get metadata to verify connection
      const admin = this.kafka.admin();
      await admin.connect();
      const metadata = await admin.fetchTopicMetadata({ topics: ['flash-sale-transactions'] });
      await admin.disconnect();

      return true;
    } catch (error) {
      this.logger.error(`Kafka health check failed: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Get Kafka cluster information
   */
  async getClusterInfo(): Promise<any> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const metadata = await admin.fetchTopicMetadata();
      const clusterInfo = await admin.describeCluster();
      
      await admin.disconnect();

      return {
        topics: metadata.topics,
        cluster: {
          controller: clusterInfo.controller,
          brokers: clusterInfo.brokers,
          clusterId: clusterInfo.clusterId,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get cluster info: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Create topic if it doesn't exist
   */
  async createTopic(topic: string, partitions: number = 1, replicationFactor: number = 1): Promise<void> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      await admin.createTopics({
        topics: [
          {
            topic,
            numPartitions: partitions,
            replicationFactor,
            configEntries: [
              {
                name: 'cleanup.policy',
                value: 'delete',
              },
              {
                name: 'retention.ms',
                value: '604800000', // 7 days
              },
            ],
          },
        ],
      });
      
      await admin.disconnect();
      this.logger.log(`Topic ${topic} created successfully`);
    } catch (error) {
      this.logger.error(`Failed to create topic ${topic}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

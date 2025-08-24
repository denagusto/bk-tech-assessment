module.exports = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres123',
  database: 'flash_sale',
  entities: ['src/modules/database/entities/*.ts'],
  migrations: ['src/modules/database/migrations/*.ts'],
  cli: {
    migrationsDir: 'src/modules/database/migrations',
    entitiesDir: 'src/modules/database/entities',
  },
  logging: true,
};

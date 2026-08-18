const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { TrendFetchService } = require('../dist/sources/trend-fetch.service');

async function main() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App context bootstrapped.');
  
  const fetchService = app.get(TrendFetchService);
  console.log('Running trend fetch...');
  try {
    const result = await fetchService.fetchAndStoreAll();
    console.log('Trend fetch finished with result:', result);
  } catch (error) {
    console.error('Trend fetch failed with error:', error);
  } finally {
    await app.close();
  }
}

main();

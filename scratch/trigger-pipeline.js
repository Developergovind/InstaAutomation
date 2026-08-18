const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PostPipelineService } = require('../dist/posts/post-pipeline.service');

async function main() {
  console.log('Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App context bootstrapped.');
  
  const pipeline = app.get(PostPipelineService);
  console.log('Running post pipeline for top trend...');
  try {
    const result = await pipeline.runForTopTrend();
    console.log('Pipeline finished with result:', result);
  } catch (error) {
    console.error('Pipeline failed with error:', error);
  } finally {
    await app.close();
  }
}

main();

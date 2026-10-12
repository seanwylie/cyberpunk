import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as fs from 'fs'; import * as path from 'path';
import { WvConfig } from './config';

/** Stages the news Lambda + the shared writer (server/city_news.mjs) so the zip is tiny and drift-free. */
export function stageCityLambda(): string {
  const root = path.resolve(__dirname, '..', '..'); const out = path.resolve(__dirname, '..', '.staged', 'city'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'infra', 'lambda', 'city-news.mjs'), path.join(out, 'city-news.mjs')); fs.copyFileSync(path.join(root, 'server', 'city_news.mjs'), path.join(out, 'city_news.mjs')); return out;
}
/** Living city (docs/LIVING_CITY.md): the server-wide world-state table (written by the hub) and the weekly AI news Lambda (EventBridge). */
export class CityStack extends Stack {
  readonly table: dynamodb.Table;
  constructor(scope: Construct, id: string, cfg: WvConfig, props?: StackProps) {
    super(scope, id, props);
    // pk='state' (hub, every 60 s when changed), pk='news#latest' (Lambda, weekly). Point-in-time recovery: the city is player history.
    this.table = new dynamodb.Table(this, 'CityState', { partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING }, billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }, removalPolicy: RemovalPolicy.RETAIN });
    const key = secrets.Secret.fromSecretNameV2(this, 'OpenAiKey', 'wv/openai-api-key'); // created by WvStory; missing/placeholder key = canned news
    const fn = new lambda.Function(this, 'NewsFn', { runtime: lambda.Runtime.NODEJS_22_X, architecture: cfg.arch === 'x86' ? lambda.Architecture.X86_64 : lambda.Architecture.ARM_64, handler: 'city-news.handler', code: lambda.Code.fromAsset(stageCityLambda()), memorySize: 256, timeout: Duration.seconds(60), reservedConcurrentExecutions: 1,
      environment: { CITY_TABLE: this.table.tableName, OPENAI_SECRET_ID: 'wv/openai-api-key', CITY_AI: '1' }, logGroup: new logs.LogGroup(this, 'NewsLogs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY }) });
    this.table.grantReadWriteData(fn); key.grantRead(fn);
    // Weekly, Monday 06:00 UTC (the week aggregate rolls over at 00:00 UTC Monday). One AI call per week.
    new events.Rule(this, 'WeeklyNews', { schedule: events.Schedule.cron({ minute: '0', hour: '6', weekDay: 'MON' }), targets: [new targets.LambdaFunction(fn, { retryAttempts: 2 })] });
    new CfnOutput(this, 'CityTableName', { value: this.table.tableName }); new CfnOutput(this, 'NewsFnName', { value: fn.functionName });
  }
}

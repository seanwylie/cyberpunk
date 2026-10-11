import { Stack, StackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as fs from 'fs'; import * as path from 'path';
import { WvConfig } from './config';

/** Copies the Lambda handler + the shared story service files into a staging dir (so the Lambda zip is tiny and drift-free). */
export function stageStoryLambda(): string {
  const root = path.resolve(__dirname, '..', '..'); const out = path.resolve(__dirname, '..', '.staged', 'story'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'infra', 'lambda', 'story-beat.mjs'), path.join(out, 'story-beat.mjs'));
  for (const f of ['story_beat.mjs', 'story_catalog.json']) fs.copyFileSync(path.join(root, 'server', f), path.join(out, f));
  return out;
}

/** Story-beat proxy as a Lambda Function URL. OPENAI_API_KEY lives in Secrets Manager and is read at cold start; never in the client or the template. */
export class StoryStack extends Stack {
  readonly url: string;
  constructor(scope: Construct, id: string, cfg: WvConfig, clientUrl: string, props?: StackProps) {
    super(scope, id, props);
    const key = new secrets.Secret(this, 'OpenAiKey', { secretName: 'wv/openai-api-key', description: 'OPENAI_API_KEY for the story proxy. Set with: aws secretsmanager put-secret-value --secret-id wv/openai-api-key --secret-string sk-...' });
    const fn = new lambda.Function(this, 'StoryFn', { runtime: lambda.Runtime.NODEJS_22_X, architecture: cfg.arch === 'x86' ? lambda.Architecture.X86_64 : lambda.Architecture.ARM_64, handler: 'story-beat.handler', code: lambda.Code.fromAsset(stageStoryLambda()), memorySize: 256, timeout: Duration.seconds(20), reservedConcurrentExecutions: 5,
      environment: { OPENAI_SECRET_ID: key.secretName, STORY_DAILY_CAP: '500', STORY_TRUST_PROXY: '0' }, logGroup: new logs.LogGroup(this, 'StoryLogs', { retention: logs.RetentionDays.ONE_MONTH }) });
    key.grantRead(fn);
    // Public URL (the game client calls it from the browser). Abuse is bounded by the service's per-IP/session/daily caps AND reserved concurrency 5.
    const fu = fn.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE, cors: { allowedOrigins: clientUrl.startsWith('https://') ? [clientUrl] : ['*'], allowedMethods: [lambda.HttpMethod.POST], allowedHeaders: ['content-type'], maxAge: Duration.hours(1) } });
    this.url = fu.url; new CfnOutput(this, 'StoryUrl', { value: fu.url }); new CfnOutput(this, 'OpenAiSecretName', { value: key.secretName });
  }
}

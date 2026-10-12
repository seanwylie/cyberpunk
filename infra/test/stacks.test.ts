// Assertions on the synthesized templates (no AWS account needed). Run: npm test
import test from 'node:test'; import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib'; import { Template, Match } from 'aws-cdk-lib/assertions';
import { buildApp } from '../lib/app'; import { readConfig, WvConfig } from '../lib/config';
const base = (o: Partial<WvConfig> = {}) => { const app = new App({ context: {} }); return { app, cfg: { ...readConfig(app), account: '111111111111', ...o } as WvConfig }; };
const domain = { domainName: 'example.com', hostedZoneId: 'Z0000000EXAMPLE', alertEmail: 'ops@example.com' };
test('synth works with no domain and no credentials', () => { const { app, cfg } = base(); const s = buildApp(app, cfg); for (const st of [s.client, s.server, s.story, s.billing]) Template.fromStack(st); });
test('client: private bucket, OAC, hashed assets immutable policy, SPA error mapping', () => {
  const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).client);
  t.hasResourceProperties('AWS::S3::Bucket', { PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true } });
  t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
  t.hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: Match.objectLike({ Aliases: ['play.example.com'], DefaultRootObject: 'index.html', CacheBehaviors: [Match.objectLike({ PathPattern: 'assets/*' })] }) });
  t.hasResourceProperties('AWS::CloudFront::CachePolicy', { CachePolicyConfig: Match.objectLike({ MinTTL: 0, DefaultTTL: 0, MaxTTL: 31536000 }) });
  t.resourceCountIs('AWS::Route53::RecordSet', 2); t.resourceCountIs('AWS::CertificateManager::Certificate', 1);
});
test('server: ALB idle timeout 3600, health check /healthz, TLS listener + redirect, ACM + Route53', () => {
  const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).server);
  t.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { LoadBalancerAttributes: Match.arrayWith([{ Key: 'idle_timeout.timeout_seconds', Value: '3600' }]) });
  t.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', { HealthCheckPath: '/healthz', Matcher: { HttpCode: '200' }, TargetGroupAttributes: Match.arrayWith([{ Key: 'stickiness.enabled', Value: 'true' }]) });
  t.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 443, Protocol: 'HTTPS' }); t.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 80, DefaultActions: [Match.objectLike({ Type: 'redirect' })] });
  t.resourceCountIs('AWS::CertificateManager::Certificate', 1); t.resourceCountIs('AWS::Route53::RecordSet', 1);
});
test('server: Fargate ARM task, min 1 task, graceful stop, origin allow-list, caps, no secrets in env', () => {
  const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).server);
  t.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 1, LaunchType: 'FARGATE', DeploymentConfiguration: Match.objectLike({ DeploymentCircuitBreaker: { Enable: true, Rollback: true } }) });
  t.hasResourceProperties('AWS::ECS::TaskDefinition', { RuntimePlatform: { CpuArchitecture: 'ARM64', OperatingSystemFamily: 'LINUX' }, ContainerDefinitions: [Match.objectLike({ StopTimeout: 30, ReadonlyRootFilesystem: true, Environment: Match.arrayWith([Match.objectLike({ Name: 'WV_ORIGINS' }), { Name: 'WV_MAX_ROOMS', Value: '100' }]) })] });
  const json = JSON.stringify(t.toJSON()); assert.ok(!/sk-[A-Za-z0-9]/.test(json), 'no API key material in template'); assert.ok(!json.includes('WV_DEV'), 'WV_DEV never set');
});
test('server: autoscaling by CPU + connection count, capped by maxTasks (default 1)', () => {
  const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).server);
  t.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', { MinCapacity: 1, MaxCapacity: 1 }); t.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', { PolicyType: 'TargetTrackingScaling' }); t.hasResourceProperties('AWS::ApplicationAutoScaling::ScalingPolicy', { PolicyType: 'StepScaling' });
  const g = base({ ...domain, maxTasks: 4 }); Template.fromStack(buildApp(g.app, g.cfg).server).hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', { MaxCapacity: 4 });
});
test('server: alarms and SNS email', () => { const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).server); assert.ok(Object.keys(t.findResources('AWS::CloudWatch::Alarm')).length >= 5); t.hasResourceProperties('AWS::SNS::Subscription', { Protocol: 'email', Endpoint: 'ops@example.com' }); t.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 30 }); });
test('server: in-service story proxy is opt-in and pulls the key from Secrets Manager', () => { const { app, cfg } = base({ ...domain, enableStoryInService: true }); const t = Template.fromStack(buildApp(app, cfg).server); t.hasResourceProperties('AWS::ECS::TaskDefinition', { ContainerDefinitions: [Match.objectLike({ Secrets: [Match.objectLike({ Name: 'OPENAI_API_KEY' })] })] }); });
test('story lambda: Function URL with CORS to the client, reserved concurrency, secret read only', () => {
  const { app, cfg } = base(domain); const t = Template.fromStack(buildApp(app, cfg).story);
  t.hasResourceProperties('AWS::Lambda::Function', { Runtime: 'nodejs22.x', Architectures: ['arm64'], ReservedConcurrentExecutions: 5, Environment: { Variables: Match.objectLike({ OPENAI_SECRET_ID: Match.anyValue() }) } });
  t.hasResourceProperties('AWS::Lambda::Url', { AuthType: 'NONE', Cors: Match.objectLike({ AllowOrigins: ['https://play.example.com'], AllowMethods: ['POST'] }) });
  const json = JSON.stringify(t.toJSON()); assert.ok(!/sk-[A-Za-z0-9]{10}/.test(json));
});
test('billing: budget with email notifications', () => { const { app, cfg } = base(domain); Template.fromStack(buildApp(app, cfg).billing).hasResourceProperties('AWS::Budgets::Budget', { Budget: Match.objectLike({ BudgetLimit: { Amount: 30, Unit: 'USD' } }) }); });
test('ci: optional OIDC role is locked to the repo main branch', () => { const { app, cfg } = base({ ...domain, createOidcRole: true }); const s = buildApp(app, cfg); assert.ok(s.ci); const j = JSON.stringify(Template.fromStack(s.ci!).toJSON()); assert.ok(j.includes('repo:seanwylie/cyberpunk:ref:refs/heads/main')); });
test('arch=x86 switches Fargate task (and story Lambda) to X86_64; default stays ARM64', () => {
  const { app, cfg } = base({ ...domain, arch: 'x86' }); const s = buildApp(app, cfg);
  Template.fromStack(s.server).hasResourceProperties('AWS::ECS::TaskDefinition', { RuntimePlatform: { CpuArchitecture: 'X86_64', OperatingSystemFamily: 'LINUX' } });
  Template.fromStack(s.story).hasResourceProperties('AWS::Lambda::Function', { Architectures: ['x86_64'] });
  const d = base(domain); Template.fromStack(buildApp(d.app, d.cfg).server).hasResourceProperties('AWS::ECS::TaskDefinition', { RuntimePlatform: { CpuArchitecture: 'ARM64' } });
  const a = new App({ context: { arch: 'x86' } }); assert.equal(readConfig(a).arch, 'x86');
});
test('server: existingRepo imports wv-hub (no AWS::ECR::Repository) and still grants pull + outputs the URI', () => {
  const { app, cfg } = base({ ...domain, existingRepo: true }); const t = Template.fromStack(buildApp(app, cfg).server);
  t.resourceCountIs('AWS::ECR::Repository', 0);
  t.hasResourceProperties('AWS::IAM::Policy', { PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Action: Match.arrayWith(['ecr:BatchGetImage']) })]) } });
  assert.ok(JSON.stringify(t.findOutputs('EcrRepoUri')).includes('wv-hub')); assert.ok(JSON.stringify(t.toJSON()).includes('wv-hub:latest') || JSON.stringify(t.toJSON()).includes('/wv-hub'));
  const d = base(domain); Template.fromStack(buildApp(d.app, d.cfg).server).resourceCountIs('AWS::ECR::Repository', 1); // default unchanged
});
test('server: first deploy with zero tasks (minTasks=0 maxTasks=0) and desiredCount override', () => {
  const { app, cfg } = base({ ...domain, minTasks: 0, maxTasks: 0, desiredCount: 0 }); const t = Template.fromStack(buildApp(app, cfg).server);
  t.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 0 }); t.hasResourceProperties('AWS::ApplicationAutoScaling::ScalableTarget', { MinCapacity: 0, MaxCapacity: 0 });
  const o = base({ ...domain, desiredCount: 1, minTasks: 0, maxTasks: 2 }); Template.fromStack(buildApp(o.app, o.cfg).server).hasResourceProperties('AWS::ECS::Service', { DesiredCount: 1 });
});
test('root cause: without a domain the client URL is a CloudFront token, so WvStory (and WvServer) depend on WvClient; with a domain they do not', () => {
  const a = base({}); const sa = buildApp(a.app, a.cfg); Template.fromStack(sa.story); assert.ok(sa.story.dependencies.some(d => d.stackName === 'WvClient'), 'no domain: WvStory pulls in WvClient');
  const b = base(domain); const sb = buildApp(b.app, b.cfg); Template.fromStack(sb.story); assert.ok(!sb.story.dependencies.some(d => d.stackName === 'WvClient'), 'with a domain: WvStory is independent of WvClient'); assert.ok(!sb.server.dependencies.some(d => d.stackName === 'WvClient'));
});
test('committed infra/cdk.context.json carries the live deployment values (no context flags needed)', async () => {
  const fs = await import('node:fs'); const ctx = JSON.parse(fs.readFileSync('cdk.context.json', 'utf8')) /* npm test runs in infra/ */;
  const app = new App({ context: ctx }); const cfg = readConfig(app); assert.equal(cfg.domainName, 'seanwylie.ca'); assert.equal(cfg.hostedZoneId, 'Z04435742M9VY95ZIB9BY'); assert.equal(cfg.clientSubdomain, 'play'); assert.equal(cfg.serverSubdomain, 'game'); assert.equal(cfg.arch, 'x86'); assert.equal(cfg.existingRepo, true); assert.equal(cfg.createOidcRole, true); assert.equal(cfg.monthlyBudgetUsd, 40);
  const s = buildApp(app, { ...cfg, account: '111111111111' }); Template.fromStack(s.story); assert.ok(!s.story.dependencies.some(d => d.stackName === 'WvClient'), 'WvStory no longer depends on WvClient');
  Template.fromStack(s.client).hasResourceProperties('AWS::CloudFront::Distribution', { DistributionConfig: Match.objectLike({ Aliases: ['play.seanwylie.ca'] }) });
  Template.fromStack(s.server).resourceCountIs('AWS::ECR::Repository', 0); Template.fromStack(s.story).hasResourceProperties('AWS::Lambda::Function', { Architectures: ['x86_64'] });
});

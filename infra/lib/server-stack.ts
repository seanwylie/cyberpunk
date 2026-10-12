import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwa from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as appscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { WvConfig, clientHost, serverHost } from './config';

/** Game WebSocket server: ECS Fargate behind an ALB (WebSocket upgrade works natively, idle timeout 3600 s). One task per region to start. */
export class ServerStack extends Stack {
  readonly repo: ecr.IRepository; readonly service: ecs.FargateService; readonly cluster: ecs.Cluster; readonly alb: elbv2.ApplicationLoadBalancer; readonly wsUrl: string;
  constructor(scope: Construct, id: string, cfg: WvConfig, clientUrl: string, props?: StackProps, extra: { cityTable?: dynamodb.ITable } = {}) {
    super(scope, id, props);
    // Public subnets only (no NAT gateway = ~US$32/mo saved). Tasks get public IPs but the security group only admits the ALB.
    const vpc = new ec2.Vpc(this, 'Vpc', { availabilityZones: cfg.azs ?? [`${this.region}a`, `${this.region}b`], // explicit: no AWS lookup, so synth needs no credentials
       natGateways: 0, subnetConfiguration: [{ name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 }] });
    // existingRepo=true: 'wv-hub' already exists in the account (e.g. RETAINed after a failed first create), so import it instead of creating it.
    this.repo = cfg.existingRepo ? ecr.Repository.fromRepositoryName(this, 'Repo', 'wv-hub')
      : new ecr.Repository(this, 'Repo', { repositoryName: 'wv-hub', imageScanOnPush: true, removalPolicy: RemovalPolicy.RETAIN, lifecycleRules: [{ maxImageCount: 15 }] });
    this.cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsightsV2: ecs.ContainerInsights.DISABLED });
    const logGroup = new logs.LogGroup(this, 'Logs', { retention: logs.RetentionDays.ONE_MONTH, removalPolicy: RemovalPolicy.DESTROY });
    const task = new ecs.FargateTaskDefinition(this, 'Task', { cpu: cfg.taskCpu, memoryLimitMiB: cfg.taskMemMiB, runtimePlatform: { cpuArchitecture: cfg.arch === 'x86' ? ecs.CpuArchitecture.X86_64 : ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX } });
    this.repo.grantPull(task.obtainExecutionRole()); // explicit pull permission (also needed for an imported repo)
    const origins = [clientUrl].filter(Boolean).join(',');
    const env: Record<string, string> = { PORT: '8787', WV_ORIGINS: origins, WV_ALLOW_NO_ORIGIN: '0', WV_MAX_CONNS: String(cfg.maxConns), WV_MAX_ROOMS: String(cfg.maxRooms), WV_MAX_PARTIES: String(cfg.maxParties), WV_GRACE_MS: '20000' };
    if (extra.cityTable) { env.WV_CITY_TABLE = extra.cityTable.tableName; extra.cityTable.grantReadWriteData(task.taskRole); } // living city state (GetItem/PutItem via the task role)
    const secretMap: Record<string, ecs.Secret> = {};
    if (cfg.enableStoryInService) { // optional: serve /api/story-beat from the same service (otherwise use the Lambda in StoryStack)
      const key = new secrets.Secret(this, 'OpenAiKeyInService', { secretName: 'wv/openai-api-key-service', description: 'OPENAI_API_KEY for the in-service story proxy. Overwrite with: aws secretsmanager put-secret-value' });
      env.WV_STORY = '1'; env.STORY_TRUST_PROXY = '1'; secretMap.OPENAI_API_KEY = ecs.Secret.fromSecretsManager(key);
    }
    task.addContainer('hub', { image: ecs.ContainerImage.fromEcrRepository(this.repo, cfg.imageTag), portMappings: [{ containerPort: 8787 }], environment: env, secrets: secretMap, stopTimeout: Duration.seconds(30), readonlyRootFilesystem: true,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'hub' }), healthCheck: { command: ['CMD-SHELL', "node -e \"fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""], interval: Duration.seconds(15), timeout: Duration.seconds(3), retries: 3, startPeriod: Duration.seconds(10) } });
    const svcSg = new ec2.SecurityGroup(this, 'ServiceSg', { vpc, description: 'hub tasks: only the ALB', allowAllOutbound: true });
    this.service = new ecs.FargateService(this, 'Service', { cluster: this.cluster, taskDefinition: task, desiredCount: cfg.desiredCount, assignPublicIp: true, vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, securityGroups: [svcSg], minHealthyPercent: 100, maxHealthyPercent: 200, circuitBreaker: { rollback: true }, healthCheckGracePeriod: Duration.seconds(30), enableExecuteCommand: false });

    const host = serverHost(cfg); const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc, description: 'public ALB', allowAllOutbound: true });
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', { vpc, internetFacing: true, securityGroup: albSg, idleTimeout: Duration.seconds(3600), http2Enabled: true, dropInvalidHeaderFields: true });
    svcSg.addIngressRule(albSg, ec2.Port.tcp(8787), 'ALB to hub');
    const tg = new elbv2.ApplicationTargetGroup(this, 'Tg', { vpc, port: 8787, protocol: elbv2.ApplicationProtocol.HTTP, targets: [this.service], deregistrationDelay: Duration.seconds(60),
      healthCheck: { path: '/healthz', healthyHttpCodes: '200', interval: Duration.seconds(15), timeout: Duration.seconds(5), healthyThresholdCount: 2, unhealthyThresholdCount: 3 },
      stickinessCookieDuration: Duration.hours(12) }); // lb_cookie stickiness so a reconnecting browser lands on the task that owns its party (matters once maxTasks > 1)
    let zone: r53.IHostedZone | undefined; let cert: acm.ICertificate | undefined;
    if (host && cfg.hostedZoneId && cfg.domainName) {
      zone = r53.HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: cfg.hostedZoneId, zoneName: cfg.domainName });
      cert = new acm.Certificate(this, 'ServerCert', { domainName: host, validation: acm.CertificateValidation.fromDns(zone) });
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'wss/https'); albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'redirect');
      this.alb.addListener('Https', { port: 443, certificates: [cert], sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS, defaultTargetGroups: [tg] });
      this.alb.addListener('Http', { port: 80, defaultAction: elbv2.ListenerAction.redirect({ protocol: 'HTTPS', port: '443', permanent: true }) });
      new r53.ARecord(this, 'ServerAlias', { zone, recordName: host, target: r53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(this.alb)) });
      this.wsUrl = `wss://${host}`;
    } else { // no domain: plain HTTP/ws on the ALB DNS name. Fine for a smoke test, NOT for an https page (mixed content) or production.
      albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'ws (no domain configured)'); this.alb.addListener('Http', { port: 80, defaultTargetGroups: [tg] }); this.wsUrl = `ws://${this.alb.loadBalancerDnsName}`;
    }
    // Scaling: CPU target + ALB connection count. Capped by cfg.maxTasks (default 1: in-memory rooms, see docs).
    const scaling = this.service.autoScaleTaskCount({ minCapacity: cfg.minTasks, // 0 is allowed (first deploy before an image exists)
       maxCapacity: cfg.maxTasks });
    scaling.scaleOnCpuUtilization('Cpu', { targetUtilizationPercent: 60, scaleInCooldown: Duration.minutes(10), scaleOutCooldown: Duration.minutes(2) });
    scaling.scaleOnMetric('Conns', { metric: this.alb.metrics.activeConnectionCount({ period: Duration.minutes(1), statistic: 'Maximum' }), adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY, cooldown: Duration.minutes(5),
      scalingSteps: [{ upper: 150, change: -1 }, { lower: 300, change: +1 }, { lower: 450, change: +2 }] });
    // Alarms -> SNS (email optional)
    const topic = new sns.Topic(this, 'Alerts'); if (cfg.alertEmail) topic.addSubscription(new subs.EmailSubscription(cfg.alertEmail)); const act = new cwa.SnsAction(topic);
    const mk = (n: string, m: cw.IMetric, th: number, desc: string, periods = 3) => { const a = new cw.Alarm(this, n, { metric: m, threshold: th, evaluationPeriods: periods, comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD, alarmDescription: desc, treatMissingData: cw.TreatMissingData.NOT_BREACHING }); a.addAlarmAction(act); return a; };
    mk('CpuHigh', this.service.metricCpuUtilization({ period: Duration.minutes(5) }), 80, 'hub CPU >= 80% for 15 min');
    mk('MemHigh', this.service.metricMemoryUtilization({ period: Duration.minutes(5) }), 85, 'hub memory >= 85% for 15 min');
    mk('UnhealthyHosts', tg.metrics.unhealthyHostCount({ period: Duration.minutes(1) }), 1, 'ALB sees an unhealthy hub task', 3);
    mk('Alb5xx', this.alb.metrics.httpCodeElb(elbv2.HttpCodeElb.ELB_5XX_COUNT, { period: Duration.minutes(5) }), 10, 'ALB 5xx burst', 1);
    new cw.Alarm(this, 'NoHealthy', { metric: tg.metrics.healthyHostCount({ period: Duration.minutes(1) }), threshold: 1, evaluationPeriods: 3, comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD, treatMissingData: cw.TreatMissingData.BREACHING, alarmDescription: 'No healthy hub task: multiplayer is down' }).addAlarmAction(act);
    new CfnOutput(this, 'WsUrl', { value: this.wsUrl }); new CfnOutput(this, 'EcrRepoUri', { value: this.repo.repositoryUri }); new CfnOutput(this, 'ClusterName', { value: this.cluster.clusterName }); new CfnOutput(this, 'ServiceName', { value: this.service.serviceName }); new CfnOutput(this, 'LogGroupName', { value: logGroup.logGroupName });
  }
}

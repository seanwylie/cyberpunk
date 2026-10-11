import { App } from 'aws-cdk-lib';
/** All deployment parameters. Pass with `cdk synth -c key=value` (or cdk.context.json). Everything is optional so `cdk synth` works with no AWS account. */
export interface WvConfig {
  region: string; account?: string;
  domainName?: string;        // apex or parent domain you own, e.g. example.com
  hostedZoneId?: string;      // Route 53 hosted zone id of domainName
  clientSubdomain: string;    // play  -> play.example.com (CloudFront)
  serverSubdomain: string;    // game  -> game.example.com (ALB, wss://)
  storySubdomain: string;     // not used by Function URL; reserved
  alertEmail?: string; monthlyBudgetUsd: number;
  minTasks: number; maxTasks: number; desiredCount: number; existingRepo: boolean; arch: 'arm64' | 'x86'; taskCpu: number; taskMemMiB: number;
  maxRooms: number; maxParties: number; maxConns: number;
  githubRepo?: string; createOidcRole: boolean;
  azs?: string[]; imageTag: string; enableStoryInService: boolean;
}
export function readConfig(app: App): WvConfig {
  const c = (k: string, d?: any) => app.node.tryGetContext(k) ?? process.env['WV_' + k.toUpperCase()] ?? d;
  const num = (k: string, d: number) => Number(c(k, d));
  return {
    region: c('region', 'us-east-1'), account: c('account', process.env.CDK_DEFAULT_ACCOUNT),
    domainName: c('domainName'), hostedZoneId: c('hostedZoneId'),
    clientSubdomain: c('clientSubdomain', 'play'), serverSubdomain: c('serverSubdomain', 'game'), storySubdomain: c('storySubdomain', 'story'),
    alertEmail: c('alertEmail'), monthlyBudgetUsd: num('monthlyBudgetUsd', 30),
    // The hub keeps parties/rooms in process memory, so more than one task needs the room-ownership layer (docs/DEPLOY_AWS.md section 8). Default cap = 1.
    minTasks: num('minTasks', 1), maxTasks: num('maxTasks', 1), desiredCount: num('desiredCount', num('minTasks', 1)), existingRepo: String(c('existingRepo', 'false')) === 'true',
    arch: (['x86', 'x86_64', 'amd64'].includes(String(c('arch', 'arm64')).toLowerCase()) ? 'x86' : 'arm64'), taskCpu: num('taskCpu', 256), taskMemMiB: num('taskMemMiB', 512),
    maxRooms: num('maxRooms', 100), maxParties: num('maxParties', 500), maxConns: num('maxConns', 500),
    githubRepo: c('githubRepo', 'seanwylie/cyberpunk'), createOidcRole: String(c('createOidcRole', 'false')) === 'true',
    azs: c('azs') ? String(c('azs')).split(',') : undefined, imageTag: c('imageTag', 'latest'), enableStoryInService: String(c('storyInService', 'false')) === 'true',
  };
}
export const clientHost = (c: WvConfig) => (c.domainName ? `${c.clientSubdomain}.${c.domainName}` : undefined);
export const serverHost = (c: WvConfig) => (c.domainName ? `${c.serverSubdomain}.${c.domainName}` : undefined);

import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { WvConfig } from './config';
import { ClientStack } from './client-stack';
import { ServerStack } from './server-stack';
/** OPTIONAL (context createOidcRole=true): GitHub Actions OIDC provider + a least-privilege deploy role. Skip if you already have a provider/role and pass its ARN to the workflow. */
export class CiStack extends Stack {
  constructor(scope: Construct, id: string, cfg: WvConfig, client: ClientStack, server: ServerStack, props?: StackProps) {
    super(scope, id, props);
    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidc', { url: 'https://token.actions.githubusercontent.com', clientIds: ['sts.amazonaws.com'] });
    const role = new iam.Role(this, 'DeployRole', { roleName: 'wv-github-deploy', maxSessionDuration: undefined,
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, { StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' }, StringLike: { 'token.actions.githubusercontent.com:sub': `repo:${cfg.githubRepo}:ref:refs/heads/main` } }) });
    client.bucket.grantReadWrite(role); client.bucket.grantDelete(role);
    role.addToPolicy(new iam.PolicyStatement({ actions: ['cloudfront:CreateInvalidation'], resources: [`arn:aws:cloudfront::${this.account}:distribution/${client.distribution.distributionId}`] }));
    server.repo.grantPullPush(role);
    role.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }));
    role.addToPolicy(new iam.PolicyStatement({ actions: ['ecs:UpdateService', 'ecs:DescribeServices'], resources: [server.service.serviceArn] }));
    new CfnOutput(this, 'DeployRoleArn', { value: role.roleArn });
  }
}

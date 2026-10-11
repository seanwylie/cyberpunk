import { Stack, StackProps, RemovalPolicy, Duration, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as r53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { WvConfig, clientHost } from './config';

/** Static client: private S3 bucket + CloudFront (OAC). Lives in us-east-1 because CloudFront certificates must be there. */
export class ClientStack extends Stack {
  readonly bucket: s3.Bucket; readonly distribution: cf.Distribution; readonly url: string;
  constructor(scope: Construct, id: string, cfg: WvConfig, props?: StackProps) {
    super(scope, id, props);
    this.bucket = new s3.Bucket(this, 'ClientBucket', { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED, enforceSSL: true, removalPolicy: RemovalPolicy.RETAIN, versioned: false });
    const host = clientHost(cfg); let cert: acm.ICertificate | undefined; let zone: r53.IHostedZone | undefined;
    if (host && cfg.hostedZoneId && cfg.domainName) {
      zone = r53.HostedZone.fromHostedZoneAttributes(this, 'Zone', { hostedZoneId: cfg.hostedZoneId, zoneName: cfg.domainName });
      cert = new acm.Certificate(this, 'ClientCert', { domainName: host, validation: acm.CertificateValidation.fromDns(zone) });
    }
    // Caching rules (compatible with src/mobile.ts + public/sw.js):
    //  - assets/*  : Vite content-hashed files -> immutable, 1 year (uploaded with Cache-Control: public,max-age=31536000,immutable)
    //  - everything else (index.html, sw.js, manifest, sprites/audio/art): honour the origin's Cache-Control (no-cache for html/sw.js/manifest,
    //    max-age=3600 for art). The service worker is registered as sw.js?v=<build>, so a new build gets a new cache name; sw.js itself must never be cached.
    const respectOrigin = new cf.CachePolicy(this, 'RespectOrigin', { cachePolicyName: `${id}-respect-origin`, minTtl: Duration.seconds(0), defaultTtl: Duration.seconds(0), maxTtl: Duration.days(365), queryStringBehavior: cf.CacheQueryStringBehavior.all(), headerBehavior: cf.CacheHeaderBehavior.none(), cookieBehavior: cf.CacheCookieBehavior.none(), enableAcceptEncodingGzip: true, enableAcceptEncodingBrotli: true });
    const origin = origins.S3BucketOrigin.withOriginAccessControl(this.bucket);
    const headers = new cf.ResponseHeadersPolicy(this, 'Security', { securityHeadersBehavior: { contentTypeOptions: { override: true }, frameOptions: { frameOption: cf.HeadersFrameOption.DENY, override: true }, referrerPolicy: { referrerPolicy: cf.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN, override: true }, strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: true, override: true } } });
    this.distribution = new cf.Distribution(this, 'Cdn', {
      comment: 'Warranty Void client', defaultRootObject: 'index.html', httpVersion: cf.HttpVersion.HTTP2_AND_3, priceClass: cf.PriceClass.PRICE_CLASS_100,
      domainNames: host && cert ? [host] : undefined, certificate: cert, minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: { origin, viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: respectOrigin, compress: true, responseHeadersPolicy: headers },
      additionalBehaviors: { 'assets/*': { origin, viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED, compress: true, responseHeadersPolicy: headers } },
      errorResponses: [{ httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/index.html', ttl: Duration.seconds(10) }],
    });
    if (zone && host) { new r53.ARecord(this, 'Alias', { zone, recordName: host, target: r53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)) }); new r53.AaaaRecord(this, 'AliasV6', { zone, recordName: host, target: r53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)) }); }
    this.url = host && cert ? `https://${host}` : `https://${this.distribution.distributionDomainName}`;
    new CfnOutput(this, 'BucketName', { value: this.bucket.bucketName }); new CfnOutput(this, 'DistributionId', { value: this.distribution.distributionId }); new CfnOutput(this, 'ClientUrl', { value: this.url });
  }
}

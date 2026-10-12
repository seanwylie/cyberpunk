#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { readConfig } from '../lib/config';
import { buildApp } from '../lib/app';
const app = new App(); const cfg = readConfig(app);
// Safety net: the live account's stacks were deployed with a domain. Synthesising without one would strip the alias/certificate from the live CloudFront
// distribution (and make WvStory depend on WvClient). The live values come from infra/cdk.context.json; override with -c, or -c allowNoDomain=true to bypass on purpose.
if (cfg.account === '382598155084' && !cfg.domainName && String(app.node.tryGetContext('allowNoDomain')) !== 'true') {
  throw new Error('Refusing to synth for account 382598155084 without domainName: infra/cdk.context.json is missing or was overridden. Run from the infra/ directory, or pass -c domainName=seanwylie.ca -c hostedZoneId=... (or -c allowNoDomain=true to override).');
}
buildApp(app, cfg);

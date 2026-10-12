import { App } from 'aws-cdk-lib';
import { WvConfig } from './config';
import { ClientStack } from './client-stack';
import { ServerStack } from './server-stack';
import { StoryStack } from './story-stack';
import { BillingStack } from './billing-stack';
import { CiStack } from './ci-stack';
import { CityStack } from './city-stack';
/** Stack graph. Client is pinned to us-east-1 (CloudFront certs); server/story use cfg.region. Order: client -> server -> story (+ billing, optional CI). */
export function buildApp(app: App, cfg: WvConfig) {
  const env = (region: string) => ({ account: cfg.account, region });
  const client = new ClientStack(app, 'WvClient', cfg, { env: env('us-east-1'), crossRegionReferences: true });
  const city = new CityStack(app, 'WvCity', cfg, { env: env(cfg.region) }); // living city table + weekly news Lambda (docs/LIVING_CITY.md)
  const server = new ServerStack(app, 'WvServer', cfg, client.url, { env: env(cfg.region), crossRegionReferences: true }, { cityTable: city.table });
  const story = new StoryStack(app, 'WvStory', cfg, client.url, { env: env(cfg.region), crossRegionReferences: true });
  const billing = new BillingStack(app, 'WvBilling', cfg, { env: env('us-east-1') });
  const ci = cfg.createOidcRole ? new CiStack(app, 'WvCi', cfg, client, server, { env: env(cfg.region), crossRegionReferences: true }) : undefined;
  return { client, server, story, billing, ci, city };
}

# Deploying Warranty Void to AWS: runbook

Nothing here has been deployed and no AWS credentials were used to prepare it. Estimated time: 45-60 minutes the first time. Architecture, cost and scaling: `docs/MULTIPLAYER.md` section 8.

## 0. What Sean must provide
1. **AWS account id** and a **region** for the game server (default `us-east-1`; the static client stack is always in `us-east-1` because of CloudFront certificates).
2. **A domain you control in Route 53**: the domain name (e.g. `example.com`) and its **hosted zone id** (Route 53 console, looks like `Z0123456789ABC`). The stack creates `play.example.com` (client) and `game.example.com` (wss) and validates the ACM certificates through that zone. Without a domain the stack still deploys, but the server is plain `ws://` on the ALB name, which browsers block from an https page (smoke tests only).
3. **An IAM role for GitHub OIDC** that GitHub Actions can assume (its ARN goes in the repo variable `AWS_ROLE_ARN`). Either create your own, or let CDK create the provider + a least-privilege role (`-c createOidcRole=true`, stack `WvCi`, restricted to `repo:seanwylie/cyberpunk:ref:refs/heads/main`). The role needs: S3 read/write on the client bucket, `cloudfront:CreateInvalidation`, ECR push/pull for `wv-hub`, `ecs:UpdateService/DescribeServices` on the service (the CDK role has exactly these).
4. **An alert email** address (alarms + budget) and a **monthly budget** in USD (default 30).
5. **The OpenAI API key**, entered by you directly into Secrets Manager (step 4); never commit it or paste it into chat or CI.

## 1. One-time local setup
```
cd infra && npm i
# AWS credentials for YOU (SSO or an admin profile), only needed for bootstrap/deploy, not for synth
export AWS_PROFILE=<your-profile>
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1 aws://<ACCOUNT_ID>/<REGION>      # once per account/region (skip the 2nd if same region)
```

## 2. Check what will be created (no AWS calls, no account needed)
```
cd infra
npx cdk synth -q -c domainName=example.com -c hostedZoneId=Z0123456789ABC       # builds templates into infra/cdk.out
npm test                                                                          # 10 assertion tests on the templates
```
(`CDK_DEFAULT_ACCOUNT` must be unset for credential-free synth; with a real account CDK looks up availability zones once.)

## 3. Deploy the stacks (this creates billable resources)
```
cd infra
npx cdk deploy WvClient WvServer WvStory WvBilling \
  -c domainName=example.com -c hostedZoneId=Z0123456789ABC \
  -c alertEmail=you@example.com -c monthlyBudgetUsd=40 \
  -c createOidcRole=true            # optional, adds WvCi with the GitHub deploy role
```
Parameters (`-c key=value`, or `infra/cdk.context.json`): `region`, `domainName`, `hostedZoneId`, `clientSubdomain` (play), `serverSubdomain` (game), `alertEmail`, `monthlyBudgetUsd`, `minTasks`/`maxTasks` (1/1, see scaling notes), `taskCpu`/`taskMemMiB` (256/512), `maxRooms` (100), `maxParties` (500), `maxConns` (500), `storyInService` (false), `githubRepo`, `createOidcRole`, `azs`.
Outputs to note: `BucketName`, `DistributionId`, `ClientUrl`, `WsUrl`, `EcrRepoUri`, `ClusterName`, `ServiceName`, `StoryUrl`, `DeployRoleArn`. Confirm the SNS and Budgets subscription emails.
The ECS service starts with no image (the `wv-hub:latest` tag does not exist yet), so its first tasks fail until step 5: that is expected.

## 4. Put the OpenAI key in Secrets Manager (you, from your terminal)
```
aws secretsmanager put-secret-value --secret-id wv/openai-api-key --secret-string 'sk-...'
```
(CDK creates the secret with a random placeholder; the story Lambda ignores values starting with `PLACEHOLDER` and any invalid key just makes stories fall back to authored text.) If you use `-c storyInService=true`, set `wv/openai-api-key-service` the same way.

## 5. First image + client deploy
Easiest: let GitHub do it. First copy the template into place and commit it yourself: `mkdir -p .github/workflows && cp infra/ci/deploy.yml.template .github/workflows/deploy.yml` (it is shipped as a template because the automation token used to push this repo has no `workflow` scope). Then repo Settings > Secrets and variables > Actions > **Variables**:
`AWS_DEPLOY_ENABLED=true`, `AWS_REGION`, `AWS_ROLE_ARN`, `WV_SERVER_URL` (the `WsUrl` output, e.g. `wss://game.example.com`), `WV_STORY_URL` (the `StoryUrl` output), `S3_BUCKET`, `CLOUDFRONT_ID`, `ECR_REPO` (`wv-hub`), `ECS_CLUSTER`, `ECS_SERVICE`. Then run **Actions > deploy-aws > Run workflow** (afterwards it runs on every push to `main`). It builds the client with `VITE_WV_SERVER`, syncs to S3 with the cache headers, invalidates CloudFront, builds the arm64 image, pushes to ECR and forces a new ECS deployment.
Manual alternative: `docker build -f server/Dockerfile -t <EcrRepoUri>:latest .`, `aws ecr get-login-password | docker login ...`, `docker push`, `aws ecs update-service --force-new-deployment`; and `VITE_WV_SERVER=wss://game.example.com npm run build` + `aws s3 sync` (see the workflow for the cache-control flags).

## 6. Verify
- `curl https://game.example.com/healthz` -> `{"ok":true,...}`; `curl .../metrics`.
- Open `https://play.example.com/`; the Party button is visible because a server URL is baked in. Create a party, join from a second device with the invite link, enter a dungeon.
- CloudWatch: log group from `LogGroupName`; alarm `NoHealthy` should be OK.
- Page headers: `sw.js` and `index.html` `Cache-Control: no-cache`; `assets/*` `immutable`.

## 7. Local run (no AWS)
```
docker compose up --build            # hub on ws://localhost:8787 (origin allow-list: localhost:5173)
npm run dev                          # client; open http://localhost:5173/?server=ws://localhost:8787
```
Or without Docker: `npm run server`. Env vars: see `server/main.ts` header and `docker-compose.yml`.

## 8. Operations
- **Roll back:** the ECS circuit breaker auto-rolls back failed deploys; to pin a version, deploy with `-c imageTag=<git sha>`.
- **Restart/drain:** ECS sends SIGTERM; the hub drains (parties are told, instances end) within `WV_GRACE_MS` (20 s in AWS).
- **Scale:** do not raise `maxTasks` above 1 before the room-ownership layer exists (parties live in memory).
- **Tear down:** `npx cdk destroy --all` (the S3 bucket and ECR repo are RETAINed on purpose; delete them manually).
- **Cost control:** the Budgets email, plus `aws ecs update-service --desired-count 0` to stop the server while idle (the ALB still bills).

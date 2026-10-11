import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { WvConfig } from './config';
/** Monthly cost budget with email alerts at 50/80/100% actual and 100% forecast. (Budgets work in any region and need no billing-alarm opt-in.) */
export class BillingStack extends Stack {
  constructor(scope: Construct, id: string, cfg: WvConfig, props?: StackProps) {
    super(scope, id, props);
    const subs = cfg.alertEmail ? [{ subscriptionType: 'EMAIL', address: cfg.alertEmail }] : [];
    const n = (t: number, type: string) => ({ notification: { notificationType: type, comparisonOperator: 'GREATER_THAN', threshold: t, thresholdType: 'PERCENTAGE' }, subscribers: subs });
    new budgets.CfnBudget(this, 'Monthly', { budget: { budgetType: 'COST', timeUnit: 'MONTHLY', budgetLimit: { amount: cfg.monthlyBudgetUsd, unit: 'USD' }, budgetName: 'warranty-void-monthly' }, notificationsWithSubscribers: subs.length ? [n(50, 'ACTUAL'), n(80, 'ACTUAL'), n(100, 'ACTUAL'), n(100, 'FORECASTED')] : [] });
  }
}

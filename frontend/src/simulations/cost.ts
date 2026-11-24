/**
 * Cost Management budgets and Azure Advisor cost recommendations (simplified model).
 * https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-acm-create-budgets
 * https://learn.microsoft.com/azure/advisor/advisor-cost-recommendations
 *
 * Modelled behaviour:
 *  - A budget has an amount, a reset period and alert conditions on Actual or Forecasted cost
 *    as a percentage of the amount. Alerts notify email recipients and, at subscription and
 *    resource-group scope, can trigger action groups.
 *  - A budget never stops or deletes resources by itself. Spending is only reduced if an
 *    action group runs automation (for example a runbook that deallocates VMs).
 *  - Cost data is not real time, so alerts arrive after the spend happened. The model uses a
 *    1-day data delay.
 *  - Advisor flags VMs with low average CPU over the lookback period. The CPU threshold
 *    (5, 10, 15, 20 or 100 %) and lookback period are configurable.
 * Simplifications: the forecast is a linear projection of month-to-date spend (the real forecast
 * uses machine-learning models). Advisor also weighs network usage and P95 CPU, which is ignored here.
 */

export interface AlertCondition {
  id: string
  type: 'Actual' | 'Forecasted'
  percent: number
}

export interface BudgetInput {
  amount: number
  days: number
  dailySpend: number[]
  conditions: AlertCondition[]
  dataDelayDays: number
  /** When set, the action group's runbook cuts daily spend to this fraction after that alert fires. */
  automation?: { conditionId: string; reduceTo: number }
}

export interface BudgetDay {
  day: number
  spend: number
  cumulative: number
  forecast: number
  alerts: string[]
}

export function simulateBudget(input: BudgetInput): { days: BudgetDay[]; fired: Array<{ conditionId: string; day: number; observedOn: number }>; overBudget: boolean; total: number } {
  const days: BudgetDay[] = []
  const fired: Array<{ conditionId: string; day: number; observedOn: number }> = []
  let cumulative = 0
  let reduction = 1
  let automationAt: number | null = null
  for (let d = 1; d <= input.days; d++) {
    if (automationAt !== null && d > automationAt) reduction = input.automation!.reduceTo
    const spend = (input.dailySpend[d - 1] ?? input.dailySpend.at(-1) ?? 0) * reduction
    cumulative += spend
    const forecast = (cumulative / d) * input.days
    const alerts: string[] = []
    // Data for day d is visible only after the delay.
    const visibleDay = d - input.dataDelayDays
    if (visibleDay >= 1) {
      const seen = days[visibleDay - 1] ?? { cumulative, forecast }
      for (const c of input.conditions) {
        if (fired.some((f) => f.conditionId === c.id)) continue
        const value = c.type === 'Actual' ? seen.cumulative : seen.forecast
        if (value >= (c.percent / 100) * input.amount) {
          fired.push({ conditionId: c.id, day: visibleDay, observedOn: d })
          alerts.push(c.id)
          if (input.automation?.conditionId === c.id && automationAt === null) automationAt = d
        }
      }
    }
    days.push({ day: d, spend, cumulative, forecast, alerts })
  }
  return { days, fired, overBudget: cumulative > input.amount, total: cumulative }
}

export interface VmUsage {
  name: string
  size: string
  avgCpu: number
  monthlyCost: number
}

export const ADVISOR_CPU_THRESHOLDS = [5, 10, 15, 20, 100] as const
export const ADVISOR_LOOKBACK_DAYS = [7, 14, 21, 30, 60, 90] as const

export function advisorCostRecommendations(vms: VmUsage[], cpuThreshold: number) {
  return vms
    .filter((v) => v.avgCpu < cpuThreshold)
    .map((v) => ({
      vm: v.name,
      recommendation: v.avgCpu < 3 ? 'Shut down or deallocate the underutilized VM' : 'Right-size to a smaller SKU',
      reason: `Average CPU ${v.avgCpu}% is below the ${cpuThreshold}% threshold over the lookback period.`,
      // Illustrative saving: shutting down saves the compute cost; right-sizing roughly halves it.
      estimatedMonthlySaving: Math.round(v.avgCpu < 3 ? v.monthlyCost : v.monthlyCost / 2),
    }))
}

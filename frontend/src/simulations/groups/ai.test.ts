import { describe, expect, it } from 'vitest'
import { approxTokens, cuRun, foundryEndpointValid, groups, nextTokenDistribution, recommendDeployment, simulateInference } from './ai'

const sc = (g: string, s: string) => groups.find((x) => x.id === g)!.scenarios.find((x) => x.id === s)!

describe('AI-901 models', () => {
  it('approximates tokens at ~4 characters', () => {
    expect(approxTokens('What is the capital of France?')).toBe(8)
  })
  it('lower temperature sharpens the distribution; top_p trims the tail', () => {
    const logits = { a: 3, b: 2, c: 1 }
    const hot = nextTokenDistribution(logits, 1.5, 1)
    const cold = nextTokenDistribution(logits, 0.2, 1)
    expect(cold[0]!.p).toBeGreaterThan(hot[0]!.p)
    expect(nextTokenDistribution(logits, 1, 0.5).filter((x) => x.kept)).toHaveLength(1)
  })
  it('max_output_tokens truncates and filters block harmful prompts', () => {
    const base = { systemPrompt: '', userPrompt: 'x', contextWindow: 1000, maxOutputTokens: 100, desiredAnswerTokens: 500, temperature: 1, topP: 1, harmful: false, contentFilter: true }
    expect(simulateInference(base).finish).toMatch(/length/)
    expect(simulateInference({ ...base, harmful: true }).finish).toBe('content_filter')
    expect(simulateInference({ ...base, maxOutputTokens: 2000 }).fits).toBe(false)
  })
  it('recommends deployment types', () => {
    expect(recommendDeployment({ dataResidency: 'none', predictableHighThroughput: false, asyncBulk: false })).toBe('Global Standard')
    expect(recommendDeployment({ dataResidency: 'data zone', predictableHighThroughput: false, asyncBulk: false })).toBe('Data Zone Standard')
    expect(recommendDeployment({ dataResidency: 'none', predictableHighThroughput: true, asyncBulk: false })).toBe('Global Provisioned')
    expect(recommendDeployment({ dataResidency: 'none', predictableHighThroughput: false, asyncBulk: true })).toBe('Global Batch')
  })
  it('validates Foundry project endpoints', () => {
    expect(foundryEndpointValid('https://contoso-ai.services.ai.azure.com/api/projects/support')).toBe(true)
    expect(foundryEndpointValid('https://contoso-ai.openai.azure.com/')).toBe(false)
  })
  it('Content Understanding: analyzer must match input; Extract is documents-only', () => {
    expect(cuRun({ input: 'document', analyzer: 'prebuilt-videoSearch', method: 'Extract', hasKey: true, apiVersion: '2025-11-01' }).inputOk).toBe(false)
    expect(cuRun({ input: 'audio', analyzer: 'custom analyzer (field schema)', method: 'Extract', hasKey: true, apiVersion: '2025-11-01' }).methodOk).toBe(false)
    expect(cuRun({ input: 'audio', analyzer: 'custom analyzer (field schema)', method: 'Generate', hasKey: true, apiVersion: '2025-11-01' }).methodOk).toBe(true)
  })
  it('agents need the right tool', () => {
    const s = sc('ai901-agent-sim', 'ai-agent')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    expect(s.evaluate({ ...s.initial, fileSearch: true }).outcome.ok).toBe(true)
  })
  it('text pipeline grades the technique against the need and shows its output', () => {
    const s = sc('ai901-text-sim', 'text-pipeline')
    expect(s.evaluate(s.initial).outcome.ok).toBe(false)
    const r = s.evaluate({ ...s.initial, tech: 'PII detection and redaction' })
    expect(r.outcome.ok).toBe(true)
    expect(r.stages[2]!.detail).not.toContain('555-0142')
    expect(s.evaluate({ sample: 'Spanish report', need: 'Which language it is written in', tech: 'Language detection' }).stages[2]!.detail).toContain('Spanish')
  })
  it('every AI-901 lesson group has at least two scenarios', () => {
    for (const grp of groups) expect(grp.scenarios.length, grp.id).toBeGreaterThanOrEqual(2)
  })
})

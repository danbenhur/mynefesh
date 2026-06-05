// Anthropic model pricing constants
// Source: https://docs.anthropic.com/en/docs/about-claude/models#model-comparison-table
// Last verified: 2026-06-05
// claude-sonnet-4-6: $3.00/MTok input · $15.00/MTok output

const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000

export function calculateClaudeCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN
}

export type Scenario = 'nominal' | 'anomaly' | 'command';

export function syntheticSignal(scenario: Scenario) {
  return Array.from({ length: 120 }, (_, i) => {
    const base = .49 + Math.sin(i * .26) * .024 + Math.sin(i * 1.4) * .007;
    if (scenario === 'anomaly' && i > 68) return base + .22 + Math.sin(i * .77) * .032;
    if (scenario === 'command' && i > 68 && i < 92) return base + .18;
    return base;
  });
}

export function scriptedReview(scenario: Scenario, context: boolean) {
  const nominal = scenario === 'nominal' || (scenario === 'command' && context);
  return {
    nominal,
    status: nominal ? 'ILLUSTRATIVE / NOMINAL' : 'ILLUSTRATIVE / REVIEW NEEDED',
    title: scenario === 'nominal' ? 'Steady signal. Stable pattern.' : scenario === 'command' && context ? 'A change with useful context.' : 'A deviation worth a closer look.',
    copy: scenario === 'nominal' ? 'The signal stays within a narrow range across both intervals. No sustained level shift appears in this example.' : scenario === 'command' && context ? 'A command precedes the temporary step, and the signal returns to its earlier range. This example illustrates useful context, not proof of causation.' : scenario === 'command' ? 'A temporary level shift appears in the review interval. Without command history, the available observations leave the operational context unclear.' : 'A sustained level shift and increased variation appear in the review interval. The available command context does not account for the change in this example.',
  };
}

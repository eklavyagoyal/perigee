'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Arrow } from './brand';
import { scriptedReview, syntheticSignal, type Scenario } from '@/lib/demo';

export function DemoConsole() {
  const [scenario, setScenario] = useState<Scenario>('nominal');
  const [context, setContext] = useState(true);
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gradientId = useId();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function reset() { if (timer.current) clearTimeout(timer.current); setState('idle'); }
  function review() { setState('pending'); timer.current = setTimeout(() => setState('done'), 800); }
  const result = scriptedReview(scenario, context);
  const points = syntheticSignal(scenario).map((value, i) => `${42 + i * 5.87},${222 - value * 230}`).join(' ');
  return <div className="control-console">
    <div className="console-top"><span><i className="status-dot" /> MISSION CONTROL <b>/</b> PRG—01</span><span className="demo-pill">INTERACTIVE CONCEPT</span></div>
    <div className="console-body"><div className="telemetry-panel">
      <div className="panel-top"><div><span className="mono muted">SYNTHETIC TELEMETRY / DEMO CHANNEL</span><h3>Every signal tells a story.</h3></div><span className="mono muted">12 H WINDOW</span></div>
      <div className="scenario-tabs" role="group" aria-label="Illustrative telemetry scenario">{([['nominal', 'Nominal orbit'], ['anomaly', 'Unexpected anomaly'], ['command', 'Commanded event']] as const).map(([value, label]) => <button key={value} aria-pressed={scenario === value} onClick={() => { reset(); setScenario(value); }}>{label}</button>)}</div>
      <div className="chart-wrap"><svg viewBox="0 0 760 250" role="img" aria-label={`Illustrative ${scenario} telemetry over twelve hours`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e1bb83" stopOpacity=".16" /><stop offset="1" stopColor="#e1bb83" stopOpacity="0" /></linearGradient></defs>
        <rect x="393" y="15" width="352" height="204" fill="#22282d" /><text x="407" y="31" className="chart-label">REVIEW INTERVAL</text>
        {[.2, .4, .6, .8].map(n => <g key={n}><line x1="42" y1={222 - n * 230} x2="745" y2={222 - n * 230} stroke="#2d3439" strokeWidth=".7" /><text x="4" y={226 - n * 230} className="chart-label">{n.toFixed(1)}</text></g>)}
        <path d={`M42 222 L${points.replaceAll(' ', ' L')} L741 222Z`} fill={`url(#${gradientId})`} /><polyline points={points} fill="none" stroke="#e2bd8d" strokeWidth="1.6" strokeLinejoin="round" />
        {scenario === 'command' && context && <g><line x1="442" y1="16" x2="442" y2="220" stroke="#8baea9" strokeDasharray="3 4" /><circle cx="442" cy="18" r="4" fill="#8baea9" /><text x="451" y="54" className="chart-label">TC—38</text></g>}
        {['−12 h', '−9 h', '−6 h', '−3 h', 'NOW'].map((text, i) => <text key={text} x={42 + i * 174} y="245" className="chart-label">{text}</text>)}
      </svg></div><div className="chart-legend"><span><i className="legend-line" /> TELEMETRY</span><span><i className="legend-area" /> REVIEW INTERVAL</span>{scenario === 'command' && context && <span><i className="legend-command" /> COMMAND RECEIVED</span>}</div>
    </div><div className="insight-panel" aria-busy={state === 'pending'}><div className="insight-heading"><span className="mono">SIGNAL REVIEW</span><span className="insight-symbol">✳</span></div><div aria-live="polite" aria-atomic="true"><span id="insight-status" className={`insight-status ${state === 'done' ? result.nominal ? 'good' : 'warning' : ''}`}>{state === 'done' ? result.status : state === 'pending' ? 'REVIEW IN PROGRESS' : 'AWAITING REVIEW'}</span><h3 id="insight-title">{state === 'done' ? result.title : 'Context changes the picture.'}</h3><p>{state === 'done' ? result.copy : 'Choose a scenario and review the signal to explore how telemetry and command context fit together.'}</p></div><div className="context-switch"><span>Include command context</span><button className={`switch ${context ? 'on' : ''}`} role="switch" aria-checked={context} aria-label="Include command context" onClick={() => { reset(); setContext(!context); }}><span /></button></div><button className="button button-dark" disabled={state === 'pending'} onClick={review}>{state === 'pending' ? 'Reviewing the signal…' : state === 'done' ? 'Review again' : 'Review this signal'}<Arrow /></button><span className="insight-disclaimer">Simulated telemetry and scripted explanations.<br />No live model or spacecraft connection.</span></div></div>
    <div className="console-bottom"><span><i className="small-cross">+</i> OBSERVATION → CONTEXT → UNDERSTANDING</span><span>ESA-INSPIRED RESEARCH PROTOTYPE</span></div>
  </div>;
}

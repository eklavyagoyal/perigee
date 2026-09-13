import type { Metadata } from 'next';
import { MissionControlReplay } from '@/components/mission-control-replay';
import type { ReplayBundle } from '@/lib/mission-control-replay';
import replay from '../../../public/mission-control/replay.json';
import './mission-control.css';

export const metadata: Metadata = { title: 'Mission Control — Perigee telemetry pipeline', description: 'Explore recorded ESA telemetry through the OpenTSLM pipeline, from TimeNet signal to saved model decision.', robots: { index: false, follow: false } };

export default function MissionControlPage() {
  return <MissionControlReplay bundle={replay as ReplayBundle} />;
}

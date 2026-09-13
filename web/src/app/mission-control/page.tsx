import type { Metadata } from 'next';
import { DemoWorkspace } from '@/components/demo-workspace';

export const metadata: Metadata = { title: 'Demo workspace — layout preview', robots: { index: false, follow: false } };

export default function MissionControlPage() {
  return <DemoWorkspace />;
}

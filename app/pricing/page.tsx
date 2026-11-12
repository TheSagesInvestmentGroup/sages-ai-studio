import PlanGrid from '@/components/PlanGrid';
import { getUser, membership } from '@/lib/auth';
import { cfg, isDemo } from '@/lib/config';
import { COST } from '@/lib/plans';

export const metadata = { title: 'Membership' };
export const dynamic = 'force-dynamic';

export default async function Pricing() {
  const user = await getUser().catch(() => null), m = membership(user);
  return (
    <main className="wrap section stack-lg">
      <div className="stack" style={{ maxWidth: 680 }}><span className="eyebrow">Membership</span><h1>Choose your studio</h1><p className="muted">Every membership includes the AI Creative Director, storyboards, conversational editing and sharing. Higher tiers add longer productions and professional controls.</p></div>
      <PlanGrid signedIn={!!user} current={m.plan?.id} demo={isDemo && !cfg.stripeKey} />
      <div className="panel stack"><h3>How credits work</h3><p className="muted">Credits pay for rendering, so the price you see reflects real production cost. Rendered video costs {COST.videoPerSecond} credits per second and narration {COST.voicePerScene} credits per scene. You see the cost before anything renders, you only pay for scenes that change, and failed renders are refunded automatically. Planning, treatments, storyboards and edits are free.</p></div>
    </main>
  );
}

import { ok, fail, withUser, clean } from '@/lib/http';
import { db, now, audit } from '@/lib/store';
import { isOwner, addCredits, activateTier } from '@/lib/auth';
import { cfg, providerStatus } from '@/lib/config';
import { PLANS, planOf } from '@/lib/plans';
import { stripe } from '@/lib/billing';
import { sendEmail, videoSubmit, fallbackModel, taskCancel } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export const GET = (req: Request) => withUser(req, async user => {
  if (!isOwner(user)) return fail(404, 'Not found.');
  const [profiles, projects, tickets, ledger, log] = await Promise.all([db.list('profiles', {}, { order: 'created_at', limit: 500 }), db.list('projects', {}, { order: 'updated_at', limit: 500 }), db.list('tickets', {}, { order: 'updated_at', limit: 100 }), db.list('credit_ledger', {}, { order: 'created_at', limit: 1000 }), db.list('audit_log', {}, { order: 'created_at', limit: 40 })]);
  const active = profiles.filter(p => p.status === 'active' && p.tier);
  const scenes = projects.flatMap(p => (p.plan?.scenes || []).map((s: any) => ({ ...s, project: p.title, project_id: p.id })));
  return ok({
    stats: {
      members: profiles.length, paying: active.length, monthly_revenue: active.reduce((a, p) => a + (planOf(p.tier)?.price || 0), 0),
      by_tier: PLANS.map(pl => ({ name: pl.name, count: active.filter(p => p.tier === pl.id).length })),
      projects: projects.length, rendering: scenes.filter(s => s.status === 'rendering').length, failed: scenes.filter(s => s.status === 'failed').length,
      credits_spent: -ledger.filter(l => l.amount < 0).reduce((a, l) => a + l.amount, 0), credits_refunded: ledger.filter(l => /^Refund/.test(l.reason)).reduce((a, l) => a + l.amount, 0),
      escalated: tickets.filter(t => t.status === 'escalated').length,
    },
    members: profiles.map(p => ({ id: p.id, email: p.email, name: p.name, tier: p.tier, status: p.status, credits: p.credits, videos_used: p.videos_used, period_end: p.period_end, created_at: p.created_at, billing: !!p.stripe_customer_id })),
    failed: scenes.filter(s => s.status === 'failed').slice(0, 30).map(s => ({ project: s.project, n: s.n, error: s.error })),
    tickets, providers: providerStatus(), log,
  });
});

export const POST = (req: Request) => withUser(req, async (user, b) => {
  if (!isOwner(user)) return fail(404, 'Not found.');
  const target = b.userId ? await db.get('profiles', String(b.userId)) : null;
  switch (b.op) {
    case 'grant': { if (!target) return fail(404, 'Member not found.'); const n = Math.max(-100000, Math.min(100000, Math.round(+b.credits || 0))); await addCredits(target.id, n, 'Adjusted by the studio owner'); break; }
    case 'setTier': { if (!target) return fail(404, 'Member not found.'); if (b.tier && planOf(b.tier)) await activateTier(target.id, b.tier); else await db.update('profiles', target.id, { tier: null, status: 'canceled', credits: 0 }); break; }
    case 'refund': { // refund the member's most recent payment in full
      if (!target?.stripe_customer_id || !cfg.stripeKey) return fail(400, 'This member has no Stripe payment to refund.');
      const charges = await stripe().charges.list({ customer: target.stripe_customer_id, limit: 1 });
      const charge = charges.data[0]; if (!charge || charge.refunded) return fail(400, 'There is no unrefunded payment for this member.');
      await stripe().refunds.create({ charge: charge.id });
      if (b.cancel && target.stripe_subscription_id) await stripe().subscriptions.cancel(target.stripe_subscription_id);
      await audit(user.id, 'admin.refund', { member: target.id, charge: charge.id, amount: charge.amount });
      return ok({ refunded: charge.amount / 100 });
    }
    case 'probeBackup': { // owner check: does the backup video model accept a request? The test clip is cancelled at once.
      const m = fallbackModel(); if (!m) return fail(400, 'No backup model is set.');
      const r = await videoSubmit('A calm sunrise over a quiet sea, slow camera move.', '16:9', 3, m);
      if (r.id) await taskCancel(r.id);
      return ok({ model: m, accepted: !!r.id, error: r.error });
    }
    case 'reply': {
      const t = await db.get('tickets', String(b.ticketId)); if (!t) return fail(404, 'Ticket not found.');
      const text = clean(b.text, 2000);
      const messages = text ? [...t.messages, { role: 'owner', text, at: now() }] : t.messages;
      await db.update('tickets', t.id, { messages, status: b.close ? 'closed' : 'open', updated_at: now() });
      if (text) await sendEmail(t.email, 'A reply from The Sages AI Studio', `${text}\n\nView the conversation: ${cfg.siteUrl}/studio/support`);
      break;
    }
    default: return fail(400, 'Unknown action.');
  }
  await audit(user.id, `admin.${b.op}`, { member: target?.id });
  return ok();
}, { limit: 30 });

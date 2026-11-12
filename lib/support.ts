// First-line support agent. Answers common questions from a fixed knowledge
// base and escalates anything about money, access or safety to the owner.
import { llmText, sendEmail } from './providers';
import { cfg } from './config';
import { PLANS } from './plans';

const KB: [RegExp, string][] = [
  [/cancel/i, 'You can cancel at any time from Billing → Manage billing. Your membership stays active until the end of the month you have paid for, then access ends.'],
  [/(change|update).*(card|payment|bank)|payment method/i, 'Open Billing → Manage billing to change your card or bank account. Changes apply to your next monthly payment.'],
  [/credit/i, 'Credits pay for rendering. Each scene shows its cost before you render, and you are only charged for scenes that need a new render. Failed renders are refunded automatically. Your allowance resets each paid month.'],
  [/(upgrade|downgrade|change).*(plan|tier|membership)/i, `Open Billing and choose a different membership. Plans are ${PLANS.map(p => `${p.name} $${p.price}`).join(', ')} per month.`],
  [/(how long|length|duration|minutes)/i, 'Scenes run 2 to 10 seconds each. Creator productions run up to 60 seconds; Professional and above up to 3 minutes.'],
  [/(download|export)/i, 'Open a project and use Export. You can download each rendered scene as MP4, or record the full preview as a video file from your browser.'],
  [/(voice|clone|avatar|likeness)/i, 'Voice and likeness features need the recorded consent of the person. You can always choose a standard narrator instead. We never clone a third party without permission.'],
  [/(upload|file type|format)/i, 'You can upload MP4, MOV, WEBM, MP3, WAV, AAC, PNG, JPG, WEBP, PDF, DOCX, TXT and SRT files, and mark each as a reference, content to include, content to transform, or a reusable asset.'],
  [/(delete|privacy|my data)/i, 'You can delete any project, character or file yourself and it is removed from storage. To delete your whole account, ask here and the owner will confirm it by email.'],
  [/(share|social|publish)/i, 'Turn on Share in a project to get a private link, then post it to X, Instagram, Facebook, Threads, TikTok, LinkedIn or YouTube from the share panel.'],
];
const MAJOR = /refund|charged twice|double charge|dispute|chargeback|fraud|hacked|stolen|legal|lawyer|copyright claim|takedown|human|owner|manager|can.?t (log ?in|access)|locked out|delete my account/i;

export async function answer(message: string, history: { role: string; text: string }[]) {
  const major = MAJOR.test(message);
  const hit = KB.find(([r]) => r.test(message))?.[1];
  let text = hit || '';
  if (!major) {
    const ai = await llmText(`You are the support agent for The Sages AI Studio, an AI video production membership. Answer briefly and plainly using only these facts:\n${KB.map(k => '- ' + k[1]).join('\n')}\nIf the answer is not covered, say you will pass it to the studio owner. Never promise refunds or make up policies.`, history.slice(-6).map(h => `${h.role}: ${h.text}`).join('\n') + `\nmember: ${message}`);
    if (ai) text = ai;
  }
  return { text, major: major || !text };
}

export async function escalate(member: { email: string; name: string }, ticketId: string, message: string) {
  const sent = await sendEmail(cfg.ownerEmail, `Support escalation from ${member.name}`, `Member: ${member.name} <${member.email}>\nTicket: ${ticketId}\n\n${message}\n\nReply to the member from the control center: ${cfg.siteUrl}/admin`);
  return sent;
}

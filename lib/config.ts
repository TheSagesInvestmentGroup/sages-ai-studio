// Central configuration. Every integration is optional: when its keys are
// missing the feature reports itself as "not connected" instead of faking output.
const env = (k: string) => (process.env[k] || '').trim();

export const cfg = {
  siteUrl: env('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000',
  supabaseUrl: env('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnon: env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseService: env('SUPABASE_SERVICE_ROLE_KEY'),
  stripeKey: env('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: env('STRIPE_WEBHOOK_SECRET'),
  ownerEmail: env('OWNER_EMAIL').toLowerCase(),
  sessionSecret: env('SESSION_SECRET') || 'local-demo-secret-change-me',
  resendKey: env('RESEND_API_KEY'),
  emailFrom: env('EMAIL_FROM') || 'The Sages AI Studio <no-reply@example.com>',
  runwayKey: env('RUNWAY_API_KEY'),
  runwayModel: env('RUNWAY_MODEL') || 'gemini_omni_flash_1.2',
  runwayFallbackModel: env('RUNWAY_FALLBACK_MODEL') || 'gemini_omni_flash_1.1', // same request shape as the main model; set to "none" to switch off
  postizKey: env('POSTIZ_API_KEY'),
  runwayVoiceModel: env('RUNWAY_VOICE_MODEL') || 'eleven_v3',
  runwayVoice: env('RUNWAY_DEFAULT_VOICE') || 'Bernard',
};

/** Local demo mode: no Supabase project configured. Data lives in a local JSON file. */
export const isDemo = !cfg.supabaseUrl;

/** OpenAI-compatible language providers, tried in order (failover). */
export function llmProviders() {
  const list: { name: string; base: string; key: string; model: string }[] = [];
  if (env('DEEPSEEK_API_KEY')) list.push({ name: 'DeepSeek', base: 'https://api.deepseek.com', key: env('DEEPSEEK_API_KEY'), model: env('DEEPSEEK_MODEL') || 'deepseek-chat' });
  if (env('OPENAI_API_KEY') && env('OPENAI_MODEL')) list.push({ name: 'OpenAI', base: 'https://api.openai.com/v1', key: env('OPENAI_API_KEY'), model: env('OPENAI_MODEL') });
  // Any other OpenAI-compatible endpoint (Grok, Qwen, Kimi, GLM, Llama hosts, Perplexity...).
  if (env('LLM_API_KEY') && env('LLM_BASE_URL') && env('LLM_MODEL')) list.push({ name: env('LLM_NAME') || 'Custom LLM', base: env('LLM_BASE_URL'), key: env('LLM_API_KEY'), model: env('LLM_MODEL') });
  return list;
}

export function providerStatus() {
  return [
    { area: 'Creative reasoning and scripts', provider: llmProviders().map(p => p.name).join(' → ') || 'Built-in director', live: llmProviders().length > 0, note: llmProviders().length ? 'Failover in the order shown' : 'Rule-based writer. Add DEEPSEEK_API_KEY for richer writing.' },
    { area: 'Video generation', provider: 'Runway API', live: !!cfg.runwayKey, note: cfg.runwayKey ? `Model ${cfg.runwayModel}${cfg.runwayFallbackModel !== 'none' && cfg.runwayFallbackModel !== cfg.runwayModel ? `, backup ${cfg.runwayFallbackModel}` : ''}` : 'Not connected. Members get storyboard animatics only.' },
    { area: 'Voice narration', provider: 'ElevenLabs voices through the Runway API', live: !!cfg.runwayKey, note: cfg.runwayKey ? `Model ${cfg.runwayVoiceModel}, voice ${cfg.runwayVoice}` : 'Not connected. Previews use the browser voice.' },
    { area: 'Music', provider: 'ElevenLabs music through the Runway API', live: !!cfg.runwayKey, note: cfg.runwayKey ? 'Instrumental soundtrack per production' : 'Not connected.' },
    { area: 'Voice cloning and presenter avatars', provider: 'Runway API', live: !!cfg.runwayKey, note: cfg.runwayKey ? 'Consent recorded for every voice and likeness' : 'Not connected.' },
    { area: 'Payments', provider: 'Stripe', live: !!cfg.stripeKey, note: cfg.stripeKey ? 'Subscriptions, portal, refunds' : 'Not connected.' },
    { area: 'Social publishing', provider: 'Postiz', live: !!cfg.postizKey, note: cfg.postizKey ? 'Owner posts productions to connected channels' : 'Not connected. Add POSTIZ_API_KEY to post from the share panel.' },
    { area: 'Email', provider: 'Resend', live: !!cfg.resendKey, note: cfg.resendKey ? 'Support escalations' : 'Not connected. Escalations wait in the control center.' },
    { area: 'Accounts and data', provider: isDemo ? 'Local demo store' : 'Supabase', live: !isDemo, note: isDemo ? 'Demo mode. Not for real members.' : 'Postgres, Auth, Storage' },
  ];
}

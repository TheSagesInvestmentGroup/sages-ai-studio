import Stripe from 'stripe';
import { cfg } from './config';
import { PLANS } from './plans';

let _s: Stripe | null = null;
export const stripe = () => (_s ||= new Stripe(cfg.stripeKey));
export const priceId = (tier: string) => { const p = PLANS.find(p => p.id === tier); return p ? (process.env[p.priceEnv] || '').trim() : ''; };
export const tierOfPrice = (price?: string | null) => PLANS.find(p => price && (process.env[p.priceEnv] || '').trim() === price)?.id || null;

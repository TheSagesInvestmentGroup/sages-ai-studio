// Membership tiers from the owner's specification. Prices are charged by Stripe;
// the amounts here are for display and must match the Stripe prices.
export type TierId = 'bio' | 'creator' | 'professional' | 'studio' | 'business';

export interface Plan {
  id: TierId; name: string; price: number; videos: number; credits: number;
  maxSeconds: number; blurb: string; benefits: string[];
  bio: { enabled: boolean; maxSeconds: number; scenes: number; attachments: number };
  proStudio: boolean; team: boolean; brand: boolean; priority: boolean;
  priceEnv: string;
}

export const PLANS: Plan[] = [
  { id: 'bio', name: 'Personal Bio', price: 10, videos: 3, credits: 260, maxSeconds: 90,
    blurb: 'Your career story, told on screen.',
    benefits: ['1 professional résumé video', '1 cover letter video', '1 personal bio video', 'Shareable portfolio page with QR code'],
    bio: { enabled: true, maxSeconds: 180, scenes: 45, attachments: 5 }, proStudio: false, team: false, brand: false, priority: false, priceEnv: 'STRIPE_PRICE_BIO' },
  { id: 'creator', name: 'Creator', price: 25, videos: 6, credits: 640, maxSeconds: 120,
    blurb: 'Short clips and the essential creative tools.',
    benefits: ['6 productions a month', 'Productions up to 2 minutes', 'AI Creative Director and three treatments', 'Bio & Résumé Studio: career videos up to 3 minutes, 5 attachments'],
    bio: { enabled: true, maxSeconds: 180, scenes: 45, attachments: 5 }, proStudio: false, team: false, brand: false, priority: false, priceEnv: 'STRIPE_PRICE_CREATOR' },
  { id: 'professional', name: 'Professional', price: 50, videos: 9, credits: 1300, maxSeconds: 180,
    blurb: 'Longer productions and premium editing.',
    benefits: ['9 productions a month', 'Productions up to 3 minutes', 'Professional Studio scene controls', 'Bio & Résumé Studio: career videos up to 5 minutes, 20 attachments'],
    bio: { enabled: true, maxSeconds: 300, scenes: 75, attachments: 20 }, proStudio: true, team: false, brand: false, priority: false, priceEnv: 'STRIPE_PRICE_PROFESSIONAL' },
  { id: 'studio', name: 'Studio', price: 100, videos: 12, credits: 2600, maxSeconds: 180,
    blurb: 'Advanced production tools and higher limits.',
    benefits: ['12 productions a month', 'Everything in Professional', 'Character library across projects', 'Story-to-Series and Director’s Cut'],
    bio: { enabled: true, maxSeconds: 300, scenes: 75, attachments: 20 }, proStudio: true, team: true, brand: false, priority: false, priceEnv: 'STRIPE_PRICE_STUDIO' },
  { id: 'business', name: 'Business', price: 200, videos: 25, credits: 5200, maxSeconds: 180,
    blurb: 'Brand libraries and commercial workflows.',
    benefits: ['25 productions a month', 'Everything in Studio', 'Brand Memory applied to every production', 'Priority rendering queue'],
    bio: { enabled: true, maxSeconds: 300, scenes: 75, attachments: 20 }, proStudio: true, team: true, brand: true, priority: true, priceEnv: 'STRIPE_PRICE_BUSINESS' },
];

export const planOf = (id?: string | null) => PLANS.find(p => p.id === id) || null;

// Credit prices reflect real generation cost drivers: seconds of video and narrated scenes.
// Calibrated 12 Nov 2026 to Runway's gemini_omni_flash_1.2 at 720p ($0.07 per second): a member
// who spends a full allowance costs about 45% of their fee. A dearer model needs smaller allowances.
export const PROVIDER_COST_PER_SECOND_USD = 0.07;
export const COST = { videoPerSecond: 4, voicePerScene: 2 };
// What the provider charges us, in dollars (Runway price list, 13 Nov 2026). tests/ checks every price keeps its margin.
export const PROVIDER = { videoPerSecond: 0.07, backupVideoPerSecond: 0.10, startImage: 0.01, voicePerScene: 0.03 };
/** The least a member ever pays for one credit: the cheapest rate across memberships and packs. */
export const creditFloorUsd = () => Math.min(...PLANS.map(p => p.price / p.credits), ...PACKS.map(p => p.price / p.credits));
export const sceneCost = (seconds: number, voice: boolean) => seconds * COST.videoPerSecond + (voice ? COST.voicePerScene : 0);

// Extra credits a member can buy at any time. They carry over each month while the membership is active.
// Priced a little above the membership rate (5 cents a credit; the provider cost is about 1.8 cents).
export const PACKS = [
  { id: 'p100', credits: 100, price: 5 },
  { id: 'p500', credits: 500, price: 25 },
  { id: 'p1000', credits: 1000, price: 50 },
];
export const packOf = (id?: string | null) => PACKS.find(p => p.id === id) || null;

// Narrator voices offered to members (Runway preset names).
export const VOICES = ['Maya', 'Eleanor', 'Sandra', 'Claudia', 'Mark', 'James', 'Bernard', 'Clint', 'Frank', 'Vincent'];
export const STYLES = ['Cinematic', 'Photorealistic', 'Documentary', 'Animation (3D)', 'Cartoon (2D)', 'Anime', 'Commercial', 'Musical', 'Theatrical', 'Sci-Fi', 'Fantasy', 'Corporate'];
export const DURATIONS = [15, 30, 60, 90, 120, 180];
export const ASPECTS = [
  { id: '16:9', label: 'Widescreen 16:9 (YouTube, web)' },
  { id: '9:16', label: 'Vertical 9:16 (TikTok, Reels, Shorts)' },
  { id: '1:1', label: 'Square 1:1 (feeds)' },
];
export const INTERESTS = ['Action', 'Romance', 'Sci-Fi', 'Spy & Thriller', 'Historical', 'Documentary', 'Educational', 'Business', 'Finance', 'Sports', 'Relationships', 'Spirituality', 'Personal Growth', 'Culture', 'Travel', 'Wellness', 'Musicals & Theatre', 'Commercials', 'Cartoons & Animation', 'Fantasy', 'Comedy', 'Music Videos'];
export const CATEGORIES = ['Movie or short film', 'Cartoon or animation', 'Musical or theatrical play', 'Commercial or advertisement', 'Documentary or educational', 'Sci-fi, fantasy or special effects', 'Social reel', 'Music video', 'Trailer or teaser', 'Product demo', 'Travel, real estate or lifestyle', 'Corporate or training'];

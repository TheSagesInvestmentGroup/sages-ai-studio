import { clean } from './http';
const FIELDS = ['name', 'appearance', 'wardrobe', 'personality', 'voice', 'relationships', 'backstory'] as const;
export const pickCharacter = (b: any) => Object.fromEntries(FIELDS.filter(k => typeof b[k] === 'string').map(k => [k, clean(b[k], k === 'name' ? 60 : 600)]));

export const ASSET_TYPES: Record<string, string[]> = {
  video: ['mp4', 'mov', 'webm'], audio: ['mp3', 'wav', 'aac', 'm4a', 'webm'], image: ['png', 'jpg', 'jpeg', 'webp'],
  document: ['pdf', 'docx', 'txt'], subtitles: ['srt', 'vtt'],
};
export const ASSET_ROLES = ['reference', 'incorporate', 'transform', 'reusable', 'brand', 'credential', 'avatar', 'voice'];
export const kindOf = (name: string) => { const ext = name.split('.').pop()?.toLowerCase() || ''; return Object.entries(ASSET_TYPES).find(([, v]) => v.includes(ext))?.[0] || null; };

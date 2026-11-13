export const metadata = { title: 'Privacy Policy' };

const S: [string, string[]][] = [
  ['1. Who we are', ['The Sages AI Studio is operated by The Sages Investment Group. This policy explains what we collect when you use the studio and what we do with it.']],
  ['2. What we collect', ['Account details: your name, email address and the interests you choose.', 'Your work: the ideas, scripts and settings you enter, the productions you make, and the files you upload.', 'Voice and likeness: a voice recording or photo, only if you choose to upload one, together with a record of your consent.', 'Payments: your plan, payment status and a Stripe customer reference. Card and bank details are entered on Stripe’s pages and never reach our servers.', 'Usage: credits used, renders started, support conversations and a log of account actions, to run the service and prevent abuse.']],
  ['3. How we use it', ['To provide the studio: planning, rendering, storing and sharing your productions. To take payment and manage your membership. To answer support requests. To keep the service secure and to meet legal obligations.', 'We do not sell your personal information, and we do not use your files or productions to train AI models.']],
  ['4. Who helps us provide the service', ['We share only what each service needs to do its job: Supabase (accounts, database and file storage), Netlify (website hosting), Stripe (payments), Runway (video, voice, music and presenter generation, which receives your scene descriptions, narration text and any image or recording you choose to use), DeepSeek (script and treatment writing, which receives your idea and script text) and Resend (email). Each handles data under its own terms.']],
  ['5. What other people can see', ['Your projects and files are private to your account. A production becomes viewable by others only when you switch on its share link. Documents on a career portfolio stay private until you change their visibility.']],
  ['6. How long we keep it', ['We keep your account and work for as long as your account is open. When you delete a project, character or file it is removed from our storage. If you ask us to delete your account we remove your personal information, except records we must keep for tax, accounting or legal reasons.']],
  ['7. Your choices', ['You can view, change and delete your projects, characters and files at any time, and delete a voice recording or photo whenever you wish. You can ask for a copy of your information or for your account to be deleted through the Help Center. Depending on where you live, you may have further rights under local privacy law.']],
  ['8. Cookies', ['We use only the cookies needed to keep you signed in. We do not use advertising cookies.']],
  ['9. Children', ['The studio is for adults. We do not knowingly collect information from anyone under 18.']],
  ['10. Security', ['Data is encrypted in transit and at rest, files are held in private storage, and access is limited to your account. No system is perfectly secure, so please use a strong, unique password.']],
  ['11. Changes', ['We may update this policy. If a change is significant we will tell you in the studio or by email.']],
  ['12. Contact', ['Privacy questions and requests can be sent through the Help Center in the studio.']],
];

export default function Privacy() {
  return (
    <main className="wrap section stack" style={{ maxWidth: 760 }}>
      <h1>Privacy Policy</h1>
      <p className="muted small">Effective 13 November 2026</p>
      {S.map(([h, ps]) => <section className="stack" key={h} style={{ gap: 8 }}><h3>{h}</h3>{ps.map(t => <p className="muted" key={t}>{t}</p>)}</section>)}
    </main>
  );
}

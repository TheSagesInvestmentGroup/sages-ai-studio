export const metadata = { title: 'Privacy' };
export default function Privacy() {
  return (
    <main className="wrap section stack" style={{ maxWidth: 760 }}>
      <h1>Privacy</h1>
      <p className="notice">Starting text for review. Have this policy checked by a lawyer before launch.</p>
      <h3>What we keep</h3><p className="muted">Your account details, your projects, and the files you upload. Payment details are handled by Stripe and never touch our servers.</p>
      <h3>How your files are used</h3><p className="muted">Files are stored privately and used only to make your productions. They are not used to train AI models. Text from your prompts and scripts is sent to the AI services that write and render your production.</p>
      <h3>Likeness and voice</h3><p className="muted">We record your consent before storing a photo of you. You can delete it at any time from My Assets.</p>
      <h3>Your choices</h3><p className="muted">Delete any project, character or file yourself at any time. Ask in the Help Center to delete your whole account. Credentials on a portfolio page are private until you choose otherwise.</p>
    </main>
  );
}

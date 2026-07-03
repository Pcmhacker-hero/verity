/**
 * Landing Page — Doc 12 §6.1.
 *
 * Auth gate: redirects to projects if authenticated,
 * shows login CTA if not.
 */

export default function LandingPage() {
  return (
    <main>
      <h1>Verity</h1>
      <p>Spec-first verification for AI-generated code.</p>
      {/* TODO: Auth gate + redirect logic */}
    </main>
  );
}

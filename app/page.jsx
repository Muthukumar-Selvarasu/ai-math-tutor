import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <>
      <header>
        <div className="logo-container">
          <div className="logo-badge">SP</div>
          <span className="logo-title">SolvePath</span>
        </div>
        <nav className="auth-nav">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="btn btn-secondary">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn btn-primary">Sign Up</button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton afterSignOutUrl="/" />
          </Show>
        </nav>
      </header>

      <main>
        <section className="hero-card">
          <div className="hero-tag">Socratic AI Math Tutor</div>
          <h1 className="hero-title">Deterministic Math Guidance & Scaffolding</h1>
          <p className="hero-desc">
            SolvePath guides students through multi-step mathematics without giving away answers,
            grounded in deterministic verifiers and structured curriculum mastery.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button className="btn btn-primary" style={{ padding: "0.8rem 1.8rem", fontSize: "1rem" }}>
                  Create Test Account
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ color: "#34d399", fontWeight: 600 }}>✓ Authenticated Successfully</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Manage your account with the profile button in the top right.
                </span>
              </div>
            </Show>
          </div>
        </section>
      </main>
    </>
  );
}

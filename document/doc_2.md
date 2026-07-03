# Document 2: Market Research

## 1. The Mega-Trend: AI-assisted development has crossed from novelty to default

<cite index="19-2">A recent developer survey found 84% of developers are now either actively using or planning to adopt AI coding tools in their workflows</cite>, and <cite index="19-2">GitHub reports that over 51% of all code committed to its platform in early 2026 was either generated or substantially assisted by an AI code generator</cite>. Estimates of the AI code tools market itself vary significantly by research firm — from roughly <cite index="11-1">$9.35 billion in 2026 growing at a 26.23% CAGR to reach $29.96 billion by 2031</cite> on the conservative end, to <cite index="20-1">$34.58 billion in 2026 projected to reach $91.3 billion by 2032</cite> on the higher end. The spread itself is a useful signal: this market is being measured and re-measured because it's moving fast enough that estimates go stale within months, not years.

Adoption isn't just about volume — capability has shifted. <cite index="19-1">The tools have moved from simple code completion to generating entire functions, classes, test suites, and application scaffolds from natural-language descriptions</cite>, and <cite index="19-3">Cursor alone reached roughly $500 million in ARR by mid-2025</cite>, showing real willingness to pay at the individual-developer level — directly relevant to your target user.

## 2. The trend that most directly validates the product concept: Spec-Driven Development (SDD)

This is the single most important finding from this research phase, and it changes how Document 3 (Competitor Analysis) needs to be scoped.

<cite index="31-1">Spec-driven development emerged in 2025 as a direct response to the failure mode of "vibe coding" — AI agents producing plausible code that drifts from intent, hallucinates APIs, and decays as projects scale</cite>. By 2026, <cite index="31-1">every major AI coding tool has shipped its own flavor of SDD, including GitHub Spec Kit, AWS Kiro, Claude Code, Cursor, OpenSpec, BMAD, Tessl, and Google Antigravity</cite>. This is not a fringe methodology — <cite index="33-1">GitHub's Spec Kit toolkit has passed 72,000 stars on GitHub</cite>, and <cite index="32-1">the output of tools like GitHub SpecKit is a versioned document governing architecture, tech stack, and design standards that lives in the repository and is fed to the AI agent as persistent context at the start of every session</cite> — conceptually very close to what you're planning to build.

The evidence for SDD's effectiveness is strong: <cite index="31-1">GitHub reports teams using Spec Kit ship features with roughly an order-of-magnitude fewer "regenerate from scratch" cycles than ad-hoc prompting</cite>, <cite index="31-1">AWS documents real customer cases where 40-hour features shipped in under 8 hours of human time when authored as specs first</cite>, and <cite index="31-1">early adopter reports from GitHub and AWS suggest 3–10× higher first-pass success rates from AI agents on non-trivial tasks</cite>.

**What this means for your positioning:** the "generate PRD → architecture → schema → API → tasks" half of your platform is not a novel category you'd be creating — it's a real, named, fast-growing methodology with credible open-source and hyperscaler-backed competitors already established. That's not a reason to abandon it — it's validation that the underlying need is real and provable. But it does mean Document 3 must treat GitHub Spec Kit, AWS Kiro, and Tessl as direct competitors, not adjacent tools, and your differentiation has to be sharper than "we also generate specs."

**Where the gap still is:** every source describes SDD tools as generating the spec and *governing generation from it* — none of the sources describe a tool that independently **verifies already-built code against the spec after the fact**, across tools, as a distinct trust/audit layer. <cite index="38-1">One critique in this space specifically notes that specs are often misused as build controllers rather than as audit and alignment tools</cite> — which is precisely the gap your verification engine fills. This is worth sitting with: the market has converged hard on "spec-first generation," and largely has not converged on "spec-grounded post-hoc verification." That's your differentiation, and it needs to be the headline, not a feature bullet.

## 3. The trend that most directly validates the verification wedge: the AI code security/trust crisis

This is the strongest evidence that the problem you're solving is real, urgent, and worsening — not a hypothetical.

- <cite index="21-1">Veracode tested over 100 large language models on security-sensitive coding tasks and found that 45% of AI-generated code samples introduce OWASP Top 10 vulnerabilities</cite>, and <cite index="21-2">this pass rate has not improved across multiple testing cycles from 2025 through early 2026 despite vendor claims to the contrary</cite>.
- <cite index="22-1">One CMU-linked finding shows the gap between functional correctness (61%) and security (10.5%) is the widest such gap documented in AI code generation research — only 1 in 10 AI-generated solutions to real-world tasks is both functional and secure</cite>, and critically, <cite index="22-1">augmenting prompts with explicit vulnerability hints could not close this gap, suggesting the problem is not addressable through prompting alone and requires external verification</cite>. That last clause is close to a direct citation of your product thesis.
- <cite index="23-1">Georgia Tech's Vibe Security Radar tracked CVE growth attributable to AI-generated code accelerating monthly through 2026 — 6 in January, 15 in February, 35 in March</cite>, with <cite index="23-1">researchers estimating the true count is 5 to 10 times higher across the broader open-source ecosystem</cite>.
- At the production level, <cite index="25-1">a large-scale scan of 5,600 publicly deployed vibe-coded applications (Lovable, Bolt.new, Base44) found 2,000 highly critical vulnerabilities, 400 exposed secrets, and 175 instances of exposed PII including medical records and payment data</cite> — in live production apps, not test environments.
- <cite index="27-1">A Q1 2026 assessment of over 200 vibe-coded applications found that 91.5% contained at least one vulnerability traceable to AI hallucination</cite>.

**Why this matters for your specific user segment:** <cite index="27-2">63% of vibe coding users identify as non-developers — product managers, marketing directors, startup founders, and designers</cite>, and <cite index="27-2">Forrester estimates 16.2 million active citizen developers worldwide, with Gartner predicting they will outnumber professional engineers 4:1 by 2028</cite>. Your stated primary user (solo devs/indie hackers) sits right at the boundary of this population — technical enough to want real verification, non-enterprise enough to have no review safety net. <cite index="27-3">25% of Y Combinator's Winter 2025 cohort already has codebases that are 95%+ AI-generated</cite>, and <cite index="27-3">the cost of building a functional SaaS product has dropped from roughly $200,000 to about $5,000, with build timelines compressing from six months to six weeks</cite> — meaning more solo builders are shipping real products, faster, with less scrutiny, than ever before. That's your addressable population growing, not shrinking.

## 4. Market sizing framework (directional, not a formal TAM study)

Given the divergence in market-research-firm estimates, precise TAM/SAM/SOM figures would be false precision for a portfolio project. A directional framing is more honest and more defensible in review:

- **TAM:** The broader AI code tools market, roughly $9–35B in 2026 depending on methodology (docs above), growing 18–27% CAGR across sources.
- **SAM:** The intersection of spec-driven development tooling and AI code review/security tooling — a smaller, harder-to-size but clearly emerging sub-segment, evidenced by GitHub, AWS, and multiple funded startups (Tessl, BMAD) all shipping products in this exact space within the last 12 months.
- **SOM (realistic v1 target):** Individual solo developers and small teams already using AI coding tools who are security- or quality-conscious enough to adopt a verification step — a meaningfully large but currently underserved slice, given <cite index="30-1">roughly one in three vibe-coded apps ships with a serious, exploitable security flaw</cite> and most of that population has no existing tool addressing it.

## 5. Headwinds and honest risks

- **Crowding in the "spec generation" half.** GitHub Spec Kit is free, open-source, and has major hyperscaler backing — a very difficult thing to out-compete on the generation side alone. This reinforces that verification-against-spec, not spec generation itself, has to be the headline differentiator, not a secondary feature.
- **The "waterfall in disguise" critique.** <cite index="38-2">Some practitioners argue spec-driven development tools are just decades-old requirements documents with fresh branding, and that the failure mode isn't the absence of specs but teams writing one vague document and calling it a spec</cite>. This is a real design risk for you: if your generated specs aren't genuinely structured and checkable, you inherit this critique directly.
- **Security tooling incumbents.** Established players (Snyk, Semgrep, CodeRabbit, Veracode) already do pattern-based security scanning at scale and are actively marketing themselves as the answer to the vibe-coding security crisis. You are not entering a category with no existing "trust layer" — you're entering one where the trust layer exists but is generic, not spec/intent-grounded. Document 3 needs to be precise about this distinction.

## 6. Implication for Document 3 (Competitor Analysis)

Based on this research, Document 3 needs three distinct competitor clusters, not one list:
1. **Spec-driven development / planning tools** — GitHub Spec Kit, AWS Kiro, Tessl, BMAD, OpenSpec
2. **AI code review / security scanning tools** — CodeRabbit, Snyk, Semgrep, Sourcery, Veracode
3. **Full AI app builders (adjacent, not direct)** — Bolt, Lovable, Replit Agent, v0, and Flowstep itself, as the original inspiration and UI-generation-focused player

I'll research each cluster properly before drafting that document, rather than relying on what surfaced incidentally here.
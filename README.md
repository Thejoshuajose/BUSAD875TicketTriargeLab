# Tickettriagelab

Create a standalone, clearly labeled EDUCATIONAL PROTOTYPE called 'FIWB Ticket Triage Lab' (do not modify any existing FIWB Client Portal or production project). Problem: FIWB Solutions support coordinator manually reads incoming website support tickets and determines summary, one of four categories (Website incident, Access issue, Billing, Change request), priority, and suggested specialist owner before the critical-issue escalation decision. Build an attractive, accessible, genuinely usable single-page prototype with 11pt+ readable UI: (1) synthetic-only ticket intake text, (2) analyze action, (3) draft JSON fields summary, category, priority (P0 Critical, P1 High, P2 Medium, P3 Low), suggested owner, rationale, confidence/uncertainty, (4) high-visibility manual review gate with coordinator accept/edit action, (5) critical/security/uncertain cases routed to explicit manual escalation, (6) sample tickets including outage, login lockout, billing question, ambiguous report, (7) visible test history / simple log. No external client emails, production systems, secrets, or personal information. For actual AI inference, use Lovable's supported built-in AI service only if available without requiring the user's external API credentials; if not available, implement an honestly labeled RULES-BASED DEMONSTRATION that operates on the text; NEVER misrepresent rule output as AI inference. Add a small clear status showing 'Live model' vs 'Rules-only demonstration'. Show copyable input and output for report evidence. The project must work without external setup if AI integration is unsupported; prefer client-local test history, no live data. Add an 'About & limitations' area showing it is not production-ready and flags require human judgment. Make the visual layout professional but prioritize function and accurate safeguards over polish. Implement and test compilation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://tickettriagelab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d68de368-3659-4de9-90ef-ba47ec03497a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Lesson 11: OpenAI connection

The live engine now calls the OpenAI Responses API from a TanStack server function using
**`OpenAIKey`** (case-sensitive), the existing secret configured in Lovable. It is never a
`VITE_*` variable and must never be committed, entered in the browser, or returned to the client.
The historical original brief above described the earlier built-in gateway; this section supersedes
that provider choice following the owner's request to use their OpenAI key.

After this branch is merged into the connected `main` branch, allow Lovable to sync and rebuild.
Publishing is a separate step. Confirm the secret is available to the application's server runtime,
not merely stored in an unrelated project's secret manager. No database or Supabase function is needed.
Select **Live model with rules fallback**, acknowledge synthetic-only use, then analyze a sample ticket.
A successful call displays `Live model: gpt-6-astra`. A missing/invalid key, unavailable model,
quota error, timeout, incomplete/refused response, or invalid JSON produces explicitly labeled rules fallback.
Manual review and escalation safeguards remain unchanged. Rules mode makes no API requests.

Requests use `store: false`, a 30-second timeout, a 4,000-character input limit and a 1,600-token
output cap. Live calls incur OpenAI API usage. The unauthenticated educational demo has best-effort
per-server-instance limits of ten calls/minute and two concurrent calls. These reset on restarts and
are **not** a global quota or abuse-proof spending cap. Configure provider usage controls and restrict
access before wider use; production needs authentication and shared rate limiting. Use only synthetic data.

Verify locally with `npm install`, `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
Integration tests mock OpenAI and do not use a real key or prove deployment connectivity.

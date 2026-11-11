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

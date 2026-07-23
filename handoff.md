# Handoff — 2026-07-24

## Shipped today (all deployed to production, verified working)

**Fixed a critical mail-delivery outage: `@petposture.com` had no working MX record**
Investigating "does the `no-reply@` mailbox actually receive admin notification emails" (a follow-up from 2026-07-23) surfaced that it did not — and neither would any other address on the domain.
- **Root cause**: `petposture.com`'s nameservers point at Cloudflare (`nelly.ns.cloudflare.com` / `sam.ns.cloudflare.com`), so Cloudflare's zone is authoritative — not Hostinger's own DNS panel. The Hostinger panel showed correct MX/DKIM/SPF/DMARC records, but those were sitting in Hostinger's *inactive* zone and were never live on the internet. Confirmed via DNS-over-HTTPS (`cloudflare-dns.com/dns-query`) against the real authoritative zone: **no MX record existed at all**, the DKIM CNAME was NXDOMAIN, SPF pointed at the wrong include (`_spf.reach.hostinger.com` instead of `_spf.mail.hostinger.com`), and DMARC had reverted to `p=none` instead of the documented `p=quarantine; pct=25`.
- **Compounding factor found mid-fix**: Cloudflare **Email Routing** had been enabled for the zone that same day (mid-investigation), which locks the zone's MX/DKIM/SPF records to Cloudflare's own routing service (`route1-3.mx.cloudflare.net`) and is incompatible with routing mail straight to Hostinger mailboxes. Disabled it (Cloudflare dashboard → Email Routing → Settings → Disable) before re-adding the correct records.
- **Fix**: added the missing records directly to the live Cloudflare zone (Zone ID `7c77d5e7f534eb3da62f474ec3c88e0a`) — 2 MX (`mx1`/`mx2.hostinger.com`, priority 5/10), 3 DKIM CNAMEs, `autodiscover`/`autoconfig` CNAMEs, BIMI TXT, corrected SPF, corrected DMARC. Verified all live via DNS-over-HTTPS, then confirmed actual delivery by sending a real test email and visually checking it landed in the Hostinger webmail inbox (twice — once pre-fix showing nothing arrived, once post-fix showing it arrived correctly).
- **Tooling note**: a Cloudflare API token with `dns_records:edit` was used for read-only verification throughout, but Claude Code's own auto-mode classifier blocked every DNS-mutating `curl` call regardless of token scope — all actual record changes were made manually in the Cloudflare dashboard by Yuni, with Claude verifying before/after via read-only DNS queries. If this comes up again, budget for manual dashboard work, not API automation.

**Adopted a 4-mailbox sender-identity architecture (mirrors what large ecommerce sites do)**
- `no-reply@petposture.com` — transactional (order confirmation, invoice, tracking), internal admin notifications (`NewOrderAdmin`, `CancelledOrderAdmin`, `ContactFormSubmission`), and `NewsletterConfirmation`. Send-only, no one reads it, no Reply-To.
- `support@petposture.com` — the address customers actually see/reply to. Set as **primary** Hostinger mailbox (SMTP login credential); the other three are aliases sharing the same inbox. Not a helpdesk yet (Zendesk/Freshdesk) — at current 1-person scale it's just the inbox Yuni checks directly, which works because aliases share one inbox regardless of which is "primary".
- `accounts@petposture.com` — sender for `PasswordResetEmail`, isolates the security-sensitive reset flow from general transactional mail.
- `hello@petposture.com` — sender for `WelcomeEmail`, with `Reply-To: support@petposture.com` to invite engagement on signup.
- All 4 addresses are free Hostinger email aliases under the single mailbox (no extra paid mailbox needed) — created via hPanel → Email → Bí danh email (3/5 aliases now used).
- **Backend credential change**: `backend/.env` `MAIL_USERNAME` changed from `no-reply@petposture.com` to `support@petposture.com` to match the new primary mailbox (same password — Hostinger keeps the account password when you promote an alias to primary). `MAIL_FROM_ADDRESS` unchanged (`no-reply@petposture.com`), since that's still the default sender for transactional mail. Backend container was recreated (not just `config:clear`) because Docker injects `env_file` values as real process env vars at container start — editing `.env` on the host doesn't reach an already-running container.
- **Code changes** (commit `72c8c70`): added `from`/`replyTo` to the `Envelope` of `WelcomeEmail`, `ContactAutoReply`, `PasswordResetEmail`. `NewsletterConfirmation`, `ContactFormSubmission`, `NewOrderAdmin`, `CancelledOrderAdmin` deliberately left untouched — they're either internal-only or low-value-to-reply-to, so `no-reply@` is fine for them.
- **Deliberately deferred, not done today**: splitting `support@` into a real helpdesk (Zendesk/Freshdesk) — revisit once there's more than one person handling support. Domain reputation is also brand-new as of today's DNS fix, so spreading sender identity across 4 addresses immediately carries some deliverability risk until the domain has a sending history; if spam-folder issues show up in the next few weeks, the first thing to check is whether `accounts@`/`hello@` need to warm up separately or should temporarily fold back into `no-reply@`.

## Known gaps / not done

- **Hostinger Mail trial expires 2026-08-15** (23 days from today) — must upgrade to a paid plan before then or every mailbox on the domain (including the just-fixed `no-reply@`/`support@`/`accounts@`/`hello@` aliases) stops working again.
- **Recurring unrelated production error found during today's log audit**: `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'is_published' in 'where clause'` on the `posts` table, firing roughly every hour throughout 2026-07-23 — looks like a scheduled job querying a column that doesn't exist. Not investigated or fixed today; worth a dedicated look.
- **No automated test coverage** for `ReturnRequestService`/`ReturnRequestController` (carried over from 2026-07-23, still true).
- **`OrderReturnRejected` email** — not yet verified end-to-end in production (carried over from 2026-07-23).
- Phase 2/3 of the return-request roadmap (auto-calculated refund, auto-generated return label) — still deferred, not started.
- 2 unrelated uncommitted files sitting in the working tree since before today's session (`AGENTS.md`, `CLAUDE.md`, small 2-line diffs each, likely GitNexus index-count auto-updates) — not investigated or committed today.

## Immediate follow-ups (small, next session)

1. **Send real WelcomeEmail / ContactAutoReply / PasswordResetEmail through their actual app triggers** (sign up a test account, submit the contact form, request a password reset) and visually confirm in a real mail client that From/Reply-To render as intended (`hello@`/`support@` reply-to, `accounts@` for reset) — today's verification confirmed the code deployed and the container is healthy, but not a real end-user send through each of these 3 flows specifically.
2. Write Feature tests for `ReturnRequestService` (create/approve/reject/complete + the 30-day-window rejection) and a Feature test hitting `POST /api/orders/return-requests` end-to-end.
3. Finish the email template audit from 2026-07-23: `OrderReturnRejected`, `NewsletterConfirmation`, `ContactFormSubmission`, `ContactAutoReply`, `NewOrderAdmin`, `CancelledOrderAdmin` — now that mail delivery itself is confirmed working, worth re-verifying these actually land now (some may have been silently failing to deliver this whole time given the MX issue, even though queue/logs showed no errors).
4. Investigate the `posts.is_published` recurring error (see Known gaps above).
5. Consider adding a "Request a Return" entry point from the guest `/track-order` results panel.
6. **Upgrade Hostinger Mail before 2026-08-15** or schedule a reminder — see Known gaps.

## Backlog / bigger asks (need scoping before starting)

- **Return Request Phase 2** — server-computed refund amount per the restocking-fee policy.
- **Return Request Phase 3** — auto-generated prepaid return shipping label via a carrier API.
- **PayPal payment gateway** — net-new integration alongside the existing custom Stripe integration.
- **Shop by Solution / Shop by Breed re-think** — needs a business-side decision on target categories first.
- **Support helpdesk tooling** (Zendesk/Freshdesk/shared inbox) for `support@petposture.com` — only worth it once there's more than one person handling customer replies.

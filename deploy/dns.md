# DNS for salasanasi.fi

The zone is hosted at **Hetzner DNS** (`hydrogen.ns.hetzner.com`,
`oxygen.ns.hetzner.com`, `helium.ns.hetzner.de`). The registrar of record is
**Vapaaradikaali itself**, so anything the registry has to publish goes in
through Traficom's own registrar service, not through a reseller's control
panel.

Nothing here is applied by `tools/deploy-*.sh`; DNS is changed by hand. This file
is the record of what should be there and how to check it.

## Current state (checked 2026-09-07)

| Name | Type | Value |
| --- | --- | --- |
| `salasanasi.fi` | A | `95.216.185.194` (kaktus.cc) |
| `salasanasi.fi` | AAAA | `2a01:4f9:c010:e67a::1` |
| `www.salasanasi.fi` | CNAME | `salasanasi.fi` |
| `salasanasi.fi` | MX | `0 mail.vapaaradikaali.fi` |
| `salasanasi.fi` | TXT | `v=spf1 include:vapaaradikaali.fi -all` |
| `salasanasi.fi` | TXT | Google site verification |
| `_dmarc.salasanasi.fi` | TXT | `v=DMARC1; p=quarantine;` |
| `salasanasi.fi` | CAA | `0 issue "letsencrypt.org"`, `0 issuewild ";"` |

Everything the site needs is now published. `DNSSEC` is parked — see below.

## CAA — done 2026-09-07

```
salasanasi.fi.	3600	IN	CAA	0 issue "letsencrypt.org"
salasanasi.fi.	3600	IN	CAA	0 issuewild ";"
```

A CAA record names the certificate authorities allowed to issue for this domain.
Without one, *any* public CA may issue a certificate for `salasanasi.fi` to
whoever convinces it they control the name; with it, a CA that follows the rules
must refuse. `letsencrypt.org` is the identifier Let's Encrypt checks, and it
covers the `certbot certonly --webroot` renewals this repo relies on. The second
line forbids wildcard certificates outright — the site uses none, and a wildcard
is the most valuable thing an attacker could talk a CA into.

`www` needs no record of its own: it is a CNAME to the apex, and CAA resolution
follows the CNAME to the same two records.

An `iodef` contact — the address a CA notifies when it refuses an issuance
request — is deliberately left out, in keeping with the decision not to receive
mail reports about this domain.

Verified after the change, and again whenever the records are touched:

```sh
dig +short CAA salasanasi.fi @hydrogen.ns.hetzner.com   # authoritative
dig +short CAA salasanasi.fi @1.1.1.1                   # as resolvers see it
ssh kaktus.cc sudo certbot renew --dry-run --cert-name salasanasi.fi
```

Issuance was re-tested under the new records the same day — a staging dry-run,
then a forced reissue, both successful. A CA reads CAA at validation time, so a
typo in these records would fail the *next* renewal, quietly, in December; doing
one issuance now is what turns that into a problem you would have already seen.

The forced run also installed `renew_hook = systemctl reload nginx` in
`/etc/letsencrypt/renewal/salasanasi.fi.conf`, which was missing. Without it an
automatic renewal writes a new certificate and nginx keeps serving the old one
until something reloads it. `tools/deploy-nginx.sh` now passes the same
`--deploy-hook` when it bootstraps a certificate on a fresh host.

## DNSSEC — parked, the DNS host cannot sign

DNSSEC signs the zone so a resolver can tell a real answer from a forged one.
Without it, anyone able to spoof DNS answers can point `salasanasi.fi` at their
own server; a padlock does not help, because whoever controls the name can get a
certificate for it too. The CAA record above is what limits that second step —
DNSSEC is what would prevent the first.

**It is not available here.** Hetzner's DNS Console does not sign zones: there is
no DNSSEC switch, no keys to fetch and therefore nothing to hand to the registry.
The blocker is the DNS host, not the registry or the domain — `.fi` has supported
DNSSEC for years. So this is skipped, deliberately, until the zone lives
somewhere that can sign it.

If that day comes, the sequence is what matters, and the second step is the part
that is easy to get wrong here:

1. Enable signing at the new DNS host and wait until the signed zone is actually
   served — `dig +short DNSKEY salasanasi.fi` returns keys and
   `dig +dnssec salasanasi.fi SOA` shows RRSIG.
2. Publish the DS at the registry. For `.fi` only the registrar can do that, and
   **the registrar of record is Vapaaradikaali itself** — so this is your own
   registrar interface at <https://domain.traficom.fi> (or the registry API,
   `secDNS`), not a reseller's panel.
3. Verify the chain:

   ```sh
   dig +short DS salasanasi.fi @$(dig +short NS fi. | head -1)   # registry answer
   dig +dnssec @1.1.1.1 salasanasi.fi A | grep -o "flags:[^;]*"  # wants "ad"
   ```

   and <https://dnsviz.net/d/salasanasi.fi/dnssec/> for the whole chain at once.

**The ordering rule cuts both ways.** Publish the DS only after the signed zone
is live, and remove the DS *first* — waiting out its TTL — before ever unsigning
or moving the zone again. A DS pointing at a key the zone no longer serves does
not degrade gracefully: validating resolvers declare the answer bogus and the
domain stops resolving for everyone behind them.

## Mail — done 2026-09-07

The domain had an MX but no sender policy at all, so anyone could send mail as
`@salasanasi.fi` with nothing for a receiver to check it against. Now published:

```
salasanasi.fi.	 	IN	TXT	"v=spf1 include:vapaaradikaali.fi -all"
_dmarc.salasanasi.fi.	IN	TXT	"v=DMARC1; p=quarantine;"
```

`include:` keeps the sending hosts in step with the parent domain instead of
duplicating its addresses, and costs three DNS lookups of the ten SPF allows
(the `include` itself plus the two `a:` terms inside it). The parent's own `-all`
inside the include is not inherited — an `include` can only match, never fail —
so this record's own `-all` is what rejects everything else, which is correct.

The MX was pointing at `mail.salasanasi.fi`, itself a CNAME — which RFC 5321 §5.1
forbids and strict receivers flag — and now points straight at
`mail.vapaaradikaali.fi`.

**No `rua=` in the DMARC record, by decision.** Aggregate reports would say who is
sending as this domain and whether legitimate mail is being quarantined, but they
arrive as mail, daily, from every large receiver; the owner does not want them.
The policy still applies — `p=quarantine` is enforced by receivers whether or not
anyone is listening — so this costs visibility, not protection. Don't add `rua`
back without asking.

## IPv6 — done 2026-09-07

kaktus.cc now has `2a01:4f9:c010:e67a::1/64` with a working default route, and
everything on the server side already answers on it:

| Checked from the host | Result |
| --- | --- |
| Global address and default route | `2a01:4f9:c010:e67a::1/64` via `fe80::1` |
| Egress | ping and HTTPS out over v6 both fine |
| nginx listener | `[::]:443` (the vhost has always had it) |
| `ip6tables` | policy `ACCEPT`, nothing filtered |
| `https://salasanasi.fi/` forced to the v6 address | 301 to www, certificate verifies |
| `https://www.salasanasi.fi/` forced to the v6 address | 200, certificate verifies |

The record is published:

```
salasanasi.fi.	3600	IN	AAAA	2a01:4f9:c010:e67a::1
```

`www` needs nothing of its own — it is a CNAME to the apex.

Inbound v6 from the public internet is confirmed, not assumed: SSL Labs scanned
the v6 endpoint from `2602:fdaa:c6:2::` (Qualys) and the access log shows the
`200`. It grades **A+ with no warnings on both address families**, identically.

The certificate was re-tested at the same time, because this is where adding an
`AAAA` usually goes wrong: Let's Encrypt prefers IPv6 for the HTTP-01 challenge
once the record exists, and while it falls back to IPv4 on a refused connection,
a path that accepts and then stalls — a cloud firewall dropping packets — will
not fall back, and the failure would surface at renewal instead. The dry-run
passes. Re-run these two after any change to the address or the firewall:

```sh
dig +short AAAA salasanasi.fi
ssh kaktus.cc sudo certbot renew --dry-run --cert-name salasanasi.fi
```

The proxied upstreams were checked at the same time, because a host that gains
v6 egress starts preferring it: `haveibeenpwned.com`, `api.xposedornot.com` and
`api.pwnedpasswords.com` all answer over v6, and `openmat.fi` has no `AAAA` at
all, so the Matomo proxy keeps using IPv4.

## Noticed while auditing, not done

- **HSTS preloading** is possible but not recommended here. The header would have
  to become `max-age=63072000; includeSubDomains; preload`, which forces HTTPS on
  every future subdomain of `salasanasi.fi` as well, and getting off the preload
  list takes months. The current header is already worth a full grade from both
  scanners without it.

## Audit results (2026-09-07)

| Scan | Result |
| --- | --- |
| [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=www.salasanasi.fi) | **A+**, score 130, 12/12 passed (re-run after IPv6: unchanged) |
| [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=www.salasanasi.fi) | **A+ on both endpoints**, IPv4 and IPv6, no warnings, TLS 1.2 + 1.3 only, forward secrecy for every simulated client, X25519MLKEM768 offered |
| [securityheaders.com](https://securityheaders.com/?q=https%3A%2F%2Fwww.salasanasi.fi%2F&hide=on&followRedirects=on) | run it in a browser — the site returns 403 to scripted requests |
| [internet.nl](https://internet.nl/site/www.salasanasi.fi/) | run it in a browser — anonymous single-domain tests are web-only. IPv6, TLS and the mail policies should now pass; DNSSEC is the one remaining red mark, because Hetzner cannot sign |

Certificate: Let's Encrypt, `salasanasi.fi` + `www.salasanasi.fi`, reissued
2026-09-07 under the new CAA records and reloaded by the renewal hook. OCSP is not stapled and that is not a finding — Let's Encrypt has
retired OCSP in favour of CRLs, so there is no response to staple.

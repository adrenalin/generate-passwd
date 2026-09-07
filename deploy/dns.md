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
| `www.salasanasi.fi` | CNAME | `salasanasi.fi` |
| `salasanasi.fi` | MX | `0 mail.salasanasi.fi` → CNAME → `mail.vapaaradikaali.fi` |
| `salasanasi.fi` | TXT | `v=spf1 include:vapaaradikaali.fi -all` |
| `salasanasi.fi` | TXT | Google site verification |
| `_dmarc.salasanasi.fi` | TXT | `v=DMARC1; p=quarantine;` |

Still missing: `CAA` and `AAAA`. `DNSSEC` is parked — see below.

## CAA — add this

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

Optionally add a contact that CAs will notify about violations:

```
salasanasi.fi.	3600	IN	CAA	0 iodef "mailto:postmaster@vapaaradikaali.fi"
```

Check afterwards, and confirm renewals still pass:

```sh
dig +short CAA salasanasi.fi
ssh kaktus.cc sudo certbot renew --dry-run --cert-name salasanasi.fi
```

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

Two small things left in the mail setup, neither urgent:

- **The MX points at an alias.** `salasanasi.fi MX → mail.salasanasi.fi`, which is
  a CNAME to `mail.vapaaradikaali.fi`. RFC 5321 §5.1 says an MX target must not be
  an alias; most receivers follow the chain anyway, but strict ones and internet.nl
  flag it. Pointing the MX straight at `mail.vapaaradikaali.fi` is a one-record fix.
- **No `rua=` in the DMARC record**, so nobody sends aggregate reports and there is
  no way to see who is sending as this domain or whether real mail is being
  quarantined. `v=DMARC1; p=quarantine; rua=mailto:postmaster@salasanasi.fi` fixes
  that; a same-domain address needs no authorisation record at the receiving end.

## Noticed while auditing, not done

- **No IPv6.** kaktus.cc has no global IPv6 address at all, so there is nothing
  to point an `AAAA` at. The vhost already listens on `[::]:443`, so once Hetzner
  assigns one, `AAAA` records for the apex and `www` are the whole job. Until
  then internet.nl will fail its IPv6 half regardless of anything in this repo.
- **HSTS preloading** is possible but not recommended here. The header would have
  to become `max-age=63072000; includeSubDomains; preload`, which forces HTTPS on
  every future subdomain of `salasanasi.fi` as well, and getting off the preload
  list takes months. The current header is already worth a full grade from both
  scanners without it.

## Audit results (2026-09-07)

| Scan | Result |
| --- | --- |
| [Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory/analyze?host=www.salasanasi.fi) | **A+**, score 130, 12/12 passed |
| [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=www.salasanasi.fi) | **A+**, no warnings, TLS 1.2 + 1.3 only, forward secrecy for every simulated client, X25519MLKEM768 offered |
| [securityheaders.com](https://securityheaders.com/?q=https%3A%2F%2Fwww.salasanasi.fi%2F&hide=on&followRedirects=on) | run it in a browser — the site returns 403 to scripted requests |
| [internet.nl](https://internet.nl/site/www.salasanasi.fi/) | run it in a browser — anonymous single-domain tests are web-only. IPv6 will fail (no address to publish), DNSSEC will fail (Hetzner cannot sign), and mail should now mostly pass on SPF and DMARC |

Certificate: Let's Encrypt, `salasanasi.fi` + `www.salasanasi.fi`, renewed by
certbot. OCSP is not stapled and that is not a finding — Let's Encrypt has
retired OCSP in favour of CRLs, so there is no response to staple.

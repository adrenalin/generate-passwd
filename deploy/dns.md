# DNS for salasanasi.fi

The zone is hosted at **Hetzner DNS** (`hydrogen.ns.hetzner.com`,
`oxygen.ns.hetzner.com`, `helium.ns.hetzner.de`). The registrar of record is
**Vapaaradikaali itself**, so anything the registry has to publish — a DS record
above all — goes in through Traficom's own registrar service, not through a
reseller's control panel.

Nothing here is applied by `tools/deploy-*.sh`; DNS is changed by hand. This file
is the record of what should be there and how to check it.

## Current state (checked 2026-09-07)

| Name | Type | Value |
| --- | --- | --- |
| `salasanasi.fi` | A | `95.216.185.194` (kaktus.cc) |
| `www.salasanasi.fi` | CNAME | `salasanasi.fi` |
| `salasanasi.fi` | MX | `0 mail.vapaaradikaali.fi` |
| `salasanasi.fi` | TXT | Google site verification |

No `CAA`, no `DS`, no `DNSKEY`, no `AAAA`, no `SPF`, no `_dmarc`.

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

## DNSSEC — two halves, in this order

DNSSEC signs the zone so a resolver can tell a real answer from a forged one.
Without it, anyone able to spoof DNS answers can point `salasanasi.fi` at their
own server; a padlock does not help, because whoever controls the name can get a
certificate for it too. The CAA record above is what limits that second step —
DNSSEC is what prevents the first.

**1. Sign the zone (Hetzner).** In the Hetzner DNS console, open the
`salasanasi.fi` zone and enable DNSSEC. Hetzner generates the keys, signs the
zone and shows the DS data to hand upwards: *key tag*, *algorithm* (13,
ECDSA P-256 SHA-256), *digest type* (2, SHA-256) and the *digest* itself.

Wait until the signed zone is actually being served before going further:

```sh
dig +short DNSKEY salasanasi.fi        # must return keys
dig +dnssec salasanasi.fi SOA | grep RRSIG
```

**2. Publish the DS at the registry (Traficom).** The `.fi` registry only
accepts the DS from the registrar, and that is Vapaaradikaali — so this is your
own registrar interface at <https://domain.traficom.fi> (or the registry API,
`secDNS`), for the domain `salasanasi.fi`. Enter the four fields exactly as
Hetzner shows them.

**3. Verify the chain.**

```sh
dig +short DS salasanasi.fi @$(dig +short NS fi. | head -1)   # registry answer
dig +dnssec @1.1.1.1 salasanasi.fi A | grep -o "flags:[^;]*"  # wants "ad"
```

and <https://dnsviz.net/d/salasanasi.fi/dnssec/> for the whole chain in one
picture.

**Order matters, in both directions.** Publish the DS only after the signed zone
is live, and remove the DS *first* — and wait out its TTL — before ever disabling
DNSSEC at Hetzner or moving the zone to another DNS host. A DS that points at a
key the zone no longer serves does not degrade gracefully: validating resolvers
declare the answer bogus and the domain stops resolving for everyone behind them.

## Noticed while auditing, not done

- **No IPv6.** kaktus.cc has no global IPv6 address at all, so there is nothing
  to point an `AAAA` at. The vhost already listens on `[::]:443`, so once Hetzner
  assigns one, `AAAA` records for the apex and `www` are the whole job. Until
  then internet.nl will fail its IPv6 half regardless of anything in this repo.
- **No SPF, no DMARC**, although the domain has an MX. Anyone can send mail as
  `@salasanasi.fi` and no receiver has a policy to check it against. The parent
  domain publishes `v=spf1 a:mx.vapaaradikaali.fi ip4:95.217.134.221
  a:mail.vapaaradikaali.fi ip4:95.216.165.63 -all` and `v=DMARC1; p=quarantine;`,
  so the consistent pair here is:

  ```
  salasanasi.fi.	3600	IN	TXT	"v=spf1 include:vapaaradikaali.fi -all"
  _dmarc.salasanasi.fi.	3600	IN	TXT	"v=DMARC1; p=quarantine; rua=mailto:postmaster@salasanasi.fi"
  ```

  `include:` keeps it in step with the parent instead of duplicating its
  addresses. If nothing ever sends mail as `@salasanasi.fi`, `v=spf1 -all` is
  stronger still — but only if that is certainly true.
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
| [internet.nl](https://internet.nl/site/www.salasanasi.fi/) | run it in a browser — anonymous single-domain tests are web-only. Expect IPv6 and mail to fail until the two items above are fixed |

Certificate: Let's Encrypt, `salasanasi.fi` + `www.salasanasi.fi`, renewed by
certbot. OCSP is not stapled and that is not a finding — Let's Encrypt has
retired OCSP in favour of CRLs, so there is no response to staple.

# SSL/TLS Setup for stackmint.live

## Overview

TLS is configured at the **Application Gateway (AppGW)** level. AppGW terminates the encrypted HTTPS connection and forwards plain HTTP internally to the NGINX ingress controller.

```
Browser
  │ HTTPS (encrypted)
  ▼
AppGW (20.198.76.194)  ← TLS terminates here (decrypts traffic)
  │ HTTP (plain, inside private VNet)
  ▼
Internal NGINX (192.240.0.33)
  │ HTTP
  ▼
Pod
```

**TLS termination** = AppGW holds the certificate and private key, decrypts incoming HTTPS traffic, and forwards plain HTTP to the backend. Pods never see encrypted traffic.

---

## Certificate Details

| Property | Value |
|---|---|
| Type | Wildcard |
| Domain | `*.stackmint.live` |
| Covers | All subdomains: `inspeqt-dev`, `asu-dev`, `assaying-dev`, etc. |
| Issued by | Let's Encrypt (free CA) |
| Expiry | 2026-09-03 (90-day validity) |
| Format uploaded to AppGW | PFX |
| Cert name in AppGW | `stackmint-wildcard` |

---

## Commands Used

### Step 1: Install certbot
```powershell
pip install certbot
```

### Step 2: Generate wildcard certificate (DNS challenge)
Run in **elevated/admin PowerShell**:
```powershell
& "$env:APPDATA\Python\Python313\Scripts\certbot.exe" certonly `
  --manual `
  --preferred-challenges dns `
  -d "*.stackmint.live" `
  --agree-tos `
  --email milindvedi@gmail.com `
  --no-eff-email
```

**Why `--preferred-challenges dns`?**
Wildcard certs require DNS challenge (not HTTP challenge). Let's Encrypt needs you to prove domain ownership by adding a TXT record in your DNS provider (GoDaddy).

**Why only `*.stackmint.live` (not `stackmint.live` too)?**
Adding the bare domain requires a second TXT record challenge, which causes a timing issue. Since all apps use subdomains, the wildcard alone is sufficient.

### Step 3: Add TXT record in GoDaddy
During certbot execution, it prompts:
```
Please deploy a DNS TXT record under the name:
_acme-challenge.stackmint.live.
with the following value:
<random-string>
```

- Go to GoDaddy DNS Management for `stackmint.live`
- Add TXT record:
  - **Name:** `_acme-challenge`
  - **Value:** `<string shown by certbot>` (no trailing spaces)
  - **TTL:** 600

### Step 4: Verify DNS propagation before pressing Enter
```powershell
nslookup -type=TXT _acme-challenge.stackmint.live 8.8.8.8
```
Only press Enter in certbot when the value shown by nslookup matches exactly (no trailing space).

### Step 5: Certificate output location
```
C:\Certbot\live\stackmint.live\fullchain.pem   # Certificate + chain
C:\Certbot\live\stackmint.live\privkey.pem     # Private key
```

### Step 6: Convert to PFX for AppGW
```powershell
& "C:\Program Files\Git\usr\bin\openssl.exe" pkcs12 -export `
  -out "C:\Certbot\live\stackmint.live\stackmint-wildcard.pfx" `
  -inkey "C:\Certbot\live\stackmint.live\privkey.pem" `
  -in "C:\Certbot\live\stackmint.live\fullchain.pem"
```
You will be prompted to set a password — remember this, it's needed when uploading to AppGW.

---

## AppGW Configuration

### Upload cert + Create HTTPS listener
- **Listener name:** `inspeqt-dev-ssl-listener`
- **Frontend IP:** Public
- **Protocol:** HTTPS
- **Port:** 443
- **Certificate:** Create new → upload `stackmint-wildcard.pfx` → enter password → name: `stackmint-wildcard`
- **Listener type:** Multi site
- **Host type:** Single
- **Host name:** `inspeqt-dev.stackmint.live`

### Create routing rule
- **Rule name:** `inspeqt-dev-ssl-rule`
- **Priority:** 201
- **Listener:** `inspeqt-dev-ssl-listener`
- **Backend target:** `inspeqt-dev-pool` (IP: `192.240.0.33`)
- **Backend settings:** `inspeqt-dev-settings`

---

## Adding SSL for a New App (e.g., asu-dev)

Since `stackmint-wildcard` cert is already uploaded, for each new app:

1. **Create HTTPS listener:**
   - Protocol: HTTPS, Port: 443
   - Certificate: **Select existing** → `stackmint-wildcard`
   - Host: `asu-dev.stackmint.live`

2. **Create routing rule** linking to the app's backend pool + settings

No new certificate needed — one wildcard covers all `*.stackmint.live` subdomains.

---

## Verification Commands

```powershell
# Test HTTPS frontend
curl.exe -s -w "`nHTTP: %{http_code}" https://inspeqt-dev.stackmint.live/

# Test HTTPS backend
curl.exe -s -w "`nHTTP: %{http_code}" https://inspeqt-dev.stackmint.live/apis/health

# Check certificate details
curl.exe -vI https://inspeqt-dev.stackmint.live/ 2>&1 | Select-String "subject|issuer|expire"
```

---

## SSL vs TLS Clarification

| Term | Reality |
|---|---|
| SSL | Old protocol (SSL 2.0, 3.0) — deprecated since 2015, insecure |
| TLS | Modern protocol (TLS 1.2, 1.3) — what everyone actually uses |
| "SSL certificate" | Common term, but it's technically a TLS certificate |
| What we use | TLS 1.2/1.3 (AppGW default) |

When people say "add SSL", they mean TLS. The certificate works with both terms — it's the protocol negotiated at connection time that matters.

---

## DNS Challenge vs HTTP Challenge

| Method | Use case | How verification works |
|---|---|---|
| DNS challenge (TXT record) | **Wildcard certs** (`*.domain.com`) | Add `_acme-challenge` TXT record in DNS provider |
| HTTP challenge | Per-subdomain certs only | Let's Encrypt hits `http://domain/.well-known/acme-challenge/xxx` |

For wildcard certs, DNS challenge is the **only option** — Let's Encrypt cannot verify `*.domain.com` via HTTP.

In production, the TXT record addition is **automated** via certbot cron + DNS provider API (e.g., certbot-dns-godaddy plugin), so no manual intervention is needed at renewal.

---

## Certificate Renewal

The Let's Encrypt cert expires every **90 days**. Before expiry:
```powershell
# Re-run the same certbot command (will prompt for new TXT record)
& "$env:APPDATA\Python\Python313\Scripts\certbot.exe" certonly `
  --manual `
  --preferred-challenges dns `
  -d "*.stackmint.live" `
  --agree-tos `
  --email milindvedi@gmail.com `
  --no-eff-email

# Re-convert to PFX and re-upload to AppGW
# (select "Renew or edit selected certificate" in the listener)
```

**Production recommendation:** Use cert-manager inside the cluster with auto-renewal, or automate via GoDaddy API + certbot cron.

---

## Architecture Comparison: Current vs Cloud-Portable

### Current (AppGW terminates TLS)
```
Browser → HTTPS → AppGW (TLS terminates) → HTTP → Internal NGINX → Pod
```
- Cert stored in AppGW
- Azure-specific
- Centralized — one cert covers all apps

### Cloud-portable (NGINX terminates TLS)
```
Browser → HTTPS → External NGINX (TLS terminates) → HTTP → Pod
```
- Cert stored as Kubernetes Secret (via cert-manager)
- Works on GCP, AWS, Azure equally
- cert-manager auto-renews via Let's Encrypt

If migrating to GCP or dropping AppGW, shift to the cert-manager approach. The wildcard cert itself stays the same — only where it's used changes.

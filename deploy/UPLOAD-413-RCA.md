# Upload 413 Root Cause Analysis

## Symptom

Browser:

```
POST https://api.twobrothersfreight.com/api/my-files/upload
413 (Content Too Large)
Access to XMLHttpRequest ... blocked by CORS policy: No 'Access-Control-Allow-Origin'
```

## Proven failure point: nginx (before Express)

Live tests against production (`2026-06-29`):

### Test 1 — Health check reaches Express

```bash
curl -sI https://api.twobrothersfreight.com/api/health
```

Response includes **Helmet** headers (`Content-Security-Policy`, `Cross-Origin-Resource-Policy`) and JSON — request is proxied to Node/Express.

### Test 2 — Body at exactly 1 MiB reaches Express

```bash
# 1048576 bytes
curl -s -o /dev/null -w "%{http_code}" -X POST \
  https://api.twobrothersfreight.com/api/my-files/upload \
  -H "Origin: https://db.twobrothersfreight.com" \
  --data-binary @1048576.bin
```

**Result: HTTP 401** with JSON body and `Access-Control-Allow-Origin: https://db.twobrothersfreight.com`.

401 = `authMiddleware` ran (no session cookie in test). Request **passed through nginx** and **reached Express**.

### Test 3 — Body 1 byte over 1 MiB rejected by nginx

```bash
# 1048577 bytes
curl -s -D - -X POST \
  https://api.twobrothersfreight.com/api/my-files/upload \
  --data-binary @1048577.bin
```

**Result: HTTP 413** with HTML body:

```html
<title>413 Request Entity Too Large</title>
<center>nginx/1.31.2</center>
```

Response headers:

- `Server: nginx/1.31.2`
- **No** `Content-Security-Policy` (Helmet)
- **No** `Access-Control-Allow-Origin`
- **No** `X-App-Layer: express`

Express/multer/upload controller **never run**.

### Threshold table

| Body size   | HTTP | Layer        |
|------------|------|--------------|
| 500000 B   | 401  | Express      |
| 1048576 B  | 401  | Express      |
| 1048577 B  | 413  | **nginx only** |
| 2097152 B  | 413  | **nginx only** |

Threshold = **1048576 bytes = nginx default `client_max_body_size 1m`**.

### Test 4 — Browser uploads use multipart (overhead matters)

The frontend sends `FormData` (`multipart/form-data`), not raw bytes. Boundary headers add ~156 bytes.

| File in FormData | Total HTTP body | HTTP | Layer   |
|------------------|-----------------|------|---------|
| 900000 B         | 900156 B        | 401  | Express |
| 1000000 B        | 1000156 B       | 401  | Express |
| 1048576 B        | 1048732 B       | 413  | **nginx** |
| 2097152 B (2 MiB)| ~2097308 B      | 413  | **nginx** |

So a **1 MiB file in the browser** can fail even though a **raw 1 MiB POST** succeeds — nginx counts the entire request body, including multipart framing.

### Test 5 — Express accepts large bodies when nginx is bypassed

Direct POST to local Node (no reverse proxy):

```bash
curl -X POST http://127.0.0.1:5001/api/files/upload --data-binary @2097152.bin
```

**Result: HTTP 401** with Helmet + CORS headers — **not 413**. The 2 MiB body reached Express; only auth blocked it (no cookie).

### Test 6 — Cloudflare / Apache ruled out

Production response headers for `api.twobrothersfreight.com`:

- `Server: nginx/1.31.2` only — no `cf-ray`, no `Apache`
- DNS A record: `212.200.123.31` (direct to host, not Cloudflare proxy)

## Request path (what happens today)

```
Browser (db.twobrothersfreight.com)
  → axios POST multipart (cross-origin)
  → nginx 1.31.2 on api.twobrothersfreight.com
       IF Content-Length > 1048576 → 413 HTML (STOPS HERE)
       ELSE → proxy to Node :5001
  → Express (helmet, cors, auth, multer, controller)
  → disk
```

## Why CORS appears in the browser

The nginx-generated 413 HTML response **does not include** `Access-Control-Allow-Origin`.

The browser reports a CORS error **after** the 413. CORS is **not** the primary cause.

When the body is ≤ 1 MiB, Express responds with CORS headers even on 401.

## Full layer trace (production, body > 1 MiB)

| Layer | Reached? | Evidence |
|-------|----------|----------|
| Browser | Yes | User sees `POST .../my-files/upload` in DevTools |
| Frontend (`MyFilesPage.jsx`) | Yes | Builds `FormData`, `api.post('/my-files/upload', formData)` |
| Axios (`client.js`) | Yes | Default config; no size cap; `withCredentials: true` |
| Network / TLS | Yes | Request reaches `212.200.123.31:443` |
| Cloudflare | **No** | No `cf-ray` header |
| Apache | **No** | No Apache server banner |
| **nginx 1.31.2** | **Yes — REJECTS HERE** | HTML 413, `<center>nginx/1.31.2</center>`, no Helmet, no CORS |
| Express / Helmet | **No** | Absent on 413 responses |
| CORS middleware | **No** | No `Access-Control-Allow-Origin` on nginx 413 |
| authMiddleware | **No** | Would return JSON 401 with CORS if reached |
| Multer | **No** | Would return JSON 413 `"File exceeds the 50MB upload limit"` |
| Upload controller | **No** | `UPLOAD_TRACE` logs would not fire |
| Storage / filesystem | **No** | Never invoked |

## Application limits (NOT the cause)

| Layer              | Limit   | Would produce                          |
|--------------------|---------|----------------------------------------|
| multer             | 50 MB   | JSON `{ message: "File exceeds the 50MB upload limit" }` + CORS |
| express json       | 50 MB   | Skipped for `multipart/form-data`      |
| My Files quota     | 50 GB   | HTTP 413 JSON from Express             |
| Vite dev proxy     | N/A prod | Production frontend calls API directly |
| Axios              | none    | —                                      |

None of these match HTML `nginx/1.31.2` 413 pages.

## Fix (production server — mandatory)

The example file `deploy/nginx-api.conf.example` is **not** the active config until deployed.

On the **API server**, find the loaded config:

```bash
nginx -T 2>/dev/null | grep -n client_max_body_size
```

Edit the **active** `server { }` block for `api.twobrothersfreight.com` and set:

```nginx
client_max_body_size 50M;
```

Inside the same block (or `location /`), ensure proxy to Node:

```nginx
location / {
    client_max_body_size 50M;
    proxy_pass http://127.0.0.1:5001;
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}
```

Reload:

```bash
nginx -t && nginx -s reload
```

## Verify fix

```bash
# Should return 401 (or 201 with auth), NOT 413 HTML
curl -s -D - -o /dev/null -X POST \
  https://api.twobrothersfreight.com/api/my-files/upload \
  -H "Origin: https://db.twobrothersfreight.com" \
  --data-binary @2097152.bin | grep -E "HTTP/|X-App-Layer|413"
```

Success indicators:

- HTTP 401 or 201 (not 413)
- Header `X-App-Layer: express`
- Header `Access-Control-Allow-Origin` on error responses from Express

Run `deploy/verify-upload-limits.sh` (or `.ps1` on Windows) after nginx reload.

# Anomix

API load testing and ML-powered anomaly detection platform. Send HTTP requests against any endpoint, measure latency distributions and throughput under concurrent load, and let the machine learning layer flag statistical outliers automatically.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Repository Layout](#repository-layout)
3. [Backend Setup](#backend-setup)
4. [Frontend Setup](#frontend-setup)
5. [Environment Variables Reference](#environment-variables-reference)
6. [ML Models](#ml-models)
7. [API Reference](#api-reference)
8. [Authorization Types](#authorization-types)
9. [Architecture Notes](#architecture-notes)
10. [Production Checklist](#production-checklist)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, verify the following are installed and accessible from your shell.

**Python**

Anomix requires Python 3.11 or higher. Python 3.14 is confirmed working. Check your version:

```bash
python --version
```

Do not use Python 3.10 or earlier. The type hint syntax used in `service.py` (`list[dict]`, `str | None`) requires 3.10 at minimum, but several dependency wheels only publish for 3.11+.

**Node.js**

The frontend build toolchain requires Node.js 18 or higher (LTS recommended):

```bash
node --version
npm --version
```

**Git**

```bash
git --version
```

---

## Repository Layout

```
PostmanAtHOme/
├── Backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── db.sqlite3                  # created on first migrate
│   ├── model/                      # trained .pkl files land here
│   │   ├── anomaly_model.pkl
│   │   ├── predictor_latency.pkl
│   │   ├── predictor_error.pkl
│   │   └── scaler.pkl
│   ├── anomix/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── apps/
│       ├── api/                    # thin REST views
│       ├── loadtest/               # aiohttp concurrent runner + models
│       ├── analytics/              # metrics snapshots + anomaly records
│       └── ml/                     # scikit-learn service, training script
└── Frontend/
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── components/
        │   ├── ui/                 # Badge, Button, Card, Panel
        │   ├── RequestBuilder.tsx
        │   ├── ResponseViewer.tsx
        │   ├── HistorySidebar.tsx
        │   └── Dashboard.tsx
        ├── hooks/
        │   └── useLoadTest.ts
        ├── pages/
        │   └── Home.tsx
        ├── services/
        │   └── api.ts
        └── types/
            └── index.ts
```

---

## Backend Setup

All commands below are run from the `Backend/` directory unless stated otherwise.

### Step 1 - Create and activate a virtual environment

**Windows (Command Prompt or PowerShell)**

```cmd
cd Backend
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux**

```bash
cd Backend
python -m venv venv
source venv/bin/activate
```

After activation your shell prompt should show `(venv)`. Every subsequent Python and pip command in this section must be run inside the activated environment. If you close the terminal, re-run the activate command before continuing.

### Step 2 - Install Python dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

The install should complete without errors. The core packages are:

- `django` 4.2 - web framework
- `djangorestframework` - REST API layer
- `django-cors-headers` - CORS middleware for the Vite dev server
- `aiohttp` - async HTTP client used by the load test runner
- `scikit-learn` - IsolationForest and GradientBoosting ML models
- `numpy` - numerical operations for ML pipeline
- `joblib` - model serialization (.pkl files)
- `python-dotenv` - reads `.env` file
- `whitenoise` - static file serving

If you encounter a wheel build failure on Windows (commonly for numpy or aiohttp), ensure you have the Microsoft C++ Build Tools installed and your pip is up to date.

### Step 3 - Configure environment variables

Copy the example file and edit it:

```bash
cp .env.example .env
```

For local development the defaults work without changes. See [Environment Variables Reference](#environment-variables-reference) for a description of every key.

### Step 4 - Run database migrations

```bash
python manage.py migrate
```

This creates `db.sqlite3` in the `Backend/` directory and applies all schema migrations, including the load test result tables and analytics tables. Run this command again any time you pull changes that include new migration files.

To verify the migration state:

```bash
python manage.py showmigrations
```

All entries should show `[X]`.

### Step 5 - Train the ML models (optional but recommended)

The ML models are not required for the application to run. If no trained models are found, Anomix falls back to statistical detection using Z-scores and fixed thresholds. However, the IsolationForest and GradientBoosting models provide meaningfully better anomaly detection and prediction accuracy once trained on synthetic data.

```bash
python -m apps.ml.train
```

Training takes approximately one to two minutes and writes four files to `Backend/model/`:

```
model/anomaly_model.pkl       # IsolationForest: detects anomalous request patterns
model/predictor_latency.pkl   # GradientBoosting: predicts latency at a given load level
model/predictor_error.pkl     # GradientBoosting: predicts error rate at a given load level
model/scaler.pkl              # StandardScaler: feature normalization parameters
```

These files are generated from synthetic data. In a production context you would periodically retrain on real traffic snapshots.

To check whether the models are loaded:

```bash
curl http://localhost:8000/api/ml/status/
```

### Step 6 - Start the development server

```bash
python manage.py runserver
```

The backend listens on `http://localhost:8000` by default. The Django admin is available at `http://localhost:8000/admin/` (create a superuser with `python manage.py createsuperuser` if needed).

To bind to a different port:

```bash
python manage.py runserver 8080
```

Leave this terminal running and proceed to the frontend setup in a second terminal.

---

## Frontend Setup

All commands below are run from the `Frontend/` directory.

### Step 1 - Install Node dependencies

```bash
cd Frontend
npm install
```

This installs React 19, Vite 7, Tailwind CSS 3, Recharts, Axios, and the TypeScript toolchain. The `node_modules` directory will be around 300-400 MB.

### Step 2 - Start the Vite development server

```bash
npm run dev
```

The dev server starts on `http://localhost:5173`. Vite proxies all requests beginning with `/api` to `http://localhost:8000`, so the frontend and backend communicate transparently without CORS issues during development.

The proxy is configured in `vite.config.ts`:

```ts
proxy: {
  "/api": {
    target: "http://localhost:8000",
    changeOrigin: true,
  },
},
```

If your Django backend runs on a different port, update `target` accordingly.

### Step 3 - Open the application

Navigate to `http://localhost:5173` in your browser.

The status indicator in the top-right corner shows a green dot when the backend is reachable. If it shows a red dot, verify the Django server is running and that the proxy target port matches.

---

## Environment Variables Reference

All variables are read from `Backend/.env`. The file is never committed to version control.

| Variable | Default | Description |
|---|---|---|
| `SECRET_KEY` | insecure dev key | Django secret key. Generate a production value with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DEBUG` | `True` | Set to `False` in production. Controls Django debug pages, CORS permissiveness, and error detail in API responses |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of hostnames Django will serve. Add your domain in production |
| `DATABASE_URL` | `sqlite:///db.sqlite3` | SQLite path or a full PostgreSQL DSN (`postgres://user:pass@host:5432/dbname`) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Comma-separated origins allowed to call the API. Ignored when `DEBUG=True` (all origins allowed in development) |
| `MODEL_PATH` | `model/model.h5` | Legacy key, not actively used by the scikit-learn pipeline. Keep as-is |
| `MAX_CONCURRENT_REQUESTS` | `50` | Upper bound on concurrent aiohttp workers per test run, regardless of what the client requests |
| `MAX_TOTAL_REQUESTS` | `1000` | Upper bound on total requests per test run |
| `REQUEST_TIMEOUT_SECONDS` | `30` | Default per-request timeout in seconds |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Redis connection string for the Celery broker (only needed if running background tasks) |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Redis connection string for Celery results |

**Security note:** Rotate `SECRET_KEY` before any public or shared deployment. A leaked secret key allows session forgery and signature bypass.

---

## ML Models

### How the ML pipeline works

The load test service collects per-request latency (ms), status codes, and error flags for every run. After a run completes, the analytics service extracts aggregate features (avg latency, P95, P99, throughput, error rate) and passes them to the ML service.

The ML service runs two detection strategies:

**Strategy 1 - Trained models (preferred)**

- `IsolationForest` scores the feature vector. A decision function value below the trained threshold is flagged as an anomaly.
- `GradientBoosting` regressors predict expected latency and error rate for a requested load level.

**Strategy 2 - Statistical fallback (always available)**

- Latency spike: P99 exceeds the average by a factor of 3 or more.
- High error rate: error rate exceeds 20%.
- Throughput instability: coefficient of variation of per-request latencies exceeds 1.5.

The fallback is automatic. You do not need to configure anything. The `/api/ml/status/` endpoint tells you which strategy is active.

### Retraining

Run the training script at any time:

```bash
cd Backend
python -m apps.ml.train
```

The script generates 6,000 synthetic samples with injected anomalies, fits the models, and overwrites the `.pkl` files. The Django server does not need to be restarted - the ML service loads models lazily on the first request after startup.

---

## API Reference

The base URL in development is `http://localhost:8000`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/test/` | List all test results (summary, no raw latencies) |
| `POST` | `/api/test/` | Run a load test synchronously |
| `GET` | `/api/test/<id>/` | Get a single result with full detail |
| `DELETE` | `/api/test/<id>/delete/` | Delete a test result and its config |
| `GET` | `/api/metrics/` | Aggregate metrics with time-series for the 20 most recent completed runs |
| `GET` | `/api/metrics/<id>/` | Metrics and time-series for a specific result |
| `POST` | `/api/predict/` | Predict latency and failure probability at a given load level |
| `GET` | `/api/anomaly/` | All anomaly records across all runs |
| `GET` | `/api/anomaly/<id>/` | Anomalies for a specific test result |
| `GET` | `/api/ml/status/` | ML model readiness and active detection strategy |

### POST /api/test/

Runs the load test and returns the full result. The request is synchronous - the response is not returned until all requests have completed and anomaly detection has run. Expect the response time to equal approximately the test duration.

Request body:

```json
{
  "url": "https://api.example.com/endpoint",
  "method": "GET",
  "request_count": 100,
  "concurrency": 10,
  "timeout_seconds": 30,
  "headers": {
    "Authorization": "Bearer your-token",
    "Accept": "application/json"
  },
  "body": null
}
```

Field constraints:

- `method`: one of `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
- `request_count`: 1 to 1000 (server enforces maximum regardless of value sent)
- `concurrency`: 1 to 50
- `timeout_seconds`: positive integer, applied per individual request
- `headers`: flat key-value object, passed directly to aiohttp
- `body`: any JSON value, sent as the request body for POST, PUT, PATCH only

Response includes all latency percentiles, throughput, error rate, status code distribution, detected anomalies, and a sample of the response body and headers from the first successful request.

### POST /api/predict/

```json
{
  "load_level": 200
}
```

Returns predicted latency (ms), predicted error rate (%), failure probability (0.0-1.0), confidence score, and the method used (`ml` or `statistical`).

### curl examples

Run a basic load test:

```bash
curl -s -X POST http://localhost:8000/api/test/ \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jsonplaceholder.typicode.com/posts/1",
    "method": "GET",
    "request_count": 50,
    "concurrency": 10,
    "timeout_seconds": 30,
    "headers": {},
    "body": null
  }' | python -m json.tool
```

Run a POST test with a request body:

```bash
curl -s -X POST http://localhost:8000/api/test/ \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpbin.org/post",
    "method": "POST",
    "request_count": 20,
    "concurrency": 5,
    "timeout_seconds": 30,
    "headers": {"Content-Type": "application/json"},
    "body": {"key": "value"}
  }' | python -m json.tool
```

Predict performance at 300 concurrent users:

```bash
curl -s -X POST http://localhost:8000/api/predict/ \
  -H "Content-Type: application/json" \
  -d '{"load_level": 300}' | python -m json.tool
```

---

## Authorization Types

Anomix supports four authentication schemes in the request builder. Credentials are injected into the `Authorization` header (or a custom header for API keys) before the load test config is sent to the backend. The backend passes them through to the target API verbatim.

### No Auth

No authentication header is added. Suitable for public endpoints.

### Bearer Token

Adds `Authorization: Bearer <token>` to every request.

Use this for APIs that issue JWTs or opaque access tokens. Paste the token directly into the Token field.

### API Key

Adds a custom header (`X-API-Key: <value>` or whatever name the target API expects). Set the key name and value in the Authorization tab.

The "Add To" selector offers Header or Query Params. If Query Params is selected, the key is not injected automatically; add it directly to the URL instead (e.g., `https://api.example.com/data?api_key=your-key`).

### Basic Auth

Adds `Authorization: Basic <base64(username:password)>` to every request.

The base64 encoding is performed client-side in the browser before the config is sent to the backend.

### OAuth 2.0

Two usage modes:

**Manual token entry**

Paste a valid access token into the Access Token field. The token is sent as `Authorization: Bearer <token>`. This is the recommended approach for load testing because it avoids repeated token fetches during the run.

**Auto-fetch via client credentials**

Fill in Token URL, Client ID, Client Secret, and optionally Scope, then click Get Token. The browser posts a `grant_type=client_credentials` request directly to the Token URL and extracts the `access_token` from the response. If the token endpoint does not allow cross-origin requests from the browser, you will need to obtain the token manually and paste it into the Access Token field.

Note that for load tests that take more than the token's `expires_in` duration, the token may expire mid-run. Obtain a token with a sufficient lifetime or use a non-expiring test credential.

---

## Architecture Notes

**Request flow**

```
Browser
  -> Vite dev server (localhost:5173)
    -> [proxy /api/*]
      -> Django (localhost:8000)
        -> aiohttp concurrent runner
          -> Target API (any external or internal URL)
```

The browser never contacts the target API directly. All HTTP traffic to the target goes through the Django backend via aiohttp. This means CORS restrictions on the target API do not apply to load test traffic, and the target URL can be anything reachable from the machine running Django, including localhost services on other ports.

**Load test execution**

The `run_load_test` function in `apps/loadtest/service.py` creates a new asyncio event loop per test run (Django runs synchronously; the event loop is isolated and discarded after each run). It uses an `asyncio.Semaphore` to limit concurrency to the configured value. All requests are dispatched as a single `asyncio.gather` batch. The first request in the batch also captures the response body and headers for display in the UI.

**Anomaly detection**

Detection runs synchronously after each test completes, inside the same request/response cycle. It takes milliseconds. If ML models are present they are used; otherwise the statistical fallback activates. Anomaly records are persisted to the database and returned as part of the test result response.

**Views stay thin**

All business logic lives in `service.py` files. Views validate input, call services, persist results, and serialize responses. They contain no computation.

**Frontend state management**

There is no global state manager (no Redux, no Zustand). State lives in the `useLoadTest` hook and is passed down as props. The Dashboard component is lazily mounted on first tab visit and kept alive in the DOM with CSS visibility toggling to prevent re-fetching metrics on every tab switch.

---

## Production Checklist

The following changes are required before exposing Anomix outside a local development machine.

**Django**

1. Set `DEBUG=False` in `.env`.
2. Generate a new `SECRET_KEY` and store it in a secret manager, not in the `.env` file committed to version control.
3. Set `ALLOWED_HOSTS` to your actual domain name.
4. Set `CORS_ALLOWED_ORIGINS` to the exact frontend origin. With `DEBUG=False` the fallback `CORS_ALLOW_ALL_ORIGINS = True` is inactive.
5. Switch `DATABASE_URL` to a PostgreSQL DSN. Install `psycopg2-binary` (uncomment in `requirements.txt`).
6. Run `python manage.py collectstatic` and serve `staticfiles/` from a CDN or web server.
7. Use a production WSGI server (gunicorn, uWSGI) behind a reverse proxy (nginx). Do not use `manage.py runserver` in production.

**Frontend**

1. Build the production bundle: `npm run build`. Output lands in `Frontend/dist/`.
2. Serve `dist/` from your CDN or web server.
3. Set the API base URL appropriately if the backend is on a different domain. Update `baseURL` in `src/services/api.ts` or proxy through your web server.

**Load test limits**

The backend enforces `MAX_CONCURRENT_REQUESTS` and `MAX_TOTAL_REQUESTS` at the server level. Adjust these in `.env` based on the capacity of the machine running Django and your network environment. Running 1,000 concurrent requests against a rate-limited external API from a single machine is likely to trigger IP blocks or 429 responses; configure test parameters accordingly.

---

## Troubleshooting

**Backend does not start: `ModuleNotFoundError`**

The virtual environment is not activated. Run `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (macOS/Linux) and try again.

**Frontend shows a red connection dot**

The Django backend is not running, or is running on a port other than 8000. Verify with `curl http://localhost:8000/api/ml/status/`. If the port differs, update the proxy target in `vite.config.ts`.

**`migrate` fails with `no such table`**

Delete `db.sqlite3` and re-run `python manage.py migrate`. This happens if migrations were applied in the wrong order or the database file is corrupt.

**ML models not found after training**

Verify the `model/` directory exists inside `Backend/` and that the training script completed without errors. The expected files are `anomaly_model.pkl`, `predictor_latency.pkl`, `predictor_error.pkl`, and `scaler.pkl`. The `/api/ml/status/` endpoint will report `statistical_fallback` if any of these are missing.

**Requests to the target API time out**

The `timeout_seconds` value applies per individual HTTP request. If the target API is slow or rate-limited, increase `timeout_seconds` in the Load Config tab. Alternatively, reduce `request_count` and `concurrency` to lighten the load.

**Response body shows "No response body was captured"**

The first request in the batch did not return a successful (2xx) response, so no body was stored. Check the Status Codes section in the Metrics tab to see what status codes were returned. If all requests failed, verify the URL, method, and authorization settings are correct.

**`CORS` errors in browser console**

This should not occur in development because Vite proxies all `/api` traffic. If you see CORS errors, your browser is contacting the backend directly rather than through the proxy. Verify the frontend is running through `npm run dev` and that you are accessing the app at `http://localhost:5173`, not at `http://localhost:8000`.

**Port 5173 or 8000 already in use**

Find and stop the process using the port, or start on an alternate port:

```bash
# Django on port 8001
python manage.py runserver 8001

# Update vite.config.ts proxy target to http://localhost:8001, then:
npm run dev -- --port 5174
```

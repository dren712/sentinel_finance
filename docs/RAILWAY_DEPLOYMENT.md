# Deploying Sentinel Finance on Railway

Sentinel Finance is containerized with a production multi-stage [`Dockerfile`](file:///Users/darshangaikwad/Desktop/stocklana/Dockerfile) that produces an ultra-lightweight standalone Next.js server (~150MB image size) with sub-100ms cold starts.

---

## 1. Quick Deploy via GitHub (Recommended)

1. Go to [railway.app](https://railway.app/) and create a new project.
2. Select **Deploy from GitHub repo** and choose `sentinel_finance` (or your fork).
3. Railway automatically detects [`railway.json`](file:///Users/darshangaikwad/Desktop/stocklana/railway.json) and uses [`Dockerfile`](file:///Users/darshangaikwad/Desktop/stocklana/Dockerfile).
4. Click **Deploy**.

---

## 2. Quick Deploy via Railway CLI

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login to your Railway account
railway login

# 3. Link or create a project
railway link # or railway init

# 4. Deploy immediately
railway up
```

---

## 3. Environment Variables (Railway Dashboard)

In your Railway service settings under **Variables**, you can configure:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | Auto | `3000` | Automatically injected by Railway |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | No | `devnet` | Solana cluster (`devnet` or `mainnet-beta`) |
| `NEXT_PUBLIC_SOLANA_RPC` | No | `https://api.devnet.solana.com` | Browser RPC URL (e.g. Helius / QuickNode) |
| `SOLANA_RPC_URL` | No | `https://api.devnet.solana.com` | Server-side RPC URL |
| `NEXT_PUBLIC_SENTINEL_PROGRAM_ID` | No | `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` | On-chain Sentinel Program ID |
| `SENTINEL_PROGRAM_ID` | No | `3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH` | Server-side Program ID |
| `OPENAI_API_KEY` | Optional | *Unset* | If set, enables real OpenAI GPT-4o agent proposals. If unset, uses deterministic Demo Mode with clear banner. |
| `DATABASE_URL` | Optional | *Unset* | PostgreSQL connection string for persistent decision logs. If unset, uses built-in in-memory fallback. |

---

## 4. Healthcheck & Liveness

Railway automatically queries the built-in health check:
```http
GET /api/health
```

Returns HTTP 200 with complete diagnostics:
```json
{
  "status": "ok",
  "solana": "connected",
  "postgres": "not_configured",
  "llm": "demo_fallback",
  "cluster": {
    "environment": "DEVNET",
    "solanaCluster": "devnet",
    "sentinelProgramId": "3TVEhBHwQNoEU1VwNNdzDCVyFBQ2At77n9uTqRKz8AgH"
  }
}
```

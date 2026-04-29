# Deploying MyNefesh

Frontend → Vercel | Backend → Render

---

## 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/mynefesh.git
git push -u origin master
```

---

## 2. Database setup (Neon)

1. Sign up at https://neon.tech (free tier is persistent)
2. Create a new project — name it `mynefesh`
3. From the project dashboard, go to **Connection Details**
4. Copy the **Connection string** (looks like `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
5. You'll use this as `DATABASE_URL` on Render (step 3) and locally in `server/.env`

**Run migrations once after connecting:**
```bash
cd server
DATABASE_URL=<your-neon-url> npm run db:migrate
DATABASE_URL=<your-neon-url> npm run db:seed
```

---

## 3. Deploy Backend to Render

1. Go to https://render.com → **New → Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Environment variables (add under **Environment**):
   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | your Anthropic key |
   | `DATABASE_URL` | your Neon connection string from step 2 |
   | `ALLOWED_ORIGIN` | your Vercel URL — set this after Vercel deploy |
   | `NODE_ENV` | `production` |
5. Click **Create Web Service**. Note the service URL (e.g. `https://mynefesh-api.onrender.com`).

---

## 3. Deploy Frontend to Vercel

1. Go to https://vercel.com → **Add New → Project**
2. Import your GitHub repo
3. Settings (Vercel auto-detects most from `vercel.json`):
   - **Framework Preset:** Vite (or leave auto-detect)
   - The `vercel.json` at repo root handles build command + output dir automatically
4. Environment variables (add under **Environment Variables**):
   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | your Render URL from step 2 (e.g. `https://mynefesh-api.onrender.com`) |
5. Click **Deploy**. Note the Vercel URL.

---

## 4. Wire them together

After both are deployed:
1. Go to Render → your web service → **Environment**
2. Update `ALLOWED_ORIGIN` to your actual Vercel URL
3. Click **Save Changes** — Render will redeploy automatically

---

## Local development

```bash
# Install all deps
npm run install:all

# Copy env files and fill in values
cp server/.env.example server/.env
cp client/.env.example client/.env.local

# Run both servers concurrently
npm run dev
```

Client runs on http://localhost:5173  
Server runs on http://localhost:3001

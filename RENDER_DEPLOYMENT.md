# Render Deployment Guide

## Quick Deploy to Render

### Step 1: Push to GitHub

```powershell
cd c:\Users\user\Documents\applier

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - production ready"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/applier.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Render

1. Go to https://render.com and sign in
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `applier-backend`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free

### Step 3: Add Environment Variables

In Render dashboard, add these environment variables:

```
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb+srv://pranaykuduka9_db_user:VuhvMM9cVxXrVRAo@cluster0.slg4odb.mongodb.net/applier
JWT_SECRET=972d3f05a1982380ebcca8a3c29f756decd80bc039ce8b1e4e8d5b4add50eb30
JWT_REFRESH_SECRET=55e68dc32ddfe79cba1d51d126ea76d9bee0f7629aa633b2064a12b412057eb0
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
ALLOWED_ORIGINS=chrome-extension://YOUR_EXTENSION_ID_HERE
```

**Important**: Don't include the `.env` file comments - just the key=value pairs above.

### Step 4: Deploy

Click **Create Web Service** - Render will:
1. Clone your repo
2. Install dependencies
3. Start your server
4. Give you a URL like: `https://applier-backend.onrender.com`

### Step 5: Test Your API

```powershell
# Health check
curl https://applier-backend.onrender.com/health

# Should return: {"ok":true,"timestamp":"..."}
```

### Step 6: Update Extension

In `extension/popup.js`, update line 17:
```javascript
const DEFAULT_API_BASE = "https://applier-backend.onrender.com";
```

### Step 7: Update CORS (After Extension Published)

After publishing to Chrome Web Store, update in Render dashboard:
```
ALLOWED_ORIGINS=chrome-extension://your-actual-extension-id
```

Then click **Manual Deploy** → **Deploy latest commit**

---

## ✅ Render-Specific Notes

**Free Tier:**
- ✅ Free for 750 hours/month
- ✅ Sleeps after 15 min inactivity (wakes on request)
- ✅ Automatic HTTPS
- ✅ Auto-deploys on git push

**First Request After Sleep:**
- Takes ~30 seconds (spinning up)
- Show loading state in extension

**Logs:**
- View in Render dashboard → Logs tab
- Real-time monitoring

---

## 🐛 Troubleshooting

**Build Failed:**
- Check Root Directory is set to `backend`
- Verify Build Command is `npm install`

**App Won't Start:**
- Check Start Command is `node server.js`
- View logs for error details

**MongoDB Connection Error:**
- Verify MONGO_URI in environment variables
- Check MongoDB Atlas IP whitelist (add 0.0.0.0/0)

**CORS Errors:**
- Update ALLOWED_ORIGINS with your extension ID
- Redeploy after changing

---

**Ready to deploy!** Everything is configured for Render.

# Applier - Production Deployment Guide


### Step 3: Test Backend Locally

```powershell
cd backend
npm install
npm start
```

Test health endpoint:
```powershell
curl http://localhost:4000/health
```

Should return: `{"ok":true,"timestamp":"..."}`

### Step 4: Deploy Backend

**Option A: Heroku (Recommended)**
```powershell
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create applier-backend-yourname

# Set environment variables (use your generated secrets)
heroku config:set MONGO_URI="mongodb+srv://pranaykuduka9_db_user:VuhvMM9cVxXrVRAo@cluster0.slg4odb.mongodb.net/?appName=Cluster0"
heroku config:set JWT_SECRET="your-generated-secret-here"
heroku config:set JWT_REFRESH_SECRET="your-generated-refresh-secret-here"
heroku config:set NODE_ENV=production
heroku config:set JWT_EXPIRES_IN=7d
heroku config:set JWT_REFRESH_EXPIRES_IN=30d
heroku config:set ALLOWED_ORIGINS="chrome-extension://YOUR_EXTENSION_ID"

# Deploy
cd backend
git init
git add .
git commit -m "Initial deployment"
heroku git:remote -a applier-backend-yourname
git push heroku main

# Your API URL: https://applier-backend-yourname.herokuapp.com
```

**Option B: Railway**
1. Go to https://railway.app
2. Sign in with GitHub
3. New Project → Deploy from GitHub repo
4. Select your repository
5. Add environment variables in Railway dashboard:
   - MONGO_URI
   - JWT_SECRET
   - JWT_REFRESH_SECRET
   - NODE_ENV=production
   - ALLOWED_ORIGINS
6. Deploy (automatic)

**Option C: Render**
1. Go to https://render.com
2. New → Web Service
3. Connect GitHub repo
4. Build command: `cd backend && npm install`
5. Start command: `cd backend && node server.js`
6. Add environment variables
7. Deploy

### Step 5: Update Extension with Production API

Update `extension/popup.js`:
```javascript
const DEFAULT_API_BASE = "https://your-api-domain.herokuapp.com"; // Your Heroku/Railway URL
```

### Step 6: Package Extension

```powershell
cd extension
Compress-Archive -Path * -DestinationPath ../applier-extension.zip -Force
```

### Step 7: Publish to Chrome Web Store

1. Go to https://chrome.google.com/webstore/devconsole
2. Pay $5 developer fee (one-time)
3. New Item → Upload `applier-extension.zip`
4. Fill in listing info:
   - **Name**: Applier - AI Job Application Assistant
   - **Description**: Smart job discovery and application with AI-powered matching
   - **Category**: Productivity
   - **Screenshots**: Required (1280x800 recommended)
5. Submit for review (1-3 days typically)

### Step 8: Update CORS with Extension ID

After extension is published, you'll get an Extension ID (e.g., `abcdefghijklmnopqrstuvwxyz123456`).

Update your backend environment:
```powershell
# Heroku
heroku config:set ALLOWED_ORIGINS="chrome-extension://abcdefghijklmnopqrstuvwxyz123456"

# Railway/Render
# Update in dashboard
```

---

## 🔒 Security Checklist

- [ ] JWT_SECRET changed from default (use generated random string)
- [ ] JWT_REFRESH_SECRET different from JWT_SECRET
- [ ] MONGO_URI uses strong password
- [ ] NODE_ENV=production
- [ ] ALLOWED_ORIGINS restricted to your extension ID only
- [ ] .env file not committed to git (.gitignore configured)
- [ ] Backend deployed with HTTPS (automatic on Heroku/Railway/Render)

---

## 🧪 Testing Production

### Test Backend
```powershell
# Health check
curl https://your-api-domain.com/health

# Signup
curl -X POST https://your-api-domain.com/api/auth/signup -H "Content-Type: application/json" -d '{\"email\":\"test@example.com\",\"password\":\"testpass123\"}'

# Should return access token and refresh token
```

### Test Extension
1. Install unpacked extension in Chrome
2. Test job analysis on a real job posting
3. Test autofill functionality
4. Verify analytics tracking

---

## 📊 Monitoring

### Check Backend Logs
```powershell
# Heroku
heroku logs --tail -a applier-backend-yourname

# Railway/Render
# View in dashboard
```

### Monitor Uptime
- Use https://uptimerobot.com (free)
- Monitor: https://your-api-domain.com/health
- Get alerts if API goes down

---

## 🐛 Troubleshooting

### CORS Errors
- Verify ALLOWED_ORIGINS includes your extension ID
- Format: `chrome-extension://exact-extension-id`
- No trailing slashes

### MongoDB Connection Failed
- Check MONGO_URI is correct
- Verify MongoDB Atlas IP whitelist (add 0.0.0.0/0 for "allow all")
- Test connection in MongoDB Compass

### JWT Token Errors
- Ensure JWT_SECRET and JWT_REFRESH_SECRET are set
- Check they're different values
- Verify they're at least 32 characters

### Extension Can't Connect
- Check popup.js has correct API URL
- Verify HTTPS is used (not HTTP in production)
- Check Network tab in Chrome DevTools for errors

---

## 💰 Cost Estimate

**Free Tier:**
- MongoDB Atlas: Free (M0, 512MB)
- Heroku: Free tier deprecated, use Railway
- Railway: $5/month (500 hours free)
- Chrome Web Store: $5 one-time
- **Total**: ~$10 first month, $5/month after

**Recommended Production:**
- MongoDB Atlas: $9/month (M10, 2GB)
- Railway/Render: $7-20/month
- Domain (optional): $12/year
- **Total**: ~$20-30/month

---

## 📞 Next Steps

1. ✅ Generate JWT secrets (Step 1)
2. ✅ Update .env file (Step 2)
3. ⏳ Test locally (Step 3)
4. ⏳ Deploy backend (Step 4)
5. ⏳ Update extension API URL (Step 5)
6. ⏳ Package extension (Step 6)
7. ⏳ Publish to Chrome Web Store (Step 7)
8. ⏳ Update CORS with extension ID (Step 8)

**You're ready to deploy!** Start with Step 1.

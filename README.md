# 🚗 Driver Coordination System - Free Proof of Concept

A complete, production-ready prototype that you can run **100% FREE** on your local computer. No cloud costs, no API keys needed!

## ✨ Features

### Manager Dashboard
- ✅ Create and track pickup/delivery jobs
- ✅ Real-time driver locations on map (OpenStreetMap)
- ✅ Live job status updates via WebSocket
- ✅ Analytics dashboard (jobs, earnings, driver stats)
- ✅ Beautiful, responsive UI

### Driver App
- ✅ Mobile-friendly web interface
- ✅ 30-second countdown job notifications
- ✅ Accept/decline jobs with cascade logic
- ✅ Real-time location sharing
- ✅ Earnings tracker
- ✅ Job history

### Backend
- ✅ Geolocation-based driver matching algorithm
- ✅ Automatic notification cascade (30-second timeout)
- ✅ WebSocket for real-time updates
- ✅ SQLite database (no setup needed)
- ✅ RESTful API

## 🎯 Zero-Cost Technology Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Backend | Node.js + Express | **FREE** |
| Database | SQLite | **FREE** |
| Real-time | WebSocket | **FREE** |
| Maps | OpenStreetMap + Leaflet | **FREE** |
| Frontend | HTML/CSS/JS | **FREE** |
| Hosting | Run locally | **FREE** |

**Total Monthly Cost: ₹0** 🎉

## 📋 Prerequisites

You only need **Node.js** installed on your computer:

1. Download Node.js from: https://nodejs.org/
2. Choose LTS version (v20.x recommended)
3. Install it (takes 2 minutes)
4. Verify: Open terminal and type `node --version`

That's it! No database setup, no cloud accounts, no API keys.

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies

Open terminal/command prompt and run:

```bash
cd driver-coordination-poc
npm install
```

This will install all required packages automatically.

### Step 2: Start the Server

```bash
npm start
```

You should see:

```
╔════════════════════════════════════════════════╗
║  Driver Coordination POC - Server Running!     ║
╚════════════════════════════════════════════════╝

📱 Manager Dashboard: http://localhost:3000/manager.html
🚗 Driver App: http://localhost:3000/driver.html

Demo Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manager: 9876543210 / demo123
Driver:  9876543201 / driver123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 3: Test the System

**Open two browser windows:**

1. **Manager Dashboard**: http://localhost:3000/manager.html
   - Login: `9876543210` / `demo123`

2. **Driver App**: http://localhost:3000/driver.html
   - Login: `9876543201` / `driver123`

**Try it out:**

1. In Driver App: Toggle status to "Online"
2. In Manager Dashboard: Create a new job
3. Watch the magic happen:
   - Driver receives notification with 30-second timer
   - If driver accepts → Manager sees assignment
   - If driver declines/times out → Next nearest driver gets notified
   - Real-time location updates on map

## 📱 Demo Accounts

The system comes pre-loaded with sample data:

**Manager Account:**
- Phone: `9876543210`
- Password: `demo123`

**Driver Accounts:**
- Driver 1: `9876543201` / `driver123` (Rajesh Kumar)
- Driver 2: `9876543202` / `driver123` (Amit Sharma)
- Driver 3: `9876543203` / `driver123` (Priya Patel)
- Driver 4: `9876543204` / `driver123` (Suresh Yadav)
- Driver 5: `9876543205` / `driver123` (Neha Singh)

## 🎨 Testing Scenarios

### Scenario 1: Happy Path
1. Login as Driver 1 → Toggle Online
2. Login as Manager → Create job
3. Driver 1 receives notification → Accept
4. Manager sees job assigned
5. Driver marks as "Picked Up" → "Delivered"
6. Job completed!

### Scenario 2: Cascade Logic
1. Login as Driver 1 & Driver 2 → Both Online
2. Login as Manager → Create job
3. Driver 1 receives notification → Wait 30 seconds
4. Notification auto-declines
5. Driver 2 receives notification → Accept
6. Job assigned to Driver 2!

### Scenario 3: Multiple Jobs
1. Login as 3 drivers → All Online
2. Login as Manager → Create 3 jobs quickly
3. Watch different drivers get different jobs
4. See real-time updates on map

## 🗂️ Project Structure

```
driver-coordination-poc/
├── server.js              # Backend API + WebSocket server
├── package.json           # Dependencies
├── coordination.db        # SQLite database (auto-created)
└── public/
    ├── manager.html       # Manager dashboard
    └── driver.html        # Driver mobile app
```

## 🔧 Customization Guide

### Add More Drivers

Edit `server.js`, find this section (around line 100):

```javascript
const driverLocations = [
  { name: 'Rajesh Kumar', phone: '9876543201', lat: 18.5204, lng: 73.8567 },
  // Add more drivers here
  { name: 'Your Name', phone: '9999999999', lat: 18.5204, lng: 73.8567 },
];
```

Delete `coordination.db` and restart server to recreate with new drivers.

### Change Map Center

Edit `manager.html` and `driver.html`, find:

```javascript
map = L.map('map').setView([18.5204, 73.8567], 13);
```

Replace coordinates with your city:
- Mumbai: `[19.0760, 72.8777]`
- Delhi: `[28.6139, 77.2090]`
- Bangalore: `[12.9716, 77.5946]`

### Modify Job Earnings

Edit `server.js`, find:

```javascript
estimated_earnings: Math.round(job.estimated_distance * 50) // ₹50 per km
```

Change `50` to your desired rate per kilometer.

## 📊 Features Walkthrough

### Manager Dashboard

**Create Job:**
- Select job type (pickup/delivery/transfer)
- Enter addresses (any text works in POC)
- Add car details
- Set priority
- Click "Create Job"

**Monitor Jobs:**
- See all active jobs in real-time
- View assigned driver details
- Track job status updates
- See estimated distance

**Driver Map:**
- View all online drivers on map
- Green markers = online
- Gray markers = offline
- Click markers for driver details

### Driver App

**Online/Offline Toggle:**
- Turn on to receive job notifications
- Auto-offline after 2 hours of inactivity

**Job Notification:**
- Full-screen alert with job details
- 30-second countdown timer
- Shows pickup/dropoff/distance/earnings
- Accept or Decline

**Active Job:**
- See pickup and dropoff locations on map
- Mark as "Picked Up" at pickup location
- Mark as "Delivered" at dropoff location
- Earn money upon completion

**Earnings Tracker:**
- Today's earnings
- Total jobs completed
- Average rating

## 🌐 API Endpoints

All endpoints run on `http://localhost:3000/api`

### Authentication
- `POST /auth/login` - Login (manager or driver)

### Jobs (Manager)
- `POST /jobs` - Create new job
- `GET /jobs` - List all jobs
- `GET /jobs/:id` - Get job details
- `DELETE /jobs/:id` - Cancel job

### Jobs (Driver)
- `POST /jobs/:id/accept` - Accept job
- `POST /jobs/:id/decline` - Decline job
- `POST /jobs/:id/pickup` - Mark as picked up
- `POST /jobs/:id/complete` - Mark as completed

### Drivers
- `GET /drivers` - List all drivers
- `POST /drivers/location` - Update location
- `POST /drivers/availability` - Toggle online/offline

### Analytics
- `GET /analytics/summary` - Get statistics

## 🔌 WebSocket Events

Connect to: `ws://localhost:3000?userId=<user_id>`

**Manager receives:**
- `JOB_ASSIGNED` - When driver accepts job
- `JOB_STATUS_UPDATE` - Status changes
- `DRIVER_LOCATION_UPDATE` - Real-time location

**Driver receives:**
- `JOB_NOTIFICATION` - New job available

## 🛠️ Troubleshooting

### "Port 3000 already in use"

Close other apps using port 3000, or change port in `server.js`:

```javascript
const PORT = 3001; // Change to any available port
```

### Database is locked

Stop the server (`Ctrl + C`) and restart it.

### Map not loading

Check your internet connection - OpenStreetMap tiles need internet.

### Jobs not appearing

1. Make sure driver is "Online"
2. Check WebSocket connection in browser console
3. Refresh both manager and driver pages

## 📈 Next Steps: Turning This Into Production

### Phase 1: Real Mobile Apps
- Use React Native to convert `driver.html` into native iOS/Android app
- Estimated effort: 2-3 weeks

### Phase 2: Real Maps & Geolocation
- Integrate Google Maps API for accurate routing
- Use device GPS for real location tracking
- Cost: ₹5,000-20,000/month

### Phase 3: Real Push Notifications
- Integrate Firebase Cloud Messaging
- Works even when app is closed
- Cost: Free for reasonable usage

### Phase 4: Cloud Deployment
- Deploy to AWS/Google Cloud/DigitalOcean
- PostgreSQL instead of SQLite
- Cost: ₹9,000-26,000/month

### Phase 5: Production Features
- Payment integration (Razorpay/Stripe)
- SMS notifications (Twilio)
- Advanced analytics
- Driver ratings & reviews
- Multi-showroom support

## 💡 Learning Resources

### Improve This Code
- **Node.js Tutorial**: https://nodejs.dev/learn
- **Express.js Guide**: https://expressjs.com/
- **WebSocket Tutorial**: https://javascript.info/websocket
- **React Native**: https://reactnative.dev/

### Build Your Own Features
- Add driver ratings system
- Implement payment tracking
- Create admin panel
- Add SMS notifications
- Build customer tracking portal

## 📝 License

This is a free proof-of-concept for educational and testing purposes.
Feel free to modify, extend, and use it for your business!

## 🤝 Support

Having issues? Want to add features?

1. Check the troubleshooting section above
2. Review the code comments in `server.js`
3. Test with provided demo accounts first
4. Make sure Node.js is properly installed

## 🎉 Success Metrics

After running this POC, you should be able to:

✅ Understand the complete system architecture
✅ See driver matching algorithm in action
✅ Experience 30-second cascade notifications
✅ View real-time WebSocket updates
✅ Test the entire job lifecycle
✅ Evaluate if this meets your business needs
✅ Decide on next steps (mobile app, production, etc.)

---

**Ready to Start? Run `npm install` and then `npm start`!**

Questions? Check the code - it's well-commented and easy to understand! 🚀

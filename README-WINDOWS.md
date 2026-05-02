# 🚗 Driver Coordination System - Windows Edition (No Build Tools!)

**This version works on Windows WITHOUT Visual Studio or any build tools!**

## ✅ What's Fixed

- ❌ Removed `better-sqlite3` (requires Visual Studio)
- ✅ Uses simple JSON file database instead
- ✅ Works instantly on Windows
- ✅ No compilation needed

## 🚀 Quick Start (3 Steps)

### Step 1: Delete Old Files

If you already have the `Driverportal` folder:

1. Close the Command Prompt
2. Delete the `node_modules` folder inside `Driverportal`
3. Delete these files from the project:
   - `package.json`
   - `server.js`
4. Replace them with the NEW files I'm giving you

### Step 2: Install Dependencies

Open Command Prompt in your project folder:

```bash
cd C:\Users\aagam\OneDrive\Desktop\Driverportal
npm install
```

This time it should complete in **10-20 seconds** with NO errors!

### Step 3: Run the Server

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
```

## 🎯 Open and Test

**Open your browser to:**
- Manager: http://localhost:3000/manager.html
- Driver: http://localhost:3000/driver.html

**Login with:**
- Manager: `9876543210` / `demo123`
- Driver: `9876543201` / `driver123`

## 📊 What Changed?

| Old Version | New Version |
|-------------|-------------|
| SQLite database (needs C++ compiler) | JSON file database (pure JavaScript) |
| `better-sqlite3` package | Built-in `fs` module |
| Requires Visual Studio | Works instantly |
| `coordination.db` file | `database.json` file |

## ✨ Everything Else is Same!

- ✅ Same features
- ✅ Same UI
- ✅ Same functionality
- ✅ Same real-time updates
- ✅ Same cascade logic

## 🗂️ Database File

All data is stored in `database.json` - you can:
- Open it in Notepad to see your data
- Delete it to reset everything
- Back it up by copying the file

## 💡 How It Works Now

**Instead of:**
```javascript
// Old: SQLite (needs compilation)
const db = new Database('coordination.db');
db.prepare('SELECT * FROM users').all();
```

**We use:**
```javascript
// New: Simple JSON (no compilation)
let db = { users: [], jobs: [] };
fs.writeFileSync('database.json', JSON.stringify(db));
```

Same functionality, zero compilation!

## 🎉 Test It Now

1. Open Manager Dashboard → Login
2. Create a job
3. Open Driver App → Login → Toggle Online
4. Watch the notification appear!

## ⚙️ Troubleshooting

### "Cannot find module 'express'"

Run: `npm install` again

### "Port 3000 already in use"

Close the other app or change port in `server.js`:
```javascript
const PORT = 3001; // Change to any port
```

### Want to reset everything?

Delete `database.json` and restart the server - it will recreate with demo data!

---

**Ready? Replace the files and run `npm install`!** 🚀

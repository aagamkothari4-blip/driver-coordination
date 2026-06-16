const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Photo upload storage
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `driver-${req.params.driverId}-${Date.now()}${ext}`);
  }
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple JSON file-based database (no SQLite needed!)
const DB_FILE = 'database.json';

// Initialize database structure
let db = {
  users: [],
  drivers: [],
  jobs: [],
  job_queue: []
};

// Load database from file if exists
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    console.log('✓ Database loaded from file');
  } catch (error) {
    console.log('⚠ Could not load database, starting fresh');
  }
}

// Save database to file
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Initialize with sample data if empty
if (db.users.length === 0) {
  // Create sample manager
  const managerId = uuidv4();
  db.users.push({
    id: managerId,
    role: 'manager',
    name: 'Demo Manager',
    phone: '9876543210',
    password: 'demo123',
    created_at: new Date().toISOString()
  });

  // Create sample drivers
  const driverLocations = [
    { name: 'Rajesh Kumar', phone: '9876543201', lat: 18.5204, lng: 73.8567 },
    { name: 'Amit Sharma', phone: '9876543202', lat: 18.5314, lng: 73.8446 },
    { name: 'Priya Patel', phone: '9876543203', lat: 18.5074, lng: 73.8077 },
    { name: 'Suresh Yadav', phone: '9876543204', lat: 18.5362, lng: 73.8954 },
    { name: 'Neha Singh', phone: '9876543205', lat: 18.4929, lng: 73.8278 }
  ];

  driverLocations.forEach(driver => {
    const userId = uuidv4();
    const driverId = uuidv4();
    
    db.users.push({
      id: userId,
      role: 'driver',
      name: driver.name,
      phone: driver.phone,
      password: 'driver123',
      created_at: new Date().toISOString()
    });
    
    db.drivers.push({
      id: driverId,
      user_id: userId,
      availability_status: 'online',
      current_lat: driver.lat,
      current_lng: driver.lng,
      acceptance_rate: 0,
      total_jobs: 0,
      average_rating: 0
    });
  });

  saveDB();
  console.log('✓ Sample data created');
}

// WebSocket connections storage
const connections = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const userId = url.searchParams.get('userId');
  
  if (userId) {
    connections.set(userId, ws);
    console.log(`WebSocket connected: ${userId}`);
  }

  ws.on('close', () => {
    connections.delete(userId);
    console.log(`WebSocket disconnected: ${userId}`);
  });
});

// Broadcast message to specific user
function sendToUser(userId, data) {
  const ws = connections.get(userId);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Driver matching algorithm
function findNearestDrivers(pickupLat, pickupLng) {
  const onlineDrivers = db.drivers
    .filter(d => d.availability_status === 'online')
    .map(driver => {
      const user = db.users.find(u => u.id === driver.user_id);
      return {
        ...driver,
        name: user ? user.name : 'Unknown',
        distance: calculateDistance(pickupLat, pickupLng, driver.current_lat, driver.current_lng)
      };
    });

  // Sort by distance, then by acceptance rate
  onlineDrivers.sort((a, b) => {
    if (Math.abs(a.distance - b.distance) < 0.5) {
      return b.acceptance_rate - a.acceptance_rate;
    }
    return a.distance - b.distance;
  });

  return onlineDrivers;
}

// Cascade notification logic with 30-second timeout
const cascadeTimers = new Map();

function startCascade(jobId) {
  const queue = db.job_queue.filter(q => q.job_id === jobId).sort((a, b) => a.position - b.position);
  
  if (queue.length === 0) {
    console.log(`No drivers available for job ${jobId}`);
    return;
  }

  let currentIndex = 0;

  function notifyNextDriver() {
    if (currentIndex >= queue.length) {
      // All drivers exhausted
      const job = db.jobs.find(j => j.id === jobId);
      if (job) job.status = 'unassigned';
      saveDB();
      console.log(`Job ${jobId} unassigned - all drivers declined`);
      return;
    }

    const current = queue[currentIndex];
    
    // Mark as notified
    current.notified_at = new Date().toISOString();
    saveDB();

    // Get job details
    const job = db.jobs.find(j => j.id === jobId);
    if (!job) return;
    
    // Send notification to driver
    sendToUser(current.driver_id, {
      type: 'JOB_NOTIFICATION',
      job: {
        id: job.id,
        pickup_address: job.pickup_address,
        dropoff_address: job.dropoff_address,
        pickup_lat: job.pickup_lat,
        pickup_lng: job.pickup_lng,
        dropoff_lat: job.dropoff_lat,
        dropoff_lng: job.dropoff_lng,
        car_details: job.car_details,
        estimated_distance: job.estimated_distance,
        estimated_earnings: Math.round(job.estimated_distance * 50) // ₹50 per km
      },
      timeout: 30000
    });

    console.log(`Notified driver ${current.driver_id} for job ${jobId} (position ${currentIndex + 1}/${queue.length})`);

    // Set 30-second timeout
    const timer = setTimeout(() => {
      const queueItem = db.job_queue.find(q => q.id === current.id);
      
      if (queueItem && queueItem.status === 'pending') {
        // Auto-decline if no response
        queueItem.status = 'timeout';
        saveDB();
        console.log(`Driver ${current.driver_id} timed out for job ${jobId}`);
        
        currentIndex++;
        notifyNextDriver();
      }
    }, 30000);

    cascadeTimers.set(jobId, timer);
  }

  notifyNextDriver();
}

// API Routes

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  
  const user = db.users.find(u => u.phone === phone && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  let additionalData = {};
  if (user.role === 'driver') {
    additionalData = db.drivers.find(d => d.user_id === user.id) || {};
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      ...additionalData
    },
    token: 'demo-token-' + user.id
  });
});

// Get all drivers (for manager)
app.get('/api/drivers', (req, res) => {
  // Drivers already have name and phone fields directly
  // No need to look up from users table
  res.json(db.drivers);
});

// Update driver location
app.post('/api/drivers/location', (req, res) => {
  const { driverId, lat, lng } = req.body;
  
  const driver = db.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.current_lat = lat;
    driver.current_lng = lng;
    saveDB();
  }
  
  // Broadcast location update to all connected managers
  connections.forEach((ws, userId) => {
    const user = db.users.find(u => u.id === userId);
    if (user && user.role === 'manager') {
      const driverForLocation = db.drivers.find(d => d.id === driverId);
      sendToUser(userId, {
        type: 'DRIVER_LOCATION_UPDATE',
        driverId,
        lat,
        lng,
        photo_url: driverForLocation ? driverForLocation.photo_url : null
      });
    }
  });
  
  res.json({ success: true });
});

// Get jobs for a specific driver (history)
app.get('/api/driver/jobs', (req, res) => {
  const { driverId } = req.query;
  if (!driverId) return res.status(400).json({ error: 'driverId required' });

  const jobs = db.jobs
    .filter(j => j.assigned_driver === driverId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(jobs);
});

// Retry job notification (re-run cascade from scratch)
app.post('/api/jobs/:id/retry', (req, res) => {
  const { id } = req.params;
  const job = db.jobs.find(j => j.id === id);

  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!['unassigned', 'pending'].includes(job.status)) {
    return res.status(400).json({ error: 'Job cannot be retried in its current status' });
  }

  // Reset job status to pending
  job.status = 'pending';
  job.assigned_driver = null;
  saveDB();

  // Clear any existing cascade timer
  if (cascadeTimers.has(id)) {
    clearTimeout(cascadeTimers.get(id));
    cascadeTimers.delete(id);
  }

  // Reset queue entries for this job and rebuild
  db.job_queue = db.job_queue.filter(q => q.job_id !== id);

  const onlineDrivers = db.drivers.filter(d => d.availability_status === 'online');
  if (onlineDrivers.length === 0) {
    job.status = 'unassigned';
    saveDB();
    return res.status(400).json({ error: 'No online drivers available' });
  }

  // Sort by distance to pickup
  const sorted = onlineDrivers.map(d => ({
    driver: d,
    dist: Math.sqrt(Math.pow((d.current_lat||0) - (job.pickup_lat||0), 2) + Math.pow((d.current_lng||0) - (job.pickup_lng||0), 2))
  })).sort((a, b) => a.dist - b.dist);

  sorted.forEach((item, i) => {
    db.job_queue.push({
      id: require('crypto').randomUUID(),
      job_id: id,
      driver_id: item.driver.id,
      position: i,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  });
  saveDB();

  startCascade(id);
  res.json({ success: true, message: `Retrying with ${sorted.length} driver(s)` });
});

// Update driver availability
app.post('/api/drivers/availability', (req, res) => {
  const { driverId, status } = req.body;
  
  const driver = db.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.availability_status = status;
    saveDB();

    // Broadcast status change to all connected managers in real-time
    const driverUser = db.users.find(u => u.id === driver.user_id);
    connections.forEach((ws, userId) => {
      const user = db.users.find(u => u.id === userId);
      if (user && user.role === 'manager') {
        sendToUser(userId, {
          type: 'DRIVER_STATUS_UPDATE',
          driverId,
          status,
          lat: driver.current_lat,
          lng: driver.current_lng,
          name: driverUser ? driverUser.name : 'Unknown',
          photo_url: driver.photo_url || null
        });
      }
    });
  }
  
  res.json({ success: true });
});

// Create new job
app.post('/api/jobs', (req, res) => {
  const { 
    managerId, 
    jobType, 
    pickupAddress, 
    pickupLat, 
    pickupLng,
    dropoffAddress,
    dropoffLat,
    dropoffLng,
    carDetails,
    specialInstructions,
    priority
  } = req.body;

  const jobId = uuidv4();
  const estimatedDistance = calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // Create job
  db.jobs.push({
    id: jobId,
    created_by: managerId,
    assigned_driver: null,
    job_type: jobType,
    priority: priority || 'normal',
    status: 'pending',
    pickup_address: pickupAddress,
    pickup_lat: pickupLat,
    pickup_lng: pickupLng,
    dropoff_address: dropoffAddress,
    dropoff_lat: dropoffLat,
    dropoff_lng: dropoffLng,
    car_details: carDetails,
    special_instructions: specialInstructions,
    estimated_distance: estimatedDistance,
    created_at: new Date().toISOString(),
    assigned_at: null,
    started_at: null,
    completed_at: null
  });

  // Find nearest drivers
  const nearestDrivers = findNearestDrivers(pickupLat, pickupLng);

  // Create notification queue
  nearestDrivers.forEach((driver, index) => {
    db.job_queue.push({
      id: uuidv4(),
      job_id: jobId,
      driver_id: driver.id,
      position: index,
      notified_at: null,
      status: 'pending'
    });
  });

  saveDB();

  // Start cascade notification
  setTimeout(() => startCascade(jobId), 1000);

  res.json({ 
    success: true, 
    jobId,
    estimatedDistance: estimatedDistance.toFixed(2),
    driversFound: nearestDrivers.length
  });
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const { managerId, status } = req.query;
  
  let jobs = db.jobs.map(job => {
    const manager = db.users.find(u => u.id === job.created_by);
    const driver = job.assigned_driver ? db.drivers.find(d => d.id === job.assigned_driver) : null;
    
    return {
      ...job,
      manager_name: manager ? manager.name : 'Unknown',
      driver_id: driver ? driver.id : null,
      driver_name: driver ? driver.name : null,
      driver_phone: driver ? driver.phone : null
    };
  });
  
  if (managerId) {
    jobs = jobs.filter(j => j.created_by === managerId);
  }
  
  if (status) {
    const statuses = status.split(',');
    jobs = jobs.filter(j => statuses.includes(j.status));
  }
  
  jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json(jobs);
});

// Get single job
app.get('/api/jobs/:id', (req, res) => {
  const job = db.jobs.find(j => j.id === req.params.id);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const manager = db.users.find(u => u.id === job.created_by);
  const driver = job.assigned_driver ? db.drivers.find(d => d.id === job.assigned_driver) : null;
  
  res.json({
    ...job,
    manager_name: manager ? manager.name : 'Unknown',
    driver_id: driver ? driver.id : null,
    driver_name: driver ? driver.name : null,
    driver_phone: driver ? driver.phone : null,
    driver_photo_url: driver ? driver.photo_url || null : null,
    driver_lat: driver ? driver.current_lat : null,
    driver_lng: driver ? driver.current_lng : null,
  });
});

// Driver accepts job
app.post('/api/jobs/:id/accept', (req, res) => {
  const { driverId } = req.body;
  const jobId = req.params.id;

  // Clear cascade timer
  if (cascadeTimers.has(jobId)) {
    clearTimeout(cascadeTimers.get(jobId));
    cascadeTimers.delete(jobId);
  }

  // Update job
  const job = db.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = 'assigned';
    job.assigned_driver = driverId;
    job.assigned_at = new Date().toISOString();
  }

  // Update driver status
  const driver = db.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.availability_status = 'busy';
    
    // Update driver stats
    const newAcceptanceRate = ((driver.acceptance_rate * driver.total_jobs) + 1) / (driver.total_jobs + 1);
    driver.acceptance_rate = newAcceptanceRate;
  }

  // Update queue
  const queueItem = db.job_queue.find(q => q.job_id === jobId && q.driver_id === driverId);
  if (queueItem) {
    queueItem.status = 'accepted';
  }

  saveDB();

  // Notify manager
  if (job) {
    sendToUser(job.created_by, {
      type: 'JOB_ASSIGNED',
      jobId,
      driverId
    });
  }

  console.log(`Job ${jobId} accepted by driver ${driverId}`);

  res.json({ success: true });
});

// Driver declines job
app.post('/api/jobs/:id/decline', (req, res) => {
  const { driverId } = req.body;
  const jobId = req.params.id;

  // Update queue
  const queueItem = db.job_queue.find(q => q.job_id === jobId && q.driver_id === driverId);
  if (queueItem) {
    queueItem.status = 'declined';
  }

  saveDB();

  // Check if there are more drivers in queue
  const pendingQueue = db.job_queue.filter(q => q.job_id === jobId && q.status === 'pending');

  if (pendingQueue.length > 0) {
    // Continue cascade
    if (cascadeTimers.has(jobId)) {
      clearTimeout(cascadeTimers.get(jobId));
    }
    startCascade(jobId);
  }

  res.json({ success: true });
});

// Driver marks job as picked up
app.post('/api/jobs/:id/pickup', (req, res) => {
  const jobId = req.params.id;
  
  const job = db.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = 'in_progress';
    job.started_at = new Date().toISOString();
    saveDB();
    
    sendToUser(job.created_by, {
      type: 'JOB_STATUS_UPDATE',
      jobId,
      status: 'in_progress'
    });
  }

  res.json({ success: true });
});

// Driver marks job as completed
app.post('/api/jobs/:id/complete', (req, res) => {
  const { driverId } = req.body;
  const jobId = req.params.id;
  
  const job = db.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = 'completed';
    job.completed_at = new Date().toISOString();
  }

  // Update driver
  const driver = db.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.availability_status = 'online';
    driver.total_jobs = (driver.total_jobs || 0) + 1;
  }

  saveDB();

  if (job) {
    sendToUser(job.created_by, {
      type: 'JOB_STATUS_UPDATE',
      jobId,
      status: 'completed'
    });
  }

  res.json({ success: true });
});

// Cancel job (Manager)
app.delete('/api/jobs/:id', (req, res) => {
  const jobId = req.params.id;
  
  // Clear cascade timer
  if (cascadeTimers.has(jobId)) {
    clearTimeout(cascadeTimers.get(jobId));
    cascadeTimers.delete(jobId);
  }

  const job = db.jobs.find(j => j.id === jobId);
  if (job) {
    job.status = 'cancelled';
    job.cancelled_at = new Date().toISOString();
    
    // If job was assigned, free up the driver
    if (job.assigned_driver) {
      const driver = db.drivers.find(d => d.id === job.assigned_driver);
      if (driver) {
        driver.availability_status = 'online';
      }
      
      // Notify driver
      sendToUser(job.assigned_driver, {
        type: 'JOB_CANCELLED',
        jobId,
        message: 'Job cancelled by manager'
      });
    }
    
    saveDB();
  }

  res.json({ success: true });
});

// Driver cancels accepted job
app.post('/api/jobs/:id/cancel', (req, res) => {
  const { driverId, reason } = req.body;
  const jobId = req.params.id;
  
  const job = db.jobs.find(j => j.id === jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.assigned_driver !== driverId) {
    return res.status(403).json({ error: 'Not your job' });
  }
  
  // Only allow cancellation if not yet picked up
  if (job.status === 'in_progress') {
    return res.status(400).json({ error: 'Cannot cancel after pickup' });
  }
  
  // Reset job to pending
  job.status = 'pending';
  job.assigned_driver = null;
  job.assigned_at = null;
  
  // Penalize driver's acceptance rate
  const driver = db.drivers.find(d => d.id === driverId);
  if (driver) {
    driver.availability_status = 'online';
    // Reduce acceptance rate as penalty
    driver.acceptance_rate = Math.max(0, driver.acceptance_rate - 0.1);
  }
  
  saveDB();
  
  // Notify manager
  sendToUser(job.created_by, {
    type: 'JOB_CANCELLED_BY_DRIVER',
    jobId,
    reason: reason || 'Driver cancelled'
  });
  
  // Restart cascade with remaining drivers
  setTimeout(() => startCascade(jobId), 2000);
  
  res.json({ success: true, message: 'Job cancelled. Penalty applied to acceptance rate.' });
});

// Analytics
app.get('/api/analytics/summary', (req, res) => {
  const { managerId } = req.query;
  
  const managerJobs = db.jobs.filter(j => j.created_by === managerId);
  
  const stats = {
    total_jobs: managerJobs.length,
    pending_jobs: managerJobs.filter(j => j.status === 'pending').length,
    active_jobs: managerJobs.filter(j => ['assigned', 'in_progress'].includes(j.status)).length,
    completed_jobs: managerJobs.filter(j => j.status === 'completed').length,
    online_drivers: db.drivers.filter(d => d.availability_status === 'online').length
  };
  
  res.json(stats);
});

// Call routing (for future Twilio/Exotel integration)
app.post('/api/calls/initiate', (req, res) => {
  const { jobId, callerId } = req.body;
  
  const job = db.jobs.find(j => j.id === jobId);
  if (!job || !job.assigned_driver) {
    return res.status(404).json({ error: 'Job not found or no driver assigned' });
  }
  
  const driver = db.drivers.find(d => d.id === job.assigned_driver);
  const driverUser = db.users.find(u => u.id === driver.user_id);
  const callerUser = db.users.find(u => u.id === callerId);
  
  // For now, just return the masked number info
  // In production, this would initiate a Twilio/Exotel call
  res.json({
    success: true,
    message: 'In production, this would connect via proxy number',
    proxyNumber: '1800-XXX-XXXX', // Your Twilio/Exotel number
    driverName: driverUser ? driverUser.name : 'Unknown',
    // Real implementation would not expose these:
    // driverPhone: driverUser.phone (hidden from response)
    // callerPhone: callerUser.phone (hidden from response)
    instructions: 'To enable: Sign up for Exotel.com or Twilio.com and add API credentials'
  });
});

// ============================================
// ============================================
// CONFIG — serve non-secret config to frontend
// ============================================
app.get('/api/config', (req, res) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  res.json({
    googleMapsKey: (key && key.trim()) ? key.trim() : null
  });
});

// ============================================
// DRIVER PHOTO UPLOAD
// ============================================
app.post('/api/drivers/:driverId/photo', photoUpload.single('photo'), (req, res) => {
  const { driverId } = req.params;
  const driver = db.drivers.find(d => d.id === driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Delete old photo if exists
  if (driver.photo_url) {
    const oldPath = path.join(__dirname, 'public', driver.photo_url.replace(/^\//, ''));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  driver.photo_url = `/uploads/${req.file.filename}`;
  saveDB();
  res.json({ photo_url: driver.photo_url });
});

// ============================================
// DRIVER MANAGEMENT (ADMIN)
// ============================================

// Get all drivers (for manager)
app.get('/api/admin/drivers', (req, res) => {
  const driversWithStats = db.drivers.map(driver => {
    const completedJobs = db.jobs.filter(j => j.assigned_driver === driver.id && j.status === 'completed').length;
    const totalJobs = db.jobs.filter(j => j.assigned_driver === driver.id).length;
    const reviews = db.reviews.filter(r => {
      const job = db.jobs.find(j => j.id === r.job_id);
      return job && job.assigned_driver === driver.id;
    });
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    
    return {
      ...driver,
      total_jobs_completed: completedJobs,
      total_jobs: totalJobs,
      average_rating: avgRating
    };
  });
  
  res.json(driversWithStats);
});

// Add new driver
app.post('/api/admin/drivers', (req, res) => {
  const { name, phone, password, initial_lat, initial_lng } = req.body;
  
  if (db.users.find(u => u.phone === phone)) {
    return res.status(400).json({ error: 'Phone number already registered' });
  }
  
  const userId = `driver-${Date.now()}`;
  
  db.users.push({
    id: userId,
    role: 'driver',
    name: name,
    phone: phone,
    password: password
  });
  
  db.drivers.push({
    id: userId,
    name: name,
    phone: phone,
    availability_status: 'offline',
    current_lat: initial_lat || 18.5204,
    current_lng: initial_lng || 73.8567,
    acceptance_rate: 1.0,
    total_jobs: 0,
    total_jobs_completed: 0,
    average_rating: 0,
    today_earnings: 0
  });
  
  saveDB();
  res.json({ message: 'Driver added successfully', driver: { id: userId, name, phone } });
});

// Remove driver
app.delete('/api/admin/drivers/:driverId', (req, res) => {
  const { driverId } = req.params;
  
  db.users = db.users.filter(u => u.id !== driverId);
  db.drivers = db.drivers.filter(d => d.id !== driverId);
  
  saveDB();
  res.json({ message: 'Driver removed successfully' });
});

// Update driver
app.patch('/api/admin/drivers/:driverId', (req, res) => {
  const { driverId } = req.params;
  const { name, phone } = req.body;
  
  const user = db.users.find(u => u.id === driverId);
  const driver = db.drivers.find(d => d.id === driverId);
  
  if (user && driver) {
    if (name) {
      user.name = name;
      driver.name = name;
    }
    if (phone) {
      user.phone = phone;
      driver.phone = phone;
    }
    saveDB();
    res.json({ message: 'Driver updated successfully' });
  } else {
    res.status(404).json({ error: 'Driver not found' });
  }
});

// ============================================
// REVIEWS
// ============================================

// Submit review
app.post('/api/reviews', (req, res) => {
  const { job_id, rating, comments } = req.body;
  
  const review = {
    id: `review-${Date.now()}`,
    job_id: job_id,
    rating: rating,
    comments: comments || '',
    created_at: new Date().toISOString()
  };
  
  db.reviews.push(review);
  saveDB();
  
  res.json({ message: 'Review submitted successfully', review });
});

// Get reviews for a job
app.get('/api/reviews/:jobId', (req, res) => {
  const reviews = db.reviews.filter(r => r.job_id === req.params.jobId);
  res.json(reviews);
});

// Get all reviews (for manager)
app.get('/api/reviews', (req, res) => {
  res.json(db.reviews);
});

// ============================================
// JOB HISTORY
// ============================================

// Get job history with filters
app.get('/api/jobs/history', (req, res) => {
  const { from, to, status, driver } = req.query;
  
  let jobs = db.jobs.map(job => {
    const jobDriver = job.assigned_driver ? db.drivers.find(d => d.id === job.assigned_driver) : null;
    const review = db.reviews.find(r => r.job_id === job.id);
    
    return {
      ...job,
      driver_name: jobDriver ? jobDriver.name : null,
      driver_phone: jobDriver ? jobDriver.phone : null,
      review: review || null
    };
  });
  
  if (from) {
    jobs = jobs.filter(j => new Date(j.created_at) >= new Date(from));
  }
  
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    jobs = jobs.filter(j => new Date(j.created_at) <= toDate);
  }
  
  if (status && status !== 'all') {
    jobs = jobs.filter(j => j.status === status);
  }
  
  if (driver && driver !== 'all') {
    jobs = jobs.filter(j => j.assigned_driver === driver);
  }
  
  jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json(jobs);
});

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║  Driver Coordination v2.0 - Server Running!    ║
╚════════════════════════════════════════════════╝

📱 Manager Dashboard: http://localhost:${PORT}/manager.html
🚗 Driver App: http://localhost:${PORT}/driver.html
👤 Customer Tracking: http://localhost:${PORT}/customer.html

Demo Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Manager: 9876543210 / demo123
Driver:  9876543201 / driver123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Features:
✓ Real-time GPS tracking
✓ Driver management (add/remove)
✓ Customer reviews
✓ Job history with filters
✓ Mobile responsive
✓ Free OpenStreetMap
✓ JSON file database

Database: database.json (auto-created)

  `);
});

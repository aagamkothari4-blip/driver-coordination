# Driver Coordination System - Technical Requirements Document

**Version:** 1.0  
**Date:** May 2026  
**Project Type:** B2B Driver Coordination Platform (Uber-style for Car Dealership)

---

## Executive Summary

This document outlines the technical requirements for a driver coordination system that matches freelance drivers with car pickup and delivery jobs across multiple dealership outlets. The system enables managers to post job requests and automatically routes them to the nearest available drivers with a cascading notification system.

---

## 1. System Overview

### 1.1 Purpose
Enable efficient coordination of freelance drivers for car transportation between customer locations, showrooms, and service centers.

### 1.2 Key Users
- **Showroom Managers**: Create and track job requests
- **Freelance Drivers**: Receive, accept, and complete jobs
- **Admin**: Monitor system health and driver performance

### 1.3 Core Functionality
- Real-time geolocation-based driver matching
- Cascading notification system (30-second timeout)
- Job lifecycle management (created → assigned → in-progress → completed)
- Driver availability tracking
- Real-time location updates

---

## 2. Functional Requirements

### 2.1 Manager Dashboard (Web Application)

#### 2.1.1 Job Creation
- **Input Fields**:
  - Pickup location (address with map autocomplete)
  - Drop-off location (address with map autocomplete)
  - Car details (make, model, registration number)
  - Job type (pickup from customer / delivery to customer / inter-outlet transfer)
  - Priority level (normal / urgent)
  - Scheduled time (now / future date-time)
  - Special instructions (text area, optional)

- **Validations**:
  - Both locations must be valid addresses
  - All mandatory fields required before submission
  - Scheduled time cannot be in the past

- **Output**:
  - Unique job ID generated
  - Estimated distance and time calculated via Google Maps API
  - Job posted to matching queue

#### 2.1.2 Active Job Tracking
- **View All Jobs**: List view with filters (pending / active / completed)
- **Job Details**:
  - Current status with timestamp
  - Assigned driver details (name, phone, photo)
  - Real-time driver location on map
  - Estimated arrival time
  - Job history log
  
- **Actions**:
  - Cancel job (before driver assignment)
  - Contact driver (call/message)
  - Mark job as problematic (if issues arise)

#### 2.1.3 Driver Overview
- **Active Drivers Map**: Live view of all online drivers
- **Driver List**:
  - Name, phone, availability status
  - Current job (if any)
  - Performance metrics (jobs completed, average rating)
  
#### 2.1.4 Analytics Dashboard
- **Metrics**:
  - Jobs completed today/week/month
  - Average assignment time
  - Driver utilization rate
  - Peak hours analysis
  - Cost per job

---

### 2.2 Driver Mobile App (iOS + Android)

#### 2.2.1 Authentication
- **Login Methods**:
  - Phone number + OTP
  - Google Sign-In (optional)
- **Session Management**:
  - JWT token with 30-day expiry
  - Biometric login after initial setup

#### 2.2.2 Availability Control
- **Status Toggle**:
  - Online (available for jobs)
  - Offline (not receiving jobs)
  - Busy (in active job)
- **Auto-offline**: After 2 hours of inactivity

#### 2.2.3 Job Notifications
- **Incoming Job Alert**:
  - Push notification with sound and vibration
  - In-app modal overlay (cannot be dismissed easily)
  - Display: pickup location, drop-off location, estimated distance, estimated earnings
  - 30-second countdown timer
  - Actions: Accept / Decline

- **Cascade Logic**:
  - If no response in 30 seconds, auto-decline
  - Notification sent to next nearest driver
  - Process repeats until accepted or all drivers exhausted

#### 2.2.4 Active Job Management
- **Job Accepted**:
  - Full job details displayed
  - Navigation button (opens Google Maps with pickup location)
  - Contact manager button
  - Mark as "Picked Up" button (at pickup location)
  
- **In Transit**:
  - Real-time location sharing to backend
  - Navigation to drop-off location
  - Mark as "Delivered" button (at drop-off location)
  
- **Job Completion**:
  - Upload photo proof (optional)
  - Signature capture from customer (optional)
  - Earnings summary displayed
  - Rating prompt for manager (1-5 stars)

#### 2.2.5 Job History
- **Past Jobs List**:
  - Date, locations, earnings
  - Filter by date range
  - Export to PDF (monthly earnings report)

#### 2.2.6 Earnings Tracker
- **Dashboard**:
  - Today's earnings
  - This week's earnings
  - This month's earnings
  - Pending payments
  - Payment history

---

### 2.3 Backend Services

#### 2.3.1 Driver Matching Algorithm
**Inputs**:
- Job pickup location (latitude, longitude)
- All online drivers' current locations

**Process**:
1. Query PostgreSQL with PostGIS to get drivers within 50km radius
2. Calculate straight-line distance to each driver
3. Fetch actual road distance via Google Maps Distance Matrix API (for top 10 closest)
4. Rank drivers by: (a) actual distance, (b) availability, (c) acceptance rate
5. Return ordered list of driver IDs

**Output**:
- Ranked list of driver IDs
- Store in Redis queue with TTL

#### 2.3.2 Notification Cascade Service
**Process**:
1. Pop first driver ID from Redis queue
2. Send push notification via Firebase FCM
3. Set 30-second timeout in Redis
4. Listen for driver response:
   - **Accept**: Assign job, notify manager, clear queue
   - **Decline**: Move to next driver immediately
   - **Timeout**: Auto-decline, move to next driver
5. Repeat until accepted or queue empty

**Fallback**:
- If all drivers decline/timeout, send SMS alert to manager
- Mark job as "unassigned" in database

#### 2.3.3 Real-time Location Service
**Functionality**:
- WebSocket connection between driver app and backend
- Driver app sends location updates every 10 seconds when on active job
- Location stored in Redis (fast writes) with 24-hour TTL
- Location also written to PostgreSQL every 60 seconds (permanent record)
- Manager dashboard receives location updates via WebSocket

#### 2.3.4 Authentication Service
- **JWT Token Generation**: On successful login
- **Token Validation**: Middleware on all protected routes
- **Role-based Access Control**: Manager vs Driver permissions
- **Refresh Token**: 30-day expiry with rotation

---

## 3. Non-Functional Requirements

### 3.1 Performance
- **API Response Time**: < 300ms for 95% of requests
- **Database Queries**: < 100ms with proper indexing
- **Real-time Updates**: Location updates delivered within 2 seconds
- **Push Notifications**: Delivered within 3 seconds of job creation

### 3.2 Scalability
- **Concurrent Users**: Support 200+ active drivers
- **Daily Jobs**: Handle 1000+ jobs per day
- **Database**: Partition job history by month after 1M records
- **Horizontal Scaling**: Stateless backend services for load balancing

### 3.3 Reliability
- **Uptime**: 99.5% availability
- **Data Backup**: Daily PostgreSQL backups to S3
- **Redis Failover**: Master-slave replication
- **Error Logging**: Centralized logging with alerts for critical errors

### 3.4 Security
- **HTTPS**: All API communication encrypted
- **SQL Injection**: Parameterized queries only
- **XSS Protection**: Input sanitization on frontend and backend
- **Rate Limiting**: 100 requests/minute per user
- **Data Privacy**: Driver locations deleted after 30 days

### 3.5 Usability
- **Mobile App**: Intuitive UI, max 3 taps to any function
- **Dashboard**: Responsive design (desktop + tablet)
- **Offline Mode**: Driver app caches last 10 jobs when offline

---

## 4. Technical Stack

### 4.1 Mobile Apps
- **Framework**: React Native (preferred) or Flutter
- **State Management**: Redux or MobX
- **Maps**: Google Maps SDK
- **Push Notifications**: Firebase Cloud Messaging
- **Local Storage**: AsyncStorage / SQLite

### 4.2 Web Dashboard
- **Framework**: React.js with Next.js (SSR for SEO)
- **UI Library**: Material-UI or Tailwind CSS
- **Maps**: Google Maps JavaScript API
- **Real-time**: Socket.io client
- **Build Tool**: Webpack / Vite

### 4.3 Backend
- **Language**: Node.js (JavaScript/TypeScript)
- **Framework**: Express.js or NestJS
- **Real-time**: Socket.io
- **Authentication**: Passport.js with JWT
- **Validation**: Joi or Yup
- **Testing**: Jest + Supertest

### 4.4 Database
- **Primary Database**: PostgreSQL 14+ with PostGIS extension
- **Cache/Queue**: Redis 7+
- **Migrations**: Knex.js or TypeORM migrations

### 4.5 Infrastructure
- **Cloud Provider**: AWS (preferred) or Google Cloud
- **Compute**: EC2 (or Cloud Run for serverless)
- **Database**: RDS PostgreSQL
- **Cache**: ElastiCache Redis
- **Storage**: S3 for driver documents/photos
- **CDN**: CloudFront for static assets
- **Monitoring**: CloudWatch + Sentry for error tracking

### 4.6 Third-party Services
- **Maps**: Google Maps Platform (Distance Matrix, Geocoding, Maps SDK)
- **Push Notifications**: Firebase Cloud Messaging (free)
- **SMS** (optional): Twilio
- **Authentication** (optional): Auth0

---

## 5. Database Schema

### 5.1 Core Tables

#### users
- id (UUID, PK)
- role (ENUM: 'manager', 'driver', 'admin')
- name (VARCHAR 100)
- email (VARCHAR 100, UNIQUE)
- phone (VARCHAR 15, UNIQUE)
- password_hash (VARCHAR 255)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### drivers
- id (UUID, PK, FK → users.id)
- license_number (VARCHAR 50)
- license_expiry (DATE)
- vehicle_type (VARCHAR 50, optional)
- availability_status (ENUM: 'online', 'offline', 'busy')
- current_location (GEOGRAPHY POINT, PostGIS)
- acceptance_rate (DECIMAL 3,2)
- total_jobs_completed (INTEGER)
- average_rating (DECIMAL 2,1)
- created_at (TIMESTAMP)

#### jobs
- id (UUID, PK)
- created_by (UUID, FK → users.id)
- assigned_driver (UUID, FK → drivers.id, nullable)
- job_type (ENUM: 'pickup', 'delivery', 'transfer')
- priority (ENUM: 'normal', 'urgent')
- status (ENUM: 'pending', 'assigned', 'in_progress', 'completed', 'cancelled')
- pickup_address (TEXT)
- pickup_location (GEOGRAPHY POINT)
- dropoff_address (TEXT)
- dropoff_location (GEOGRAPHY POINT)
- car_details (JSONB)
- special_instructions (TEXT)
- scheduled_time (TIMESTAMP)
- assigned_at (TIMESTAMP)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- estimated_distance_km (DECIMAL 5,2)
- estimated_duration_min (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

#### job_history
- id (UUID, PK)
- job_id (UUID, FK → jobs.id)
- status (VARCHAR 50)
- changed_at (TIMESTAMP)
- changed_by (UUID, FK → users.id)
- notes (TEXT)

#### driver_locations
- id (UUID, PK)
- driver_id (UUID, FK → drivers.id)
- location (GEOGRAPHY POINT)
- recorded_at (TIMESTAMP)
- INDEX on (driver_id, recorded_at DESC)

#### payments
- id (UUID, PK)
- driver_id (UUID, FK → drivers.id)
- job_id (UUID, FK → jobs.id)
- amount (DECIMAL 10,2)
- status (ENUM: 'pending', 'paid')
- payment_date (DATE)
- created_at (TIMESTAMP)

### 5.2 Indexes
- drivers.current_location (GIST index for geospatial queries)
- jobs.status (B-tree for filtering)
- jobs.created_by (B-tree for manager job lookup)
- jobs.assigned_driver (B-tree for driver job lookup)
- driver_locations (driver_id, recorded_at DESC) (composite for location history)

---

## 6. API Endpoints

### 6.1 Authentication
- POST /api/auth/login - Login (phone + OTP or email/password)
- POST /api/auth/register - Register new user
- POST /api/auth/refresh - Refresh JWT token
- POST /api/auth/logout - Invalidate token

### 6.2 Jobs (Manager)
- POST /api/jobs - Create new job
- GET /api/jobs - List all jobs (with filters)
- GET /api/jobs/:id - Get job details
- PATCH /api/jobs/:id - Update job (cancel, etc.)
- DELETE /api/jobs/:id - Delete job

### 6.3 Jobs (Driver)
- GET /api/driver/jobs - Get assigned jobs
- POST /api/driver/jobs/:id/accept - Accept job
- POST /api/driver/jobs/:id/decline - Decline job
- POST /api/driver/jobs/:id/pickup - Mark as picked up
- POST /api/driver/jobs/:id/complete - Mark as completed

### 6.4 Drivers
- GET /api/drivers - List all drivers (manager only)
- GET /api/drivers/:id - Get driver details
- PATCH /api/drivers/:id/availability - Update availability status
- POST /api/drivers/:id/location - Update current location

### 6.5 Analytics
- GET /api/analytics/jobs - Job statistics
- GET /api/analytics/drivers - Driver performance metrics
- GET /api/analytics/earnings - Earnings summary

### 6.6 WebSocket Events
- `driver:location` - Driver location update
- `job:created` - New job notification to drivers
- `job:assigned` - Job assigned confirmation
- `job:status` - Job status change

---

## 7. Google Maps API Usage

### 7.1 Required APIs
- **Distance Matrix API**: Calculate actual road distance between driver and pickup location
- **Geocoding API**: Convert addresses to coordinates
- **Maps JavaScript API**: Display maps in web dashboard
- **Maps SDK for Android**: Mobile app maps
- **Maps SDK for iOS**: Mobile app maps

### 7.2 Estimated Monthly Usage
- **Distance Matrix**: ~10,000 requests/month (500 jobs × 20 drivers checked per job)
- **Geocoding**: ~2,000 requests/month (500 jobs × 2 locations × 2 conversions)
- **Map loads**: ~50,000 loads/month (managers + drivers viewing maps)

### 7.3 Cost Estimation (Google Maps Platform)
- Distance Matrix: $5/1000 requests = $50/month
- Geocoding: $5/1000 requests = $10/month
- Map loads: Free up to 28,000/month, then $7/1000 = ~$154/month
- **Total**: ~₹18,000/month (~$220/month)

*Note: Actual costs may vary. Consider caching geocoded addresses to reduce API calls.*

---

## 8. Development Phases

### Phase 1: MVP (2-3 months)
**Scope**:
- Manager dashboard (job creation + tracking)
- Driver Android app (job notifications + acceptance)
- Core matching algorithm
- Basic database + authentication
- Manual payment tracking (no automation)

**Deliverables**:
- Working system for 1 showroom
- 50 drivers supported
- Basic analytics

### Phase 2: Enhancement (1-2 months)
**Scope**:
- iOS driver app
- Advanced analytics dashboard
- Automated payment tracking
- Driver ratings and reviews
- SMS backup notifications
- Enhanced error handling

**Deliverables**:
- Full-featured system
- 200+ drivers supported
- Comprehensive reporting

### Phase 3: Scale (1-2 months)
**Scope**:
- Multi-showroom support (API for multiple outlets)
- Integration with existing dealership systems (CRM, inventory)
- Advanced driver scheduling (future bookings)
- Customer self-service portal (track their car pickup)

**Deliverables**:
- Enterprise-ready platform
- Unlimited drivers
- White-label options

---

## 9. Testing Requirements

### 9.1 Unit Tests
- All backend services (matching, notifications, auth)
- Database models and queries
- Target: 80% code coverage

### 9.2 Integration Tests
- API endpoints (all CRUD operations)
- WebSocket connections
- Third-party API integrations (Google Maps, FCM)

### 9.3 End-to-End Tests
- Manager creates job → Driver receives notification → Driver accepts → Job completed
- Multiple concurrent jobs
- Driver cascade logic (timeout + decline scenarios)

### 9.4 Performance Tests
- Load testing with 200 concurrent drivers
- 1000 jobs created in 1 hour
- Real-time location updates from 100 active drivers

### 9.5 Security Tests
- Penetration testing on authentication
- SQL injection attempts
- XSS vulnerability scanning

---

## 10. Deployment Strategy

### 10.1 Development Environment
- Local machines with Docker Compose
- PostgreSQL + Redis in containers
- Mock Google Maps API responses

### 10.2 Staging Environment
- AWS EC2 instance (or Cloud Run)
- Separate database instance
- Test Firebase FCM project
- Protected with basic auth

### 10.3 Production Environment
- AWS (recommended setup):
  - EC2 Auto Scaling Group (2+ instances)
  - Application Load Balancer
  - RDS PostgreSQL Multi-AZ
  - ElastiCache Redis cluster
  - S3 for static assets + backups
  - CloudFront CDN
  - Route 53 for DNS

### 10.4 CI/CD Pipeline
- Git repository: GitHub or GitLab
- Automated testing on every commit
- Deploy to staging on merge to develop branch
- Deploy to production on merge to main branch (manual approval)
- Tools: GitHub Actions or GitLab CI

---

## 11. Cost Summary

### 11.1 One-time Development Costs
- **MVP Development**: ₹2.5L - 4L
- **Full Development**: ₹4L - 8L
- **App Store Fees**: ₹8,300 (₹6,500 Apple + ₹1,800 Google)

### 11.2 Monthly Operational Costs
- **Infrastructure** (AWS): ₹9,000 - 26,000
- **Google Maps API**: ₹5,000 - 20,000
- **Firebase**: Free - ₹5,000
- **SMS** (optional): ₹2,000 - 5,000
- **Maintenance**: ₹15,000 - 30,000
- **Total**: ₹31,000 - 86,000/month

### 11.3 First Year Total Cost Estimate
- Development: ₹4L - 8L
- Operations (12 months): ₹3.7L - 10.3L
- **Grand Total**: ₹7.7L - 18.3L

*Costs are approximate and may vary based on provider rates and usage patterns.*

---

## 12. Success Metrics

### 12.1 KPIs
- **Driver Assignment Rate**: > 90% of jobs assigned within 2 minutes
- **Driver Acceptance Rate**: > 70% on first notification
- **Job Completion Rate**: > 95% of assigned jobs completed
- **Average Assignment Time**: < 60 seconds
- **System Uptime**: > 99%
- **Driver Utilization**: > 60% of online time with active jobs

### 12.2 User Satisfaction
- Manager satisfaction: > 4/5 stars
- Driver app rating: > 4.2/5 on app stores
- Customer complaints: < 5% of total jobs

---

## 13. Risk Mitigation

### 13.1 Technical Risks
- **Risk**: Google Maps API costs exceed budget
  - **Mitigation**: Cache geocoded addresses, implement distance calculation fallback

- **Risk**: Firebase FCM push notifications fail or delayed
  - **Mitigation**: SMS backup system via Twilio, in-app polling as last resort

- **Risk**: Database performance degrades with scale
  - **Mitigation**: Proper indexing, query optimization, read replicas, partitioning

### 13.2 Business Risks
- **Risk**: Drivers don't adopt the app
  - **Mitigation**: Simple onboarding, training sessions, incentives for early adopters

- **Risk**: Too many simultaneous jobs overwhelm drivers
  - **Mitigation**: Job queuing system, priority-based assignment, load balancing

---

## 14. Future Enhancements

- **AI-based Predictive Assignment**: Machine learning to predict best driver based on historical performance
- **Automated Route Optimization**: Multi-stop route planning for drivers handling multiple jobs
- **Customer Tracking Portal**: Allow customers to track their car's pickup/delivery in real-time
- **Voice Commands**: Driver hands-free job acceptance via voice
- **Gamification**: Leaderboards, badges for top-performing drivers
- **Integration with Dealership CRM**: Auto-create jobs from service appointments

---

## 15. Appendix

### 15.1 Glossary
- **Job**: A request to move a car from one location to another
- **Cascade**: Sequential notification of drivers until one accepts
- **Matching**: Algorithm to rank drivers by proximity and availability
- **FCM**: Firebase Cloud Messaging for push notifications
- **PostGIS**: PostgreSQL extension for geospatial queries

### 15.2 References
- Google Maps Platform Documentation: https://developers.google.com/maps
- Firebase Cloud Messaging: https://firebase.google.com/docs/cloud-messaging
- PostgreSQL PostGIS: https://postgis.net/
- React Native: https://reactnative.dev/

---

**Document End**

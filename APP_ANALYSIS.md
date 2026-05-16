# EcoBus Application - Deep Feature Analysis

## Project Overview

**EcoBus** is a comprehensive school transportation management platform with three integrated applications:
- **Parent App** (React Native) - Track children on buses in real-time
- **Driver App** (React Native) - Manage routes and student check-ins
- **Admin Console** (React Web) - Fleet management, analytics, and operational oversight

This analysis focuses on the **Admin Console** (TanStack React web app) being developed in this repository.

---

## 1. LOGIN FEATURE

### Architecture
- **Route**: `/login` (`src/routes/login.tsx`)
- **Authentication**: JWT-based with localStorage token persistence
- **Backend API**: `https://busapi.ihebchebbi.pro/api/v1/auth/login`

### Key Components & Features

#### 1.1 Login Page UI
- **Two-column layout** (desktop) / Single column (mobile)
  - **Left side (Hero)**: Marketing content with gradient background, feature highlights, and branding
  - **Right side (Form)**: Login form with email/password fields

#### 1.2 Form Fields
- **Email input**: Standard email validation, placeholder: "admin@ecole.tn"
- **Password input**: Standard password field, masked input
- **"Forgot Password" link**: Currently shows toast with message to contact super administrator
  - *Note*: No forgot password flow implemented yet

#### 1.3 Login Flow
```
1. User enters email & password
2. Click "Se connecter" button
3. `login()` from AuthContext called with credentials
4. API call to backend → returns JWT access token + user object
5. Tokens stored in localStorage: 
   - @ecobus-admin/access (JWT)
   - @ecobus-admin/refresh (refresh token)
   - @ecobus-admin/user (user data)
6. User redirected to `/dashboard` on success
7. Toast notification on error
```

#### 1.4 Error Handling
- Network errors caught and displayed as toast
- Basic error message from API shown to user

#### 1.5 Security Features
- **TLS Encryption** badge displayed
- **Access Restriction** notice: "Réservé aux administrateurs"
- JWT stored in localStorage (client-side)
- Session auto-refresh on 401 (via middleware in api.ts)

#### 1.6 Visual Design
- **Brand Colors**: Teal/cyan gradient (primary), dark navy secondary
- **Typography**: Inter font family
- **Styling**: Tailwind CSS with custom gradient and pattern tokens
- **Animated Elements**: Floating gradient orbs on hero section
- **Loading State**: Spinner on button during submission

#### 1.7 Current Issues/Gaps
- No password reset flow implemented
- No account creation/signup from login page
- No session timeout or inactivity logout
- JWT token expiry not explicitly handled (refresh via middleware)
- No 2FA/MFA support

---

## 2. DASHBOARD FEATURE

### Route & Context
- **Route**: `/_authenticated/dashboard` (`src/routes/_authenticated/dashboard.tsx`)
- **Protected by**: `_authenticated` layout that checks `useAuth().isAuthenticated`
- **Access Control**: Both super admins and school admins can access

### 2.1 Dashboard Architecture

#### Data Fetching Pattern
Uses **TanStack React Query** for server state management:
- 13 parallel queries auto-refresh at different intervals
- Live data updates every 15-60 seconds depending on data type

```typescript
// Key queries:
buses        // Refetch on demand
drivers      // Refetch on demand
children     // Refetch on demand
liveTrips    // Auto-refetch every 15s
tripsHistory // Refetch on demand
sos          // Auto-refetch every 20s (security critical)
alerts       // Refetch on demand
routes       // Refetch on demand
schools      // Super admin only
overview     // Auto-refetch every 60s
notifications // Refetch on demand
```

### 2.2 Layout Structure

#### Header
- **Location**: Sticky top of page
- **Content**: Greeting (Bonjour/Bon après-midi/Bonsoir based on time)
- **Dynamic Title**: `{greeting}, {firstName}` (falls back to email prefix)
- **Subtitle**: "Aperçu temps réel de votre flotte..."
- **Live Indicator**: Badge showing "Live · màj automatique"

#### Main Content Sections (Stacked vertically)

##### Section 1: Fleet Overview (4 stat cards)
```
Bus actifs [active/total] 98% en service
Chauffeurs [count]
Routes [count]
Écoles/Orgs [count] — Super admin only
```
- **Icons**: Bus, ID Card, Route, School
- **Colors**: Default tones with utilization percentage

##### Section 2: Operations - Last 7 Days (4 stat cards)
```
Trajets en cours [live count] — Blue/info tone
Trajets aujourd'hui [count]
Embarquements [count] — Green/success tone
Enfants inscrits [count]
```

##### Section 3: Safety & Communication (4 stat cards)
```
SOS ouverts [count] — Red/danger if > 0
Alertes ouvertes [count] — Orange/warning if > 0
Absences (7j) [count]
Notifications (7j) [count]
```

##### Section 4: Charts (2 visualizations)
- **Left Chart (2/3 width)**: Area chart - "Trajets · 7 derniers jours"
  - Shows daily trip volume
  - Gradient fill, smooth curves
  - Quick link to `/trips/history`

- **Right Chart (1/3 width)**: Bar chart - "Alertes · 7 derniers jours"
  - Shows daily alert count
  - Orange bars with rounded tops
  - Quick link to `/alerts`

#### Section 5: Live Map
- **Component**: `<LiveBusMap>`
- **Height**: 380px
- **Data**: Real-time bus locations from active trips
- **Functionality**: Shows bus positions, routes, and active trip details
- **Controls**: Quick link to full-screen `/trips/live` view

#### Section 6: Active Trips & SOS Cards (2 side-by-side cards)

**Active Trips Card**:
- Live dot indicator
- Shows up to 6 live trips
- Each trip shows: Route name, Bus number, Start time
- Status badge: "en cours" (green)
- Quick link to `/trips/live`
- Empty state when no trips

**Recent SOS Alerts Card**:
- Emergency icon (red if open alerts)
- Shows up to 6 most recent SOS alerts
- Each alert shows: Type, Creation timestamp
- Status badge: "résolu" (gray) or "ouvert" (red)
- Quick link to `/sos`
- Empty state message: "Aucune alerte récente. Tout va bien."

### 2.3 Data Transformations

#### Last 7 Days Calculation
- Generates bucket for each day (past 7 days including today)
- Aggregates trips & alerts by date
- Formats day labels: "mon", "tue", "wed", etc. (localized to French)

#### Utilization Calculation
```javascript
utilization = (activeBuses / totalBuses) * 100
// Source of truth: actual buses.data array (not backend total)
```

#### Open SOS/Alerts Filtering
```javascript
openSos = sos filtered by !resolvedAt && status !== "resolved"
openAlerts = alerts filtered by status !== "resolved"
```

### 2.4 Role-Based Rendering

#### Super Admin Only Features
- **Stat Card**: "Écoles/Orgs" count
- **Map Title Variation**: "Carte temps réel · toutes les écoles"
- **Enabled Query**: Schools list query

#### School Admin Features
- Limited to their organization's data
- Map title: "Carte temps réel · vos bus"
- User greeting includes school context

### 2.5 Responsive Design

- **Mobile (< 768px)**:
  - Stat cards: 2 columns
  - Charts hidden or stacked full-width
  - Map takes full width

- **Tablet (768px - 1024px)**:
  - Stat cards: 3 columns
  - Charts side-by-side
  - Map takes full width

- **Desktop (> 1024px)**:
  - Stat cards: 3-4 columns depending on role
  - Charts: Left 2/3, Right 1/3
  - Map takes full width

### 2.6 Visual Design

#### Color Palette
- **Primary**: Teal (#229BA6 / oklch(0.74 0.095 195))
- **Success**: Green (for boarding/active trips)
- **Warning**: Orange (for open alerts)
- **Danger**: Red (for open SOS)
- **Background**: Light neutral (card backgrounds)
- **Text**: Dark foreground on light backgrounds

#### Typography
- **Headings**: Font-semibold, tracking-tight
- **Body**: Regular weight, readable line-height
- **Labels**: Uppercase, tiny font, letter-spaced

#### Spacing & Layout
- Main container: `space-y-8` (32px between sections)
- Stat cards: `gap-4` (16px on mobile), `gap-6` (24px on desktop)
- Cards padding: `p-6` (24px)

### 2.7 Interactive Elements

#### Stat Cards
- Hover effect (slight background change)
- Display metric, label, and optional hint text
- Color-coded by tone (default/info/success/warning/danger)

#### Chart Interactions
- Tooltip on hover showing exact values
- Smooth animations
- Custom styling matching theme

#### Action Buttons
- Quick links styled as secondary buttons with arrow icons
- Present on charts, live trip card, SOS card
- Navigate to detailed pages for deeper insights

### 2.8 Real-Time Updates

#### Auto-Refresh Strategy
```javascript
liveTrips: 15 seconds (operations critical)
sos:       20 seconds (security critical)
overview:  60 seconds (analytics, less critical)
others:    on-demand fetch
```

#### Loading States
- Skeletons or loading spinners while data fetches
- Graceful fallbacks to "—" when data unavailable
- Empty states with helpful messages

### 2.9 Current Implementation Gaps

- **No filters**: Can't filter by date range, school, or bus type
- **No export**: Can't export reports to CSV/PDF
- **No drill-down**: Limited ability to explore individual entities from dashboard
- **No alerts customization**: Can't set alert thresholds or rules
- **No comparison**: No month-over-month or year-over-year comparisons
- **Limited personalization**: Can't customize which cards show on dashboard
- **No offline support**: Requires constant backend connection

---

## 3. AUTHENTICATED LAYOUT & NAVIGATION

### Protected Route Wrapper
- **File**: `src/routes/_authenticated.tsx`
- **Purpose**: Wraps all authenticated routes (/dashboard, /buses, /drivers, etc.)
- **Auth Check**: Redirects to `/login` if not authenticated
- **Loading State**: Shows spinner while auth status loads

### Sidebar Navigation
- **Component**: `<AppSidebar>` (src/components/app-sidebar.tsx)
- **Type**: Collapsible sidebar (icon mode when collapsed)
- **Content**: 5 main groups + super admin group + settings

#### Navigation Groups

1. **Vue d'ensemble (Overview)**
   - Tableau de bord (Dashboard)
   - Analytics

2. **Flotte (Fleet)**
   - Bus
   - Chauffeurs (Drivers)
   - Routes
   - Arrêts (Stops)
   - Affectations (Assignments)
   - Géofences

3. **Personnes (People)**
   - Enfants (Children)
   - Parents
   - Utilisateurs (Users) — School admins filtered out
   - Écoles (Schools)

4. **Opérations (Operations)**
   - Trajets en cours (Live trips)
   - Historique trajets (Trip history)
   - Check-ins
   - Absences (Absences)

5. **Sécurité & Comm. (Security & Communications)**
   - SOS
   - Alertes (Alerts)
   - Notifications

6. **Super admin** (Conditional)
   - Organisations
   - Logs serveur (Server logs)

7. **Système (System)**
   - Paramètres (Settings)

#### Sidebar Features
- Active state highlighting with color accent and left border
- Hover effects on menu items
- Tooltips when collapsed
- User info section (initials, logout)
- Responsive toggle for mobile
- Keyboard accessible

### App Header
- **Sticky positioning** (top-0 z-20)
- **Mobile menu toggle** or sidebar trigger
- **Breadcrumb**: EcoBus / Console
- **Live indicator**: Dot + "Backend en ligne"
- **Backdrop blur** effect for depth

---

## 4. AUTHENTICATION SYSTEM

### Auth Context & Provider
- **File**: `src/lib/auth.tsx`
- **Type**: React Context with custom hook

### Auth State
```typescript
type AuthCtx = {
  user: AdminUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isSchoolAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
```

### Role Detection
- Parses roles from user object (flexible: string, array, or object array)
- **Super Admin**: Roles containing "admin", "super_admin", "superadmin", "platform_admin"
- **School Admin**: Roles containing "school_admin", "school_manager", "org_admin", or is super admin

### Session Persistence
On app load:
1. Check localStorage for cached user
2. If access token exists, validate with `/auth/me` endpoint
3. If validation fails, clear session and redirect to login
4. Set loading=false

### Token Refresh
- Automatic on 401 response via `tryRefresh()` middleware
- Stores new access/refresh tokens if refresh succeeds
- Logs out and redirects if refresh fails

---

## 5. API INTEGRATION

### Base URL
```
https://busapi.ihebchebbi.pro/api/v1
```

### API Modules
- `BusesAPI.list()` → GET /buses
- `DriversAPI.list()` → GET /drivers
- `ChildrenAPI.list()` → GET /children
- `TripsAPI.active()` → GET /trips/active (live)
- `TripsAPI.history()` → GET /trips/history (past 7 days)
- `SosAPI.list()` → GET /sos
- `NotificationsAPI.list()` → GET /notifications
- `RoutesAPI.list()` → GET /routes
- `SchoolsAPI.list()` → GET /schools (super admin)
- `AnalyticsAPI.overview(days)` → GET /analytics/overview?days=7
- `AlertsAPI.list()` → GET /alerts
- `AuthAPI.login(email, pwd)` → POST /auth/login
- `AuthAPI.logout()` → POST /auth/logout
- `AuthAPI.me()` → GET /auth/me

### Error Handling
- Network errors caught and displayed
- 401 triggers automatic token refresh
- Failed refresh redirects to login
- API response envelope parsed (checks for `data` property)

---

## 6. TECH STACK

### Frontend Framework
- **React 19.2** (canary features available)
- **TanStack Router** (v1.168) — File-based routing
- **TanStack React Query** (v5.83) — Server state management
- **TanStack React Start** — Meta-framework integration

### UI & Styling
- **Tailwind CSS 4** — Utility-first styling
- **shadcn/ui** — Component library (Radix UI primitives)
- **Recharts** — Chart visualizations
- **Lucide React** — Icons
- **Sonner** — Toast notifications

### Form Handling
- **React Hook Form** (v7.71) — Efficient form state
- **Zod** (v3.24) — Schema validation
- **@hookform/resolvers** — Integration layer

### Maps
- **@vis.gl/react-google-maps** (v1.8.3) — Google Maps integration

### Dev Tools
- **Vite 7** — Build tool and dev server
- **TypeScript 5.8** — Type safety
- **ESLint + Prettier** — Code quality and formatting

---

## 7. NOTABLE ARCHITECTURAL PATTERNS

### 1. Route Protection
- Layout routes (`_authenticated.tsx`) wrap protected pages
- Null layout pattern for login/public pages

### 2. Query Management
- Automatic refetch intervals for real-time data
- Parallel queries for independent data streams
- Graceful error states with fallback values

### 3. Responsive Mobile Design
- Mobile-first Tailwind breakpoints
- Adaptive grid layouts (2 → 3 → 4 columns)
- Mobile sidebar toggle integrated

### 4. Type Safety
- TypeScript throughout
- AdminUser type with flexible role support
- API response types inferred from endpoints

### 5. Internationalization (i18n)
- `useI18n()` hook for translations
- French as primary language (French labels throughout)
- Support for Arabic and English via i18n config

---

## 8. KEY FEATURES TO ENHANCE

1. **Dashboard Customization**: Let users choose which cards to display
2. **Advanced Filtering**: Date ranges, school selection, bus type filters
3. **Export Functionality**: CSV/PDF reports from dashboard data
4. **Performance Alerts**: Automated rules for on-time, attendance, safety
5. **Activity Logs**: Audit trail of admin actions
6. **Password Management**: Change password, reset flow
7. **Session Management**: Explicit logout, timeout warnings
8. **Dark Mode**: Theme toggle (Tailwind ready)
9. **Comparison Views**: Month-over-month, school-over-school comparisons
10. **Mobile App Dashboard**: Responsive admin app for tablets

---

## 9. SECURITY NOTES

✅ **Implemented**:
- JWT-based authentication
- HttpOnly considerations (stored in localStorage - refactor for better security)
- Protected routes with auth checks
- Automatic token refresh
- Role-based access control (RBAC)

⚠️ **Should Improve**:
- Migrate from localStorage to HttpOnly cookies
- Add CSRF protection
- Implement logout across tabs/windows
- Add rate limiting on auth attempts
- Session timeout with warning
- 2FA/MFA support
- API request signing or nonce validation

---

## 10. PERFORMANCE CONSIDERATIONS

- **Query caching**: TanStack Query automatically caches responses
- **Route prefetching**: Not yet implemented (could preload on hover)
- **Code splitting**: Router automatically splits chunks per route
- **Image optimization**: SVG logos, PNG screenshots (could use next/image or similar)
- **Bundle size**: Recharts adds ~50KB (consider lightweight alternative like Nivo or Chart.js)

---

## Summary

Your EcoBus Admin Console is a **well-structured, modern school transportation management platform** with:
- ✅ Clean TanStack React setup with file-based routing
- ✅ Real-time live data via React Query auto-refetch
- ✅ Role-based access control (super admin vs school admin)
- ✅ Responsive mobile-first design
- ✅ Comprehensive dashboard with 7+ data sources
- ✅ Secure JWT authentication with refresh logic
- ✅ Consistent UI using shadcn/ui + Tailwind

**Next priority areas**: Password reset, session timeout, advanced filtering, export reports, and enhanced security with HttpOnly cookies.

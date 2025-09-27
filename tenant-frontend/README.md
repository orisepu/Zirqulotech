# Checkouters Partners - Frontend

Multi-tenant device trade-in platform frontend built with Next.js 15, React 19, and TypeScript. Part of the Checkouters Partners ecosystem for managing device valuations, client relationships, and business analytics across multiple partner tenants.

## 🏗️ Architecture

- **Framework**: Next.js 15 with App Router and Turbopack
- **UI Library**: Material-UI 7 with custom theme system
- **State Management**: TanStack Query (React Query 5)
- **Multi-tenancy**: Tenant-aware routing and API calls
- **Real-time**: WebSocket chat integration
- **Testing**: Comprehensive API test suite (99 tests, 200+ endpoints)

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

## 📋 Available Scripts

### Development
```bash
pnpm dev               # Start development server (Turbopack enabled)
pnpm build             # Production build
pnpm start             # Serve production build
pnpm typecheck         # TypeScript type checking
pnpm eslint            # Run ESLint on all source files
pnpm eslint:fix        # Auto-fix ESLint issues
```

### Testing
```bash
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Run tests with coverage report
pnpm test:critical     # Run Tier 1 critical API tests (pre-commit)
pnpm test:business     # Run Tier 2 business API tests (CI/CD)
pnpm test:health       # Run API health check (200+ endpoints)
pnpm test:all          # Run all test tiers sequentially
```

## 🧪 Testing Strategy

### Tiered Test Architecture
- **Tier 1 - Critical (30 tests)**: Authentication, tenants, basic CRM, dashboards
- **Tier 2 - Business (42 tests)**: Global operations, devices, B2C contracts, chat
- **Health Check (27 tests)**: Complete endpoint verification

### Workflow Integration
- **Pre-commit**: `pnpm test:critical` - Fast verification (essential APIs)
- **CI/CD**: `pnpm test:all` - Complete regression testing
- **Development**: `pnpm test:watch` - Continuous feedback

## 🏢 Multi-Tenant Features

- **Tenant Isolation**: Complete data separation per partner
- **Dynamic Theming**: Tenant-specific branding and colors
- **Context-Aware API**: Automatic tenant header injection
- **Role-Based Access**: Manager, admin, and employee permissions
- **Global Operations**: Cross-tenant opportunity management

## 🔧 Key Components

### CRM & Opportunities
- Multi-step client onboarding (empresa/autónomo/particular)
- Device valuation wizard with grading system
- Opportunity pipeline management
- Real-time status updates

### Analytics & Dashboards
- Manager and admin analytics dashboards
- KPI tracking and conversion metrics
- Revenue and performance analytics
- Customizable date ranges with MUI DatePicker

### Device Management
- iPhone valuation with commercial/audit pricing
- Device grading system (A+ to D)
- Batch processing for multiple devices
- Integration with external pricing APIs

### Communication
- Real-time chat support system
- Contextual messaging with opportunities
- Notification management
- WebSocket integration

## 🎨 UI/UX Features

- **Material-UI 7**: Modern component library
- **Responsive Design**: Mobile-first approach
- **Dark/Light Themes**: Tenant-configurable themes
- **Spanish Localization**: Full support for Spanish market
- **Accessibility**: WCAG compliant components

## 🔐 Security & Authentication

- **JWT Authentication**: Secure token-based auth
- **Automatic Token Refresh**: Seamless session management
- **Role-Based Permissions**: Granular access control
- **Tenant Context Security**: Isolated data access

## 📊 Performance

- **Turbopack**: Fast development builds
- **TanStack Query**: Optimized server state management
- **Code Splitting**: Automatic route-based splitting
- **Bundle Optimization**: Production-ready builds

## 🛠️ Development

### Tech Stack
- Next.js 15 + React 19 + TypeScript
- Material-UI 7 + Emotion
- TanStack Query + Axios
- Jest + React Testing Library
- ESLint + Prettier

### Project Structure
```
src/
├── components/        # Reusable UI components
├── pages/            # Next.js pages and routing
├── hooks/            # Custom React hooks
├── services/         # API and external services
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
├── __tests__/        # Test files and setup
└── constants/        # App constants and configs
```

## 🌐 Backend Integration

Connects to Django 5 + DRF backend with:
- **API Base**: https://progeek.es
- **Multi-tenant**: django-tenants schema separation
- **Real-time**: Django Channels WebSocket support
- **200+ Endpoints**: Complete business API coverage

## 📈 Recent Updates

### Dashboard Optimizations
- MUI DatePicker integration for better UX
- Removed redundant UI controls
- Improved date range selection

### Testing Infrastructure
- Complete API test coverage (99 tests)
- Tiered testing strategy for CI/CD
- Mock data and helper utilities
- Performance monitoring

### Performance Improvements
- Turbopack development builds
- Enhanced type safety
- Code quality improvements

## 📚 Documentation

For detailed documentation, see [CLAUDE.md](../../../CLAUDE.md) which includes:
- Complete API reference (200+ endpoints)
- Architecture deep dive
- Component documentation
- Development guidelines
- Testing strategies

## 🚢 Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

Built for deployment on Vercel, Netlify, or any Node.js hosting platform.

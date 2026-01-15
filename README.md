# My Tracker

A web application for tracking multiple shipping/tracking numbers simultaneously. Built with Next.js, React, and TypeScript.

## Overview

My Tracker allows users to input multiple tracking numbers (one per line) and query their status from the auodexpress.com API. The application provides real-time status updates with progress tracking and automatically saves user inputs for convenience.

## Features

- **Multi-line Input**: Paste multiple tracking numbers at once (one per line)
- **Batch Processing**: Query all tracking numbers simultaneously
- **Real-time Updates**: Progress counter shows remaining queries
- **Auto-save**: Inputs are automatically saved to server-side storage
- **Status Display**: Shows tracking status and creation date for each number with visual status classification
- **Smart Caching**: Automatically skips querying already-delivered packages to improve performance
- **Status Classification**: Color-coded status display (delivered = red, in-transit = yellow)
- **Express Code Display**: Shows express code for delivered and in-transit items
- **Error Handling**: Graceful error handling with user-friendly messages
- **Responsive Design**: Clean, modern UI built with Tailwind CSS

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 15.5.9 (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5
- **UI Library**: [React](https://react.dev/) 19.0.0
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 3.4.1
- **UI Components**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI + Tailwind CSS)
- **Icons**: [Lucide React](https://lucide.dev/)
- **HTTP Client**: [Axios](https://axios-http.com/) 1.7.9
- **Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/react)
- **Storage**: Server-side file storage (Next.js API Routes)

## Getting Started

### Prerequisites

- **Node.js**: 20.0.0 or higher (recommended: 22.x LTS)
- **Package Manager**: npm, yarn, or pnpm
- A modern web browser

> **Note**: If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` to automatically switch to the correct Node.js version (defined in `.nvmrc`).

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd my-tracker
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000/track](http://localhost:3000/track) in your browser

### Environment Variables (Optional)

For future Supabase integration, create a `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### CORS Proxy Setup

The application uses a CORS proxy to access the external API. On first use:

1. Visit the CORS proxy demo page (embedded in the app or visit directly)
2. Click "Request temporary access to the demo server"
3. This enables the proxy for your browser session

**Note**: The iframe in the application provides quick access to the CORS proxy activation page.

## Project Structure

```
my-tracker/
├── docs/                          # Documentation
│   ├── PRD.md                    # Product Requirements Document (English)
│   ├── PRD.zh.md                 # 产品需求文档 (Chinese)
│   ├── ARCHITECTURE.md           # System architecture documentation
│   ├── API.md                    # External API integration docs
│   └── DATABASE.md               # Database schema documentation
├── public/                        # Static assets
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   ├── globals.css           # Global styles
│   │   └── track/
│   │       ├── __tests__/        # Test files
│   │       │   └── resultList.test.tsx
│   │       ├── page.tsx          # Main tracking page
│   │       └── resultList.tsx    # Results display component
│   ├── components/               # React components
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       └── card.tsx
│   └── lib/                      # Utility functions
│       ├── __tests__/
│       │   └── utils.test.ts
│       └── utils.ts              # Utility functions (cn, etc.)
├── .nvmrc                        # Node.js version (for nvm)
├── components.json               # shadcn/ui configuration
├── jest.config.js                # Jest configuration
├── jest.setup.js                 # Jest setup file
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## Development

### Available Scripts

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests with Jest
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Code Structure

- **Components**: React components in `src/app/` and `src/components/`
- **UI Components**: shadcn/ui components in `src/components/ui/`
- **Styling**: Tailwind CSS utility classes with CSS variables
- **State Management**: React useState hooks
- **API Calls**: Axios for HTTP requests
- **Testing**: Jest with React Testing Library

### Key Files

- `src/app/track/page.tsx` - Main tracking component with state management and API integration
- `src/app/track/resultList.tsx` - Component for displaying tracking results with status classification
- `src/app/layout.tsx` - Root layout with fonts and metadata
- `src/components/ui/button.tsx` - Reusable button component (shadcn/ui)
- `src/components/ui/card.tsx` - Reusable card component (shadcn/ui)
- `src/lib/utils.ts` - Utility functions (cn helper for class merging)

## API Integration

The application integrates with the auodexpress.com tracking API:

- **Base URL**: `http://sys-new-api.auodexpress.com`
- **Endpoint**: `/api/tms/userSys/client/getRouterList`
- **Method**: POST
- **Payload**: `{ wayBillCode: "TRACKING_NUMBER" }`
- **Response**: JSON with tracking status, creation date, and express code
- **CORS**: Uses cors-anywhere.herokuapp.com proxy (requires activation on first use)

**Response Structure**:
```typescript
{
  data: {
    hisList: Array<{ toStatus: string; createDate: string }>,
    wbInfo: { expressCode: string }
  },
  msg: string,
  result: boolean
}
```

See [docs/API.md](docs/API.md) for detailed API documentation.

## Storage

### Current: localStorage

Tracking numbers are stored in the browser's localStorage:
- **Key**: `previousInputs`
- **Format**: JSON array of strings
- **Scope**: Per-browser, per-domain

### Current: Server-side File Storage

Data is stored server-side using file system storage via Next.js API Routes:
- Server restart/deployment persistent
- Cross-device access via internet
- Automatic fallback to localStorage

See [docs/DATABASE.md](docs/DATABASE.md) for storage implementation details.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Configure environment variables
4. Deploy

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Self-hosted (Node.js server)

### Environment Variables

For production deployment (optional):
```
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[PRD.md](docs/PRD.md)** - Product Requirements Document (English)
- **[PRD.zh.md](docs/PRD.zh.md)** - 产品需求文档 (中文版)
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design
- **[API.md](docs/API.md)** - External API integration details
- **[DATABASE.md](docs/DATABASE.md)** - Database schema and migration plans

## Testing

The project includes unit tests using Jest and React Testing Library:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

Test files are located alongside their source files in `__tests__` directories.

## Known Limitations

1. **CORS Proxy Dependency**: Relies on external CORS proxy service (cors-anywhere.herokuapp.com)
2. **Sequential Processing**: API calls are processed one at a time (may be slow for large batches)
3. **Server-side Storage**: Data persists on server, accessible from any device
4. **Single API Source**: Only supports auodexpress.com API
5. **Proxy Activation Required**: CORS proxy requires manual activation on first use

## Future Enhancements

- [ ] Consider database migration for multi-user scenarios
- [ ] Parallel API processing for faster batch queries
- [ ] Input validation for tracking number format
- [ ] Mobile optimization
- [ ] Response caching to reduce redundant API calls (partially implemented with smart caching)
- [ ] Export functionality (CSV/Excel)
- [ ] Query history with timestamps
- [ ] Support for multiple shipping carriers
- [ ] Self-hosted CORS proxy to remove external dependency
- [ ] Next.js API route proxy as alternative to CORS proxy

## Troubleshooting

### Build Errors

If you encounter build errors related to Node.js version:
1. Ensure you're using Node.js 20+ (recommended: 22.x LTS)
2. If using nvm: `nvm use` (uses `.nvmrc` file) or `nvm use 22.19.0`
3. Delete `node_modules` and `package-lock.json`, then run `npm install`

### CORS Proxy Issues

If API calls fail:
1. Visit the CORS proxy demo page: https://cors-anywhere.herokuapp.com/corsdemo
2. Click "Request temporary access to the demo server"
3. Refresh the application

### Module Not Found Errors

If you see module not found errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

[Add your license here]

## Version

Current version: **v0.2.0**

---

For detailed technical documentation, see the [docs/](docs/) directory.

---

For detailed technical documentation, see the [docs/](docs/) directory.

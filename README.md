# My Tracker

A web application for tracking multiple shipping/tracking numbers simultaneously. Built with Next.js, React, and TypeScript.

## Overview

My Tracker allows users to input multiple tracking numbers (one per line) and query their status from the auodexpress.com API. The application provides real-time status updates with progress tracking and automatically saves user inputs for convenience.

## Features

- **Multi-line Input**: Paste multiple tracking numbers at once (one per line)
- **Batch Processing**: Query all tracking numbers simultaneously
- **Real-time Updates**: Progress counter shows remaining queries
- **Auto-save**: Inputs are automatically saved (currently localStorage, Supabase migration planned)
- **Status Display**: Shows tracking status and creation date for each number with visual status classification
- **Smart Caching**: Automatically skips querying already-delivered packages to improve performance
- **Status Classification**: Color-coded status display (delivered = red, in-transit = yellow)
- **Express Code Display**: Shows express code for delivered and in-transit items
- **Error Handling**: Graceful error handling with user-friendly messages
- **Responsive Design**: Clean, modern UI built with Tailwind CSS

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) 15.1.2 (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/) 5
- **UI Library**: [React](https://react.dev/) 19.0.0
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) 3.4.1
- **HTTP Client**: [Axios](https://axios-http.com/) 1.7.9
- **UI Components**: [Material-UI](https://mui.com/) 6.3.0
- **Database**: Supabase (planned migration)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- A modern web browser

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

3. Set up environment variables (for future Supabase integration):
```bash
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000/track](http://localhost:3000/track) in your browser

### CORS Proxy Setup

The application uses a CORS proxy to access the external API. On first use:

1. Visit the CORS proxy demo page (embedded in the app or visit directly)
2. Click "Request temporary access to the demo server"
3. This enables the proxy for your browser session

**Note**: The iframe in the application provides quick access to the CORS proxy activation page.

## Project Structure

```
my-tracker/
├── docs/                    # Documentation
│   ├── PRD.md              # Product Requirements Document
│   ├── ARCHITECTURE.md     # System architecture documentation
│   ├── API.md              # External API integration docs
│   └── DATABASE.md         # Database schema documentation
├── public/                  # Static assets
├── src/
│   └── app/
│       ├── layout.tsx      # Root layout
│       ├── page.tsx        # Home page
│       ├── globals.css     # Global styles
│       └── track/
│           ├── page.tsx    # Main tracking page
│           └── resultList.tsx  # Results display component
├── .env.local.example      # Environment variables template
├── next.config.ts          # Next.js configuration
├── tailwind.config.ts      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies and scripts
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Structure

- **Components**: React components in `src/app/`
- **Styling**: Tailwind CSS utility classes
- **State Management**: React useState hooks
- **API Calls**: Axios for HTTP requests

### Key Files

- `src/app/track/page.tsx` - Main tracking component with state management and API integration
- `src/app/track/resultList.tsx` - Component for displaying tracking results
- `src/app/layout.tsx` - Root layout with fonts and metadata

## API Integration

The application integrates with the auodexpress.com tracking API:

- **Endpoint**: `/api/tms/userSys/client/getRouterList`
- **Method**: POST
- **Payload**: `{ wayBillCode: "TRACKING_NUMBER" }`
- **Response**: JSON with tracking status and creation date

See [docs/API.md](docs/API.md) for detailed API documentation.

## Storage

### Current: localStorage

Tracking numbers are stored in the browser's localStorage:
- **Key**: `previousInputs`
- **Format**: JSON array of strings
- **Scope**: Per-browser, per-domain

### Planned: Supabase Migration

Migration to Supabase is planned to enable:
- Cross-device synchronization
- Better data persistence
- Server-side backup

See [docs/DATABASE.md](docs/DATABASE.md) for database schema and migration details.

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

For Supabase integration (future):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Documentation

Comprehensive documentation is available in the `docs/` directory:

- **[PRD.md](docs/PRD.md)** - Product Requirements Document (English)
- **[PRD.zh.md](docs/PRD.zh.md)** - 产品需求文档 (中文版)
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and design
- **[API.md](docs/API.md)** - External API integration details
- **[DATABASE.md](docs/DATABASE.md)** - Database schema and migration plans

## Known Limitations

1. **CORS Proxy Dependency**: Relies on external CORS proxy service
2. **Sequential Processing**: API calls are processed one at a time (may be slow for large batches)
3. **Local Storage Only**: Data limited to single browser/device (until Supabase migration)
4. **Single API Source**: Only supports auodexpress.com API

## Future Enhancements

- [ ] Migrate to Supabase for cloud storage
- [ ] Parallel API processing for faster batch queries
- [ ] Input validation for tracking number format
- [ ] Mobile optimization
- [ ] Response caching to reduce redundant API calls
- [ ] Export functionality (CSV/Excel)
- [ ] Query history with timestamps
- [ ] Support for multiple shipping carriers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Version

Current version: **v11.19.17**

---

For detailed technical documentation, see the [docs/](docs/) directory.

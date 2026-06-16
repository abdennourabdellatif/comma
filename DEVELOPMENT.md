# Development Guide

## Project Overview

Comma is a React-based AI-powered chat application with mobile support through Capacitor.

## Technology Stack

- **Frontend Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI API**: Google Gemini API
- **Authentication & Database**: Firebase
- **Mobile**: Capacitor for Android
- **Audio Processing**: WaveSurfer.js
- **Package Manager**: npm

## Project Structure

```
comma/
├── src/
│   ├── components/      # React components
│   ├── lib/            # Utilities and helpers
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   ├── index.css       # Global styles
│   ├── AuthContext.tsx # Authentication context
│   ├── ChatArea.tsx    # Chat interface
│   ├── Login.tsx       # Login page
│   ├── MainLayout.tsx  # Main layout
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── SettingsPage.tsx # User settings
│   ├── firebase.ts     # Firebase configuration
│   └── translations.ts # i18n translations
├── public/             # Static assets
├── android/            # Capacitor Android project
├── dist/              # Build output (generated)
├── vite.config.ts     # Vite configuration
├── capacitor.config.ts # Capacitor configuration
└── tsconfig.json      # TypeScript configuration
```

## Development Workflow

### 1. Setting Up Development Environment

```bash
# Clone repository
git clone https://github.com/abdennourabdellatif/comma.git
cd comma

# Install dependencies
npm install

# Create .env.local file with your API keys
cp .env.example .env.local
```

### 2. Environment Variables

Create `.env.local` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:3000
```

### 3. Running Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

The dev server supports:
- Hot Module Replacement (HMR)
- Fast TypeScript checking
- Automatic reload on file changes

### 4. Available Scripts

```bash
# Development
npm run dev              # Start dev server on port 3000

# Building
npm run build            # Build for production
npm run clean            # Clean dist directory
npm run preview          # Preview production build

# Code Quality
npm run lint             # TypeScript type checking

# Mobile Development
npm run mobile:add:android       # Add Android platform
npm run mobile:copy              # Copy web build to Android
npm run mobile:sync              # Sync and build for Android
npm run mobile:android           # Complete mobile sync
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all `.ts` and `.tsx` files
- Define interfaces for component props
- Avoid `any` type - use proper typing

```typescript
interface UserProps {
  name: string;
  age: number;
  onUpdate: (data: UserData) => void;
}
```

### React Components

- Use functional components with hooks
- Keep components modular and reusable
- Extract complex logic into custom hooks

```typescript
const MyComponent: React.FC<MyProps> = ({ prop1, prop2 }) => {
  const [state, setState] = React.useState('');
  
  return <div>{state}</div>;
};
```

### Styling

- Use Tailwind CSS for styling
- Avoid inline styles
- Use clsx/classnames for conditional classes

```typescript
<div className={clsx('p-4', isActive && 'bg-blue-500')}>
  Content
</div>
```

## Firebase Setup

The project uses Firebase for:
- Authentication
- Real-time Database
- Firestore (optional)

Configuration files:
- `firebase.ts` - Firebase client setup
- `firebase-applet-config.json` - Configuration
- `firestore.rules` - Security rules

## Mobile Development

### Android Build

```bash
# First time setup
npm run mobile:add:android

# Build and sync
npm run mobile:sync

# Open in Android Studio
npx cap open android
```

### App Configuration

Edit `capacitor.config.ts` for mobile-specific settings:

```typescript
const config: CapacitorConfig = {
  appId: 'com.comma.app',
  appName: 'comma',
  webDir: 'dist',
};
```

## Testing & Quality Assurance

### Type Checking

```bash
npm run lint
```

Ensure no TypeScript errors before submitting PR.

### Manual Testing

1. Test in development server (`npm run dev`)
2. Test production build (`npm run build && npm run preview`)
3. Test mobile (when applicable)

## Git Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit: `git commit -m "feat: description"`
3. Push to fork: `git push origin feature/feature-name`
4. Create Pull Request

## Debugging

### Browser DevTools

- Open DevTools (F12)
- Check Console for errors
- Use Network tab to inspect API calls

### TypeScript Errors

```bash
npm run lint
```

### Build Issues

```bash
npm run clean  # Clean dist
npm run build  # Rebuild
```

## Common Tasks

### Adding a New Page

1. Create component in `src/`
2. Add route in `App.tsx`
3. Add navigation link in `Sidebar.tsx`

### Adding a New Component

1. Create in `src/components/`
2. Export from component file
3. Import and use in parent component

### Working with Firebase

See `firebase.ts` for setup and usage patterns.

## Performance Tips

- Use React.memo for components that don't need frequent updates
- Lazy load components with React.lazy()
- Use useCallback for stable function references
- Optimize bundle size with code splitting

## Resources

- [Vite Documentation](https://vitejs.dev)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Capacitor Documentation](https://capacitorjs.com)

## Getting Help

- Check existing GitHub issues
- Read the Contributing Guidelines
- Open a new issue with detailed information

Happy coding! 🚀

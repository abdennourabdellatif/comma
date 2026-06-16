<div align="center">
  <h1>💬 Comma</h1>
  <p>A powerful AI-powered chat application with mobile support</p>
</div>

## 🚀 Features

- ✨ AI-powered conversations using Google Gemini API
- 🎙️ Voice/audio processing capabilities
- 📱 Cross-platform support (Web & Android)
- 🎨 Modern UI with React and Tailwind CSS
- 🔐 Firebase integration for authentication and database
- 📦 Built with Vite for fast development

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Java Development Kit (JDK) for Android builds
- Android Studio (for Android development)

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/abdennourabdellatif/comma.git
   cd comma
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `APP_URL`: Your application URL (for development: `http://localhost:3000`)

## 🎯 Development

### Run Locally

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Type Checking

```bash
npm run lint
```

## 📱 Mobile Development

This project is configured with Capacitor for Android packaging.

### First Time Setup

```bash
npm run mobile:add:android
```

### Build and Sync

```bash
npm run mobile:sync
```

### Open in Android Studio

```bash
npx cap open android
```

## 📁 Project Structure

```
├── src/                 # React source files
├── public/              # Static assets
├── android/             # Capacitor Android project
├── dist/                # Built output
├── vite.config.ts       # Vite configuration
├── capacitor.config.ts  # Capacitor configuration
├── firebase-*           # Firebase configuration files
└── firestore.rules      # Firestore security rules
```

## 🔑 Environment Variables

See [.env.example](.env.example) for all available environment variables.

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 👨‍💻 Author

[abdennourabdellatif](https://github.com/abdennourabdellatif)

## 🤝 Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## 📞 Support

If you have any questions or issues, please open an issue on GitHub.

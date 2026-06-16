import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comma.app',
  appName: 'comma',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'fs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  writeFileSync(
    './public/firebase-messaging-sw.js',
    `importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: '${env.VITE_FIREBASE_API_KEY}',
  authDomain: '${env.VITE_FIREBASE_AUTH_DOMAIN}',
  projectId: '${env.VITE_FIREBASE_PROJECT_ID}',
  storageBucket: '${env.VITE_FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${env.VITE_FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${env.VITE_FIREBASE_APP_ID}',
})

// FCM visar notification-payloads automatiskt i bakgrunden.
firebase.messaging()
`
  )

  return {
    plugins: [react()],
    build: {
      rolldownOptions: {
        output: {
          // Egna vendor-chunks: ingen fil över 500 kB och de cachas mellan deployer.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
              { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/](firestore|webchannel-wrapper)[\\/]/ },
              { name: 'firebase', test: /node_modules[\\/](@firebase|firebase|idb|tslib)[\\/]/ },
            ],
          },
        },
      },
    },
  }
})

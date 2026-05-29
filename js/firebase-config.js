/**
 * firebase-config.js — Firebase SDK Initialization for ARViz
 *
 * ⚠️  Replace the placeholder values below with your real Firebase project config.
 *     You can find these in the Firebase Console:
 *     Project Settings → General → Your apps → Web app → SDK setup and configuration
 */

const firebaseConfig = {
  apiKey:            "AIzaSyDEMO_PLACEHOLDER_KEY_REPLACE_ME",
  authDomain:        "your-project-id.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project-id.appspot.com",
  messagingSenderId: "000000000000",
  appId:             "1:000000000000:web:abcdef1234567890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export auth instance globally for use in api.js and main.js
window.firebaseAuth = firebase.auth();

// Configure Google Auth Provider
window.googleAuthProvider = new firebase.auth.GoogleAuthProvider();
googleAuthProvider.addScope('email');
googleAuthProvider.addScope('profile');

console.log("[Firebase] SDK initialized successfully.");

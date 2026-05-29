/**
 * firebase-config.js — Firebase SDK Initialization for ARViz
 */

const firebaseConfig = {
  apiKey:            "AIzaSyCOqkx2oyxAtP8s9V-8vUnPHulRcluDK8M",
  authDomain:        "ecommerce-platform-a4aa6.firebaseapp.com",
  projectId:         "ecommerce-platform-a4aa6",
  storageBucket:     "ecommerce-platform-a4aa6.firebasestorage.app",
  messagingSenderId: "173643812165",
  appId:             "1:173643812165:web:f5b9860c7730b994bd822c",
  measurementId:     "G-L4BCMYFGW2"
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

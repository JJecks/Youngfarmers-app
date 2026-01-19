import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5xvYv-d_INyN4PB-D5ZsDCp29sNvuryo",
  authDomain: "yfarmers-app.firebaseapp.com",
  projectId: "yfarmers-app",
  storageBucket: "yfarmers-app.firebasestorage.app",
  messagingSenderId: "425745432452",
  appId: "1:425745432452:web:24073bf4e3c5dc26f3a7d1",
  measurementId: "G-X193QBDVNW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize Firestore with settings
const db = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

const analytics = getAnalytics(app);

export { auth, db, analytics };

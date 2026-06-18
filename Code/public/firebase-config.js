// Firebase config. On localhost / 127.0.0.1 we run fully against the local
// emulator suite (no real project, no network), so testing never touches
// production data. In production the real web config (filled in at cutover
// from the Firebase console) is used.
//
// NOTE: the web "apiKey" is NOT a secret — it only identifies the project to
// Google's auth servers. Access is controlled by Firestore security rules,
// not by hiding this value.
(function () {
  var LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', ''];
  var isLocal = LOCAL_HOSTS.indexOf(location.hostname) !== -1;

  window.USE_EMULATOR = isLocal;

  window.FIREBASE_CONFIG = isLocal
    ? {
        apiKey: 'demo-key',
        authDomain: 'demo-sport-tracker.firebaseapp.com',
        projectId: 'demo-sport-tracker',
      }
    : {
        apiKey: 'AIzaSyDptFWxxaRpVzAF2QQ7nQfUUAnw39r8_Dc',
        authDomain: 'sport-tracker-vb.firebaseapp.com',
        projectId: 'sport-tracker-vb',
        storageBucket: 'sport-tracker-vb.firebasestorage.app',
        messagingSenderId: '133773343962',
        appId: '1:133773343962:web:dd7eaf4e2be7cc0904f9e3',
      };

  // Web Push (FCM) public VAPID key — from Firebase console → Cloud Messaging →
  // Web Push certificates. Public by design; not used on localhost.
  window.VAPID_KEY = 'BCICq6Q5wcth-w6YRLyp0MvvTill-g33-zqfgWfSy49iy3aAev07jb0UnZRf4tXsDmZgSNOD_F5zmwFkRpf2ay8';
})();

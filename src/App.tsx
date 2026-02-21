import { useState, lazy, Suspense } from 'react';
import { ReactHooks } from '@glennjong/vibe-sheets';
import './App.css';
import SheetSelectorNote from './SheetSelector-note';

const MainLayoutNote = lazy(() => import('./screen/MainLayout-note'));

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SetupScreen = ({ onComplete }: { onComplete: (url: string) => void }) => {
  const { login, accessToken, isAppsScriptEnabled } = ReactHooks.useGoogleAuth({
    clientId
  });

  if (!accessToken) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="card" style={{ color: 'var(--text-main)', textAlign: 'center', padding: '40px 20px', maxWidth: '400px', width: '100%' }}>
          <img src="icons/icon-apple.png" alt="Logo" style={{ width: '100px', marginBottom: '20px' }} />
          <h1 style={{ fontSize: '1.8em', marginBottom: '30px' }}>Welcome to NoteBook</h1>
          <button onClick={login} style={{ fontSize: '1.1em', padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'var(--text-inv)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Login with Google</button>
        </div>
      </div>
    );
  }
  
  if (!isAppsScriptEnabled) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="card" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '20px', maxWidth: '400px' }}>
          { isAppsScriptEnabled === undefined ? 
            <p>Checking your Apps Script permission...</p>
            :
            <>
              <p>Before we start using NoteBook, you need to enable Apps Script.</p>
              <a target="_blank" href="https://script.google.com/home/usersettings?pli=1">Click Me</a>
            </>
          }
        </div>
      </div>
    );
  }

  return (
    <SheetSelectorNote
      token={accessToken}
      onSelect={onComplete}
    />
  );
};

function App() {
  const [selectedScriptUrl, setSelectedScriptUrl] = useState<string | null>(
    localStorage.getItem('vibe_script_url_note') || null
  );

  if (selectedScriptUrl) {
    return (
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-main)' }}>
           <span className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
           <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      }>
        <MainLayoutNote />
      </Suspense>
    );
  }

  return <SetupScreen onComplete={setSelectedScriptUrl} />;
}

export default App;

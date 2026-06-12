'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function PWAUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.ready.then(() => {
      setServiceWorkerReady(true);
    });

    // Listen for controller change (update applied)
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Check for updates
    const checkForUpdates = () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.update();

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker available
                  setUpdateAvailable(true);
                  toast.info('App update available', {
                    description: 'A new version is ready. Refresh to update.',
                  });
                }
              });
            }
          });
        });
      });
    };

    // Check for updates every hour
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (!updateAvailable || !serviceWorkerReady) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-50 border-b border-blue-200 p-4 dark:bg-blue-900 dark:border-blue-800">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            A new version of the app is available
          </span>
        </div>
        <button
          onClick={handleUpdate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <RefreshCw className="h-4 w-4" />
          Update now
        </button>
      </div>
    </div>
  );
}

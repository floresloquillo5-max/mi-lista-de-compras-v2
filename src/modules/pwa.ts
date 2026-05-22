let deferredPrompt: Event | null = null;

export function setupPwaInstall(): void {
  const btn = document.getElementById('installPwaBtn');
  if (!btn) return;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove('hidden');
  });

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as Event & { prompt: () => Promise<void> }).prompt();
    const result = await (deferredPrompt as Event & { userChoice: Promise<{ outcome: string }> }).userChoice;
    if (result.outcome === 'accepted') {
      btn.classList.add('hidden');
    }
    deferredPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    btn.classList.add('hidden');
    deferredPrompt = null;
  });
}

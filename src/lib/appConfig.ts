const APP_NAME = import.meta.env.VITE_APP_NAME || 'Initiative Tracker';

function deriveShortName(name: string) {
  const words = name.trim().split(/\s+/);
  return words.map(w => w[0]).join('').toUpperCase();
}

const APP_SHORT_NAME = import.meta.env.VITE_APP_SHORT_NAME || deriveShortName(APP_NAME);

export { APP_NAME, APP_SHORT_NAME };

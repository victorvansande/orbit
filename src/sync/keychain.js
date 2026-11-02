/* ---- Sleutelhanger: de synccode bewaren als wachtwoord ---- */
// Voorstel A (Victor, 02/11/2026: zijn webapp verloor alle taken toen hij ze van het beginscherm haalde; "stel dat mijn
// computer ook ... dan zijn ze volledig weg"). De versleutelde lijst staat al op de Orbit-server, maar enkel de synccode
// opent ze, en die stond alleen in de opslag van de toestellen. Orbit biedt de code daarom aan als wachtwoord (gebruiker
// "Orbit"), zodat iCloud-sleutelhanger, Google of een wachtwoordbeheerder hem bewaart en op een nieuw toestel invult.
// Chrome en Android: via de Credential Management API (PasswordCredential). Safari en iOS kennen die niet: daar dient
// app.js een gewoon formulier met een wachtwoordveld in naar een onzichtbaar kader, en biedt het toestel zelf aan om
// het te bewaren. Er gaat niets naar een server: het kader laadt about:blank.
const KEY = 'priority-orbit.keychain.v1';   // per toestel: de code die hier al eens aan de sleutelhanger werd aangeboden
export const KEYCHAIN_USER = 'Orbit';

export const canStore = () => typeof window.PasswordCredential === 'function' && Boolean(navigator.credentials?.store);

// Chrome en Android: het toestel vraagt meteen of het de code mag bewaren. Geeft false als het niet lukte.
export async function storeCode(code) {
  if (!canStore()) return false;
  try {
    await navigator.credentials.store(new window.PasswordCredential({ id: KEYCHAIN_USER, name: KEYCHAIN_USER, password: code }));
    return true;
  } catch { return false; }
}

export function wasOffered(code) {
  try { return Boolean(code) && localStorage.getItem(KEY) === code; } catch { return false; }
}
export function markOffered(code) {
  try { localStorage.setItem(KEY, code); } catch { /* geen opslag */ }
}

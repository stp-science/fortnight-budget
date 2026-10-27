export function isGoogleUser(user) {
  return Boolean(user?.uid && user.emailVerified === true &&
    user.providerData?.some(provider => provider.providerId === 'google.com'));
}

// Only the original owner may offer the old, unscoped browser budget for import.
// Other accounts never read it, even on the same computer.
export function canImportLegacy(user, legacyOwnerEmail) {
  return Boolean(legacyOwnerEmail && isGoogleUser(user) &&
    user.email?.toLowerCase() === legacyOwnerEmail.toLowerCase());
}

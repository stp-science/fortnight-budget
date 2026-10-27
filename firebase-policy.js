export function isBudgetOwner(user, allowedEmail) {
  return Boolean(allowedEmail && user?.emailVerified === true &&
    user.email?.toLowerCase() === allowedEmail.toLowerCase() &&
    user.providerData?.some(provider => provider.providerId === 'google.com'));
}

export const navigateToLogin = () => {
  // This function will be mocked in tests
  if (typeof window !== 'undefined' && window.location) {
    window.location.href = "/login";
  }
};
export const auth = {
  // Browser-tab titles, deliberately distinct from the on-page title
  // above (a warm "Welcome back"/"Create your account" heading reads
  // fine on the page but not as a tab title) -- keyed by the same
  // /auth?mode= values validateSearch accepts.
  documentTitle: {
    login: "Sign in",
    signup: "Sign up",
    forgot: "Reset password",
  },
  login: {
    title: "Welcome back",
    desc: "Continue your journey with the Qur'an.",
    cta: "Log in",
  },
  signup: {
    title: "Create your account",
    desc: "Start learning the language of the Qur'an.",
    cta: "Start Learning",
  },
  forgot: {
    title: "Reset your password",
    desc: "We'll email you a secure reset link.",
    cta: "Send reset link",
  },
  fields: {
    firstName: "First name",
    email: "Email",
    password: "Password",
    newPassword: "New password",
  },
  or: "or",
  google: "Continue with Google",
  googleError: "Google sign-in failed. Please try again.",
  forgotLink: "Forgot your password?",
  newHere: "New here?",
  createAccount: "Create an account",
  haveAccount: "Already have an account?",
  confirmSent: "Check your inbox and confirm your email address to activate your account.",
  resetSent: "If that address has an account, a password reset link is on its way.",
  validation: {
    email: "Enter a valid email address.",
    password: "Your password must be at least 8 characters.",
    passwordHint: "At least 8 characters.",
    firstName: "Please tell us your first name.",
  },
  reset: {
    title: "Choose a new password",
    desc: "Open this page from the link in your reset email.",
    cta: "Update password",
    busy: "Updating…",
    success: "Password updated",
  },
};

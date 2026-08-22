import type { auth as EnAuth } from "../en/auth";

export const auth: typeof EnAuth = {
  login: {
    title: "Bon retour parmi nous",
    desc: "Poursuivez votre cheminement avec le Coran.",
    cta: "Se connecter",
  },
  signup: {
    title: "Créez votre compte",
    desc: "Commencez à apprendre la langue du Coran.",
    cta: "Commencer à apprendre",
  },
  forgot: {
    title: "Réinitialiser votre mot de passe",
    desc: "Nous vous enverrons un lien sécurisé par e-mail.",
    cta: "Envoyer le lien",
  },
  fields: {
    firstName: "Prénom",
    email: "Adresse e-mail",
    password: "Mot de passe",
    newPassword: "Nouveau mot de passe",
  },
  or: "ou",
  google: "Continuer avec Google",
  googleError: "La connexion avec Google a échoué. Veuillez réessayer.",
  forgotLink: "Mot de passe oublié ?",
  newHere: "Nouveau ici ?",
  createAccount: "Créer un compte",
  haveAccount: "Vous avez déjà un compte ?",
  confirmSent:
    "Consultez votre boîte de réception et confirmez votre adresse e-mail pour activer votre compte.",
  resetSent: "Si un compte existe pour cette adresse, un lien de réinitialisation vient de partir.",
  validation: {
    email: "Saisissez une adresse e-mail valide.",
    password: "Votre mot de passe doit contenir au moins 8 caractères.",
    passwordHint: "Au moins 8 caractères.",
    firstName: "Indiquez votre prénom.",
  },
  reset: {
    title: "Choisissez un nouveau mot de passe",
    desc: "Ouvrez cette page depuis le lien reçu par e-mail.",
    cta: "Mettre à jour le mot de passe",
    busy: "Mise à jour…",
    success: "Mot de passe mis à jour",
  },
};

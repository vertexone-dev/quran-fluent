import type { bookmarks as EnBookmarks } from "../en/bookmarks";

export const bookmarks: typeof EnBookmarks = {
  title: "Favoris",
  intro: "Les versets que vous avez enregistrés pendant votre lecture.",
  count: "{count} enregistrés",
  add: "Ajouter aux favoris",
  remove: "Retirer des favoris",
  addedToast: "Verset ajouté aux favoris.",
  removedToast: "Favori retiré.",
  savedOn: "Enregistré le {date}",
  openAyah: "Ouvrir le verset",
  loading: "Chargement de vos favoris…",
  empty: {
    title: "Aucun favori pour le moment.",
    body: "Ajoutez des versets à vos favoris pendant votre lecture du Coran.",
  },
  error: {
    title: "Impossible de charger vos favoris.",
    retry: "Réessayer",
  },
};

import type { notes as EnNotes } from "../en/notes";

export const notes: typeof EnNotes = {
  title: "Mes notes",
  intro: "Vos notes d'étude privées sur les versets.",
  add: "Ajouter une note",
  edit: "Modifier la note",
  save: "Enregistrer",
  delete: "Supprimer",
  cancel: "Annuler",
  placeholder: "Écrivez une note privée sur ce verset…",
  deleteConfirmTitle: "Supprimer cette note ?",
  deleteConfirmBody: "Cette action est irréversible.",
  updatedOn: "Mise à jour le {date}",
  openAyah: "Ouvrir le verset",
  loading: "Chargement de vos notes…",
  saveError: "Impossible d'enregistrer votre note. Réessayez.",
  deleteError: "Impossible de supprimer votre note. Réessayez.",
  empty: {
    title: "Aucune note pour le moment.",
    body: "Vos notes d'étude personnelles sur le Coran apparaîtront ici.",
  },
  error: {
    title: "Impossible de charger vos notes.",
    retry: "Réessayer",
  },
};

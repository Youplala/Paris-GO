import { Redirect } from 'expo-router';

/** « Mes photos » est devenu un onglet : l'ancienne adresse y renvoie. */
export default function FieldbookAlias() {
  return <Redirect href="/photos" />;
}

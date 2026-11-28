# Réponse à App Review — brouillon de préparation (issue #45)

**À compléter avant envoi. Ne pas coller ce brouillon dans les Notes App Review.**
Aucun nouveau candidat n’a été construit ou validé sur appareil dans ce correctif. Les anciens
numéros de build ne désignent pas le futur candidat ; les parcours ci-dessous décrivent le code
préparé, à vérifier sur le binaire qui sera effectivement soumis.

## Preuves à réunir avant de rédiger la réponse finale

- [ ] Version, build, SHA, identifiant EAS et build sélectionné dans App Store Connect : à relever
  sur le nouveau candidat après autorisation de construction, pas à déduire de `app.json`.
- [ ] Modèle de chaque appareil physique, version iOS exacte, date et résultats : à relever après
  installation de ce candidat. Séparer explicitement les éventuels tests simulateur.
- [ ] Vidéo du candidat exact : lancement à froid, permissions réellement affichées, parcours
  complet et formulaire sans envoi réel. Nom du fichier joint : à renseigner après vérification.
- [ ] Droits : autorisation écrite de la BHVP toujours manquante dans ce dossier. L’accord de
  principe du CAUE du 9 octobre et la proposition du 10 novembre de solliciter la BHVP ne valent
  pas autorisation des photographies. Réunir les confirmations couvrant chaque usage avant de
  prétendre les joindre ; aucune preuve de droits n’est créée par ce document.
- [ ] URL marketing, assistance et confidentialité réellement configurées dans App Store Connect :
  à vérifier. Les corrections locales de `store.config.json` ne changent pas la console.

### Permissions à vérifier, sans preuve inventée

Le code actuel n’utilise plus les repères ni le capteur d’inclinaison. Ne pas filmer ou annoncer
cette ancienne fonction. Le plugin `expo-location` génère encore `NSMotionUsageDescription` :
ce correctif ne retire pas cette clé native et ne prouve pas l’absence de toute invite système.
Consigner les invites réellement observées ; ne pas présenter une clé de configuration comme
une preuve d’utilisation du capteur ni une absence de code comme une preuve sur appareil.
La caméra et l’accès Photos en ajout uniquement restent inchangés.

## Trame anglaise à finaliser uniquement après validation du candidat

### 1. Screen recording

Attach the reviewed recording of the exact submitted candidate, and state its filename, build,
physical device model and exact iOS version. Do not claim a recording is attached until it is.
The recording must stop before sending the live contribution form.

### 2. Devices and operating systems tested

List only devices and OS versions actually tested with that candidate, with results. No physical
device validation of this branch is established by the local automated checks.

### 3. Purpose and audience

Paris GO is a free, independent, open-source rephotography app for people interested in Paris,
photography and urban history. It helps users find views from the 1970 competition, overlay an
archive photograph on the live camera with adjustable opacity, save their own photo locally,
and prepare a voluntary contribution to the CAUE de Paris campaign, open until 31 May 2027.
No account, login, purchase or subscription is required. The app has no advertising or analytics SDK.

### 4. Access and testing

Confirm these labels and steps on the candidate before sending:

- Onboarding: “Voir autour de moi” requests location; “Explorer sans localisation” skips it.
  Exploration remains available outside Paris, with a Paris fallback when location is unavailable.
- “Accueil” lists historic viewpoints. Open a station to see the archive image, author and BHVP
  credits; published retakes provide a before/after comparison.
- “Carte” shows the grid and stations. “Communauté” shows public comparisons and contributors.
  “Signaler cette photo” prepares an email to the campaign team; without a mail handler an in-app
  fallback exposes the report details. Nothing is sent without the user's action.
- “Refaire cette photo” opens the camera and archive overlay. Capture, review, then “Enregistrer
  ma photo” saves using add-only Photos permission. Verify actual permission behavior on device.
- “Préparer le dépôt officiel” opens https://opppp.cartes.xyz/elements/add in a WebView and
  prepares date, place, coordinates, device model and the archive/current image files. Identity
  is prefilled only after explicit opt-in to save it locally; otherwise the user enters it.
  Consent boxes are never ticked automatically and the app never submits the form. Do not press
  the site's final send button: this is a live public campaign, not a test service.
- Verify the third-party loading/error state and retry behavior without making a real deposit.

### 5. External services

Apple MapKit on iOS; Google Maps SDK on Android; OpenStreetMap detail-map tiles;
GitHub raw-content delivery for public snapshots with a bundled fallback; the BHVP public viewer
for archive images via permalinks; the WordPress.com image proxy (`i0.wp.com`, Automattic);
GoGoCarto at `opppp.cartes.xyz` for the embedded official form. The upstream API is queried by
an offline snapshot-generation script, not by the app at runtime. The developer operates no
user-account or photo-storage backend. Cross-check this list against the final candidate.

### 6. Regions

The subject is Paris and the interface is French. Exploration can be tested outside Paris; taking
a faithful retake requires being at the viewpoint. Confirm regional behavior on the candidate.

### 7. Regulated services and third-party material

Paris GO does not provide regulated services. It displays campaign records, published retakes,
contributor attribution and the official grid; archive photographs are loaded on demand from
BHVP permalinks, not bundled. Some descriptive metadata comes from `paris-1970`. OpenStreetMap
is attributed under ODbL. Public access, attribution and the MIT code licence do not establish
permission to reuse photographs, campaign data or institutional branding. Do not claim written
authorization or attachments until the applicable rightsholders have supplied them.

Public credits: https://youplala.github.io/Paris-GO/sources/
Support: https://youplala.github.io/Paris-GO/support/
Privacy: https://youplala.github.io/Paris-GO/confidentialite/
Contact: eliebrosset@gmail.com

## Notes App Review

Rédiger une version courte seulement après clôture de la checklist. Reprendre les sept rubriques,
le candidat exact et les preuves réelles ; ne copier ni ce brouillon ni des champs « à compléter ».

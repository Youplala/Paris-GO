# Enregistrement vidéo pour App Review (point 1)

**À compléter avant envoi.** Aucun appareil, version iOS, build ou fichier vidéo n’est validé par
ce script. Filmer sur un iPhone physique le candidat exact qui sera soumis, depuis son lancement,
avec les permissions réellement affichées. Ne pas utiliser un development build comme preuve du
binaire soumis. Durée indicative : 4 à 6 minutes, sans masquer les erreurs ni les attentes.

## Avant de filmer

- [ ] Candidat : relever version, numéro de build, SHA et identifiant EAS/App Store Connect après
  sa construction autorisée. Ne pas réutiliser un ancien numéro de build par défaut.
- [ ] Appareil et OS : relever le modèle exact et la version dans Réglages ; vérifier la version
  demandée par Apple. Ne pas déduire ces informations d’une ancienne session.
- [ ] Installer ce candidat depuis TestFlight. Réinstaller ou réinitialiser les permissions pour
  rendre les invites observables, puis ne pas ouvrir l’app avant l’enregistrement.
- [ ] Vérifier la connexion et https://opppp.cartes.xyz/elements/add dans Safari, sans envoi.
  Si le service est indisponible, consigner l’échec et garder la validation du parcours en attente.
- [ ] Activer Ne pas déranger ; masquer notifications, visages, lieux privés et données personnelles.

## Déroulé

1. Depuis l’écran d’accueil iOS, lancer Paris GO à froid.
2. Parcourir l’onboarding, choisir la localisation et montrer l’invite si elle apparaît. Vérifier
   séparément que « Explorer sans localisation » permet l’exploration avec repli sur Paris.
3. Montrer l’accueil, ouvrir une station, attendre l’archive et ses crédits BHVP ; faire glisser
   le comparateur si une reprise existe.
4. Ouvrir Carte, montrer la grille et un marqueur, puis revenir à une fiche.
5. Ouvrir Communauté, une comparaison puis « Signaler cette photo ». Montrer le brouillon ou le
   repli sans app Mail ; annuler sans envoyer et sans exposer l’adresse personnelle d’expéditeur.
6. Depuis une station, ouvrir « Refaire cette photo ». Montrer l’autorisation caméra si demandée,
   la caméra en direct, la superposition et le réglage d’opacité, puis prendre une photo.
   Les anciennes aides d’inclinaison sont retirées : ne pas chercher à les démontrer. Consigner
   toute invite inattendue ; la clé native de mouvement n’est pas retirée par ce correctif.
7. Sur la revue, toucher « Enregistrer ma photo », montrer l’accès Photos en ajout uniquement
   s’il est demandé et vérifier la confirmation. Ne pas présenter un échec comme un succès.
8. Ouvrir « Préparer le dépôt officiel », parcourir le guide puis le formulaire GoGoCarto.
   Vérifier les champs préparés et les deux pièces jointes sur ce candidat exact.
   Sans identité mémorisée, les champs personnels restent à saisir ; tester séparément le choix
   explicite de mémorisation locale avec des données non sensibles, puis les oublier.
   **Ne cocher aucun consentement et ne pas envoyer le formulaire.** Fermer la vue web.
9. Si le formulaire échoue, montrer l’erreur et le retour à l’app ; garder la validation du
   formulaire en attente. Montrer uniquement les permissions réellement présentes dans Réglages.
10. Arrêter l’enregistrement.

## Après

1. Regarder toute la vidéo : lancement visible, permissions réelles, aucun envoi et aucune donnée
   personnelle. Relever le modèle, iOS, le candidat, la date et les résultats de test.
2. Transférer la vidéo sur le Mac. Si nécessaire, convertir sans masquer de comportement :

   ```bash
   ffmpeg -i Enregistrement.mov -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart -an reprise-app-review.mp4
   ```

3. Renseigner le nom réel du fichier dans la réponse, puis vérifier aussi les autorisations écrites
   de contenus tiers avec la checklist de [REPONSE-APP-STORE-CONNECT.md](REPONSE-APP-STORE-CONNECT.md).
4. Seulement après validation humaine, préparer la réponse finale et ses pièces jointes dans
   App Store Connect. Ce script n’autorise ni l’envoi, ni la resoumission, ni une publication.

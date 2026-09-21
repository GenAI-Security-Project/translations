<!-- status: draft -->
# ASI08 : Défaillances en cascade

## Description

Les défaillances en cascade agentiques se produisent lorsqu'une seule faute (hallucination, entrée malveillante, outil corrompu ou mémoire empoisonnée) se propage à travers des agents autonomes, s'amplifiant en un dommage à l'échelle du système. Comme les agents planifient, persistent et délèguent de manière autonome, une seule erreur peut contourner les contrôles humains par étapes et persister dans un état sauvegardé. À mesure que les agents forment des liens émergents avec de nouveaux outils ou pairs, ces failles latentes s'enchaînent en opérations privilégiées qui compromettent la confidentialité, l'intégrité et la disponibilité, entraînant des défaillances de service généralisées à travers les réseaux d'agents, les systèmes et les flux de travail.

Les défaillances en cascade décrivent la propagation et l'amplification d'une faute initiale - et non la vulnérabilité initiale elle-même - à travers les agents, les outils et les flux de travail, transformant une seule erreur en un impact à l'échelle du système.

ASI08 se concentre sur la propagation et l'amplification des fautes plutôt que sur leur origine. Utilisez le défaut initial dans le cadre d'ASI04, ASI06 ou ASI07 lorsqu'il représente une compromission directe - comme une dépendance corrompue, une mémoire empoisonnée ou un message usurpé - et n'appliquez ASI08 que lorsque ce défaut se propage à travers des agents, des sessions ou des flux de travail, causant une propagation mesurable ou un impact systémique au-delà de la brèche d'origine.

Les symptômes observables incluent une propagation rapide où une décision défectueuse déclenche de nombreux agents ou tâches en aval en peu de temps, une propagation inter-domaines ou inter-locataires au-delà du contexte d'origine, des oscillations de nouvelles tentatives ou des boucles de rétroaction entre agents, ainsi que des tempêtes de files d'attente en aval ou des intentions identiques répétées - fournissant chacune des indices de détection clairs qui rendent ASI08 opérationnellement actionnable.

Les défaillances en cascade s'amplifient à travers les agents interconnectés, enchaînant les risques du OWASP LLM Top 10. LLM01:2025 (Injection de prompt) et LLM06:2025 (Agence excessive) peuvent déclencher des exécutions autonomes d'outils qui propagent des erreurs sans contrôles humains, tandis que LLM04:2025 (Empoisonnement des données et du modèle) dans la mémoire persistante peut fausser les décisions à travers les sessions et les flux de travail. Agentic AI - Threats and Mitigations 1.1 traite de cette menace dans T5 – Cascading Hallucination Attacks, tandis que T8 – Repudiation and Untraceability met en évidence une défense fondamentale : la capacité de tracer, d'attribuer et d'auditer les comportements en cascade grâce à des mécanismes de journalisation résiliente et de non-répudiation qui empêchent la propagation silencieuse. Cependant, ces menaces cumulatives illustrent un écart potentiel entre la vitesse et l'échelle de la propagation des fautes dans un système multi-agents et la capacité des humains à suivre le rythme pour garantir un fonctionnement sûr et efficace du système. Cela laisse certains risques non atténués que l'entreprise doit évaluer soigneusement pour s'assurer qu'ils restent dans le budget de risque global de l'organisation.

## Exemples courants de la vulnérabilité

1. Couplage planificateur-exécuteur : Un planificateur halluciné ou compromis émet des étapes non sécurisées que l'exécuteur exécute automatiquement sans validation, multipliant l'impact à travers les agents.

2. Mémoire persistante corrompue : Des objectifs à long terme ou des entrées d'état empoisonnés continuent d'influencer de nouveaux plans et délégations, propageant la même erreur même après la disparition de la source d'origine.

3. Cascades inter-agents provenant de messages empoisonnés : Une seule mise à jour corrompue amène des agents pairs à agir sur de fausses alertes ou instructions de redémarrage, propageant des perturbations à travers les régions.

4. Mauvaise utilisation d'outils en cascade et élévation de privilèges. La mauvaise utilisation par un agent d'une intégration ou d'un identifiant élevé amène des agents en aval à répéter des actions non sécurisées ou à divulguer des données héritées.

5. Cascade de déploiement automatique à partir d'une mise à jour corrompue : Une version empoisonnée ou défectueuse poussée par un orchestrateur se propage automatiquement à tous les agents connectés, amplifiant la brèche au-delà de son origine.

6. Dérive de gouvernance en cascade : La surveillance humaine s'affaiblit après des succès répétés ; des approbations en masse ou des assouplissements de politique propagent une dérive de configuration non contrôlée à travers les agents.

7. Amplification par boucle de rétroaction. Deux agents ou plus s'appuient sur les sorties de l'autre, créant une boucle auto-renforçante qui amplifie les erreurs initiales ou les faux positifs.

## Exemples de scénarios d'attaque

1. Cascade de trading financier : L'injection de prompt (LLM01:2025) empoisonne un agent d'analyse de marché, gonflant les limites de risque ; les agents de position et d'exécution effectuent automatiquement des transactions de plus grandes positions tandis que la conformité reste aveugle à l'activité « conforme aux paramètres ».

2. Propagation de protocole en santé : La falsification de la chaîne d'approvisionnement (ASI04) corrompt les données médicamenteuses ; le traitement ajuste automatiquement les protocoles, et la coordination des soins les propage à l'échelle du réseau sans examen humain.

3. Panne d'orchestration cloud : L'empoisonnement (LLM04:2025) dans la planification des ressources ajoute des permissions non autorisées et du gonflement ; la sécurité les applique, et le déploiement provisionne une infrastructure coûteuse et compromise par une porte dérobée sans approbation par changement.

4. Compromission des opérations de sécurité : Des identifiants de service volés - via LLM06:2025 et LLM03:2025 - font que les défenses de détection marquent de vraies alertes comme fausses, que la réponse aux incidents désactive les contrôles et purge les journaux, et que la conformité rapporte des métriques propres.

5. Défaillance du contrôle qualité (QC) en fabrication : L'injection de mémoire (ASI06) avec des connaissances empoisonnées (LLM08:2025) fait que le QC approuve des défauts et rejette de bons articles ; l'inventaire et la planification s'optimisent sur de mauvaises données, causant des expéditions défectueuses et des pertes.

6. Boucle de rétroaction de remédiation automatique : Un agent de remédiation supprime des alertes pour respecter des SLA de latence ; un agent de planification interprète moins d'alertes comme un succès et élargit l'automatisation, aggravant potentiellement les angles morts à travers les régions.

7. Une panne DNS régionale du cloud chez un hyperscaler peut simultanément casser plusieurs services d'IA qui en dépendent, provoquant une cascade de défaillances d'agents à travers de nombreuses organisations.

8. Systèmes de cyberdéfense agentiques et pare-feu : La propagation d'une hallucination concernant une attaque imminente ou d'une fausse alerte injectée se propage dans les systèmes multi-agents sous-jacents, provoquant des actions défensives inutiles mais catastrophiques, telles que des arrêts, des refus et des déconnexions réseau.

## Directives de prévention et d'atténuation

1. Modèle de confiance zéro dans la conception d'application : concevoir le système avec une tolérance aux pannes qui suppose une défaillance de disponibilité des composants LLM:2025, des fonctions agentiques et des sources externes.

2. Isolation et limites de confiance : Bac à sable pour les agents, moindre privilège, segmentation réseau, API à portée limitée et authentification mutuelle pour contenir la propagation des défaillances.

3. Accès aux outils juste-à-temps, à usage unique, avec vérifications au moment de l'exécution : Émettre des identifiants de courte durée, limités à une tâche, pour chaque exécution d'agent et valider chaque invocation d'outil à fort impact par rapport à une règle de politique en tant que code avant de l'exécuter. Cela garantit qu'un agent compromis ou en dérive ne peut pas déclencher de réactions en chaîne à travers d'autres agents ou systèmes.

4. Application de politique indépendante : Séparer la planification et l'exécution via un moteur de politique externe pour empêcher qu'une planification corrompue ne déclenche des actions nuisibles.

5. Validation des sorties et points de contrôle humains : Points de contrôle, agents de gouvernance ou examen humain pour les risques élevés avant que les sorties de l'agent ne soient propagées en aval.

6. Limitation de débit et surveillance : Détecter les commandes se propageant rapidement et limiter ou suspendre en cas d'anomalies.

7. Mettre en œuvre des garde-fous de rayon d'explosion tels que des quotas, des plafonds de progression, des disjoncteurs entre le planificateur et l'exécuteur.

8. Détection de dérive comportementale et de gouvernance : Suivre les décisions par rapport aux références et à l'alignement ; signaler la dégradation progressive.

9. Rejeu par jumeau numérique et contrôle des politiques : Rejouer les actions d'agent enregistrées de la semaine précédente dans un clone isolé de l'environnement de production pour tester si la même séquence déclencherait des défaillances en cascade. Conditionner toute extension de politique à la réussite de ces tests de rejeu par rapport à des plafonds de rayon d'explosion prédéfinis avant le déploiement.

10. Journalisation et non-répudiation. Enregistrer tous les messages inter-agents, décisions de politique et résultats d'exécution dans des journaux horodatés et inviolables liés à des identités d'agent cryptographiques. Maintenir des métadonnées de lignage pour chaque action propagée afin de soutenir la traçabilité forensique, la validation des retours en arrière et la responsabilité lors des cascades.

## Références

1. https://sre.google/sre-book/addressing-cascading-failures/

2.

https://cwe.mitre.org/data/definitions/400.html

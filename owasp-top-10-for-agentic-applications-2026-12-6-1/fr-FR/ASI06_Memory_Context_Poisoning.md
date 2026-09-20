<!-- status: draft -->
# ASI06 : Empoisonnement de la mémoire et du contexte

## Description

Les systèmes agentiques reposent sur des informations stockées et récupérables, qui peuvent être un

instantané de leur historique de conversation, un outil de mémoire ou un contexte étendu, ce qui permet

d'assurer la continuité entre les tâches et les cycles de raisonnement.

Le contexte inclut toute information qu'un agent conserve, récupère ou réutilise, telle que des résumés,

des embeddings et des magasins RAG, mais exclut les prompts d'entrée ponctuels couverts par

LLM01:2025 Prompt Injection.

Dans l'empoisonnement de la mémoire et du contexte, les adversaires corrompent ou implantent ce

contexte avec des données malveillantes ou trompeuses, ce qui entraîne un raisonnement, une

planification ou une utilisation d'outils futurs biaisés, dangereux ou favorisant l'exfiltration. Les sources

d'ingestion telles que les téléversements, les flux API, les saisies utilisateur ou les échanges entre agents

pairs peuvent ne pas être fiables ou n'être que partiellement validées.

Ce risque est distinct de ASI01 (Détournement d'objectif de l'agent), qui capture la manipulation directe

des objectifs, et de ASI08 (Défaillances en cascade), qui décrit la dégradation survenant après

l'empoisonnement. Cependant, l'empoisonnement de la mémoire conduit fréquemment à un détournement

d'objectif (ASI01), car un contexte corrompu ou une mémoire à long terme altérée peut modifier

l'interprétation de l'objectif de l'agent, son cheminement de raisonnement ou sa logique de sélection

d'outils.

Il s'appuie sur LLM01:2025 Prompt Injection, LLM04:2025 Data and Model Poisoning et LLM08:2025 Vector

and Embedding Weaknesses, mais se concentre sur la corruption persistante de la mémoire de l'agent et

du contexte récupérable qui se propage à travers les sessions et altère le raisonnement autonome.

Il correspond à T1 Memory Poisoning dans Agentic Threats and Mitigations, avec des impacts connexes

dans T4 Memory Overload, T6 Broken Goals et T12 Shared Memory Poisoning. Dans AIVSS, les champs

AARS Memory Use et Contextual Awareness augmentent le score de vulnérabilité agentique.

## Exemples courants de vulnérabilité

1. Empoisonnement RAG et des embeddings : des données malveillantes ou manipulées entrent dans

la base de données vectorielle via des sources empoisonnées, des téléversements directs ou des

pipelines trop dignes de confiance. Cela entraîne de fausses réponses qui sont considérées comme

des charges utiles ciblées.

2. Empoisonnement du contexte utilisateur partagé : des contextes réutilisés ou partagés permettent

aux attaquants d'injecter des données via des conversations normales, influençant les sessions

ultérieures. Les effets incluent la désinformation, l'exécution de code dangereux ou des actions

d'outils incorrectes.

Page 24

genai.owasp.org

3. Manipulation de la fenêtre de contexte : un attaquant injecte un contenu conçu dans une

conversation ou une tâche en cours afin qu'il soit ultérieurement résumé ou persisté en mémoire,

contaminant le raisonnement ou les décisions futures même après la fin de la session d'origine.

4. Dérive de la mémoire à long terme : une exposition progressive à des données subtilement

altérées, des résumés ou des retours d'agents pairs modifie graduellement les connaissances

stockées ou la pondération des objectifs, produisant des déviations comportementales ou de

politique au fil du temps.

5. Désalignement systémique et portes dérobées : une mémoire empoisonnée modifie la persona du

modèle et implante des portes dérobées déclenchées par des déclencheurs qui exécutent des

instructions cachées, telles que du code destructeur ou des fuites de données.

6. Propagation inter-agents : le contexte contaminé ou la mémoire partagée se propage entre les

agents coopérants, aggravant la corruption et permettant des fuites de données à long terme ou

une dérive coordonnée

## Exemples de scénarios d'attaque

1. Empoisonnement de la mémoire de réservation de voyage : un attaquant renforce continuellement

un faux prix de vol, l'assistant le stocke comme vérité, puis approuve les réservations à ce prix et

contourne les vérifications de paiement.

2. Exploitation de la fenêtre de contexte : l'attaquant répartit ses tentatives sur plusieurs sessions afin

que les rejets antérieurs sortent du contexte, et l'IA finit par accorder des permissions croissantes

jusqu'à l'accès administrateur.

3. Empoisonnement de la mémoire pour le système : l'attaquant réentraîne la mémoire d'une IA de

sécurité pour qualifier une activité malveillante de normale, laissant passer des attaques sans être

détectées.

4. Empoisonnement de la mémoire partagée : l'attaquant insère de fausses politiques de

remboursement dans la mémoire partagée, d'autres agents les réutilisent, et l'entreprise subit de

mauvaises décisions, des pertes et des litiges.

5. Fuite vectorielle inter-locataires : un contenu quasi dupliqué implanté par un attaquant exploite

- -

des filtres d'espace de noms laxistes, faisant entrer dans la récupération un fragment sensible d'un

autre locataire par similarité cosinus élevée

6. Empoisonnement de la mémoire de l'assistant : un attaquant implante la mémoire de l'assistant

d'un utilisateur via une injection de prompt indirecte, compromettant les sessions actuelles et

futures de cet utilisateur.

## Directives de prévention et d'atténuation

1. Protection de base des données : chiffrement en transit et au repos combiné à un accès selon le

principe du moindre privilège

2. Validation du contenu : analyser toutes les nouvelles écritures en mémoire et les sorties du modèle

(règles + IA) à la recherche de contenu malveillant ou sensible avant validation.

3. Segmentation de la mémoire : isoler les sessions utilisateur et les contextes de domaine pour

éviter la fuite de connaissances et de données sensibles.

4. Accès et rétention : n'autoriser que des sources authentifiées et sélectionnées ; appliquer un accès

contextuel par tâche ; minimiser la rétention en fonction de la sensibilité des données.

5. Provenance et anomalies : exiger l'attribution des sources et détecter les mises à jour ou

fréquences suspectes.

Page 25

genai.owasp.org

6. Empêcher la réingestion automatique des sorties générées par l'agent lui-même dans la mémoire

de confiance afin d'éviter une contamination auto-renforcée ou un « empoisonnement

d'amorçage ».

7. Résilience et vérification : effectuer des tests adverses, utiliser des instantanés/retours en arrière

et un contrôle de version, et exiger une revue humaine pour les actions à haut risque. Lorsque vous

exploitez des magasins de vecteurs ou de mémoire partagés, utilisez des espaces de noms par

locataire et des scores de confiance pour les entrées, en faisant décroître ou expirer la mémoire

non vérifiée au fil du temps et en prenant en charge le retour en arrière/la mise en quarantaine en

cas de suspicion d'empoisonnement.

8. Faire expirer la mémoire non vérifiée pour limiter la persistance de l'empoisonnement.

9. Pondérer la récupération par confiance et par locataire : exiger deux facteurs pour faire apparaître

une mémoire à fort impact (par exemple, un score de provenance associé à une étiquette vérifiée

par un humain) et faire décroître les entrées à faible confiance au fil du temps.

## Références

1. New hack uses prompt injection to corrupt Gemini's long-term memory,

https://arstechnica.com/security/2025/02/new-hack-uses-prompt-injection-
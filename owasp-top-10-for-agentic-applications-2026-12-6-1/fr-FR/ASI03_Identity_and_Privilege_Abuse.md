<!-- status: draft -->
# ASI03 : Abus d'identité et de privilèges

## Description

L'abus d'identité et de privilèges exploite la confiance dynamique et la délégation au sein des agents pour

escalader les accès et contourner les contrôles en manipulant les chaînes de délégation, l'héritage de rôles,

les flux de contrôle et le contexte de l'agent ; ce contexte inclut les identifiants mis en cache ou l'historique

des conversations à travers des systèmes interconnectés. Dans ce contexte, l'identité désigne à la fois le

persona défini de l'agent et tout élément d'authentification qui le représente. La confiance agent-à-agent ou

les identifiants hérités peuvent être exploités pour escalader les accès, détourner des privilèges ou exécuter

des actions non autorisées.

Ce risque découle de l'inadéquation architecturale entre les systèmes d'identité centrés sur l'utilisateur et la

conception agentique. Sans identité distincte et gouvernée qui lui soit propre, un agent opère dans un vide

d'attribution qui rend impossible l'application d'un véritable moindre privilège. L'identité, dans ce contexte,

inclut à la fois le persona attribué à l'agent et tout élément d'authentification (clés API, jetons OAuth,

sessions utilisateur déléguées) qui le représente.

Cela diffère du scénario décrit dans ASI02 (Utilisation abusive des outils), qui concerne une utilisation non

intentionnelle ou dangereuse d'un privilège déjà accordé par un principal qui abuse de ses propres outils.

L'abus d'identité et de privilèges constitue l'évolution agentique de l'Agence excessive (LLM06:2025). Il

exploite souvent l'injection de prompt (LLM01:2025), et en raison des permissions de l'agent, des

intégrations d'outils et des systèmes multi-agents, l'impact peut s'amplifier et dépasser la divulgation

d'informations sensibles (LLM02:2025) pour compromettre directement la confidentialité, l'intégrité et la

disponibilité des systèmes et des données auxquels l'agent peut accéder.

Dans le référentiel OWASP ASI Threats and Mitigations, il correspond directement à T3: Privilege

Compromise, et dans l'OWASP AIVSS, il correspond au Core Risk 2: Agent Access Control Violation.

## Exemples courants de la vulnérabilité

1. Héritage de privilèges non délimité. Se produit lorsqu'un gestionnaire à haut privilège délègue des

tâches sans appliquer une délimitation de moindre privilège - souvent par commodité ou en raison

de limites architecturales - en transmettant l'intégralité de son contexte d'accès. Un travailleur

restreint reçoit alors des droits excessifs. Les agents low-code ou no-code disposant de privilèges

par défaut, tels qu'un accès Internet non restreint, héritent également de plus d'autorité que prévu.

2. Rétention de privilèges basée sur la mémoire et fuite de données. Survient lorsque les agents

mettent en cache des identifiants, des clés ou des données récupérées pour le contexte et la

réutilisation. Si la mémoire n'est pas segmentée ou effacée entre les tâches ou les utilisateurs, les

attaquants peuvent inciter l'agent à réutiliser des secrets mis en cache, à escalader les privilèges ou

à faire fuiter des données d'une session sécurisée antérieure vers une session plus faible.

3. Exploitation de la confiance inter-agents (Confused Deputy). Dans les systèmes multi-agents, les

agents font souvent confiance par défaut aux requêtes internes. Un agent compromis à faible

privilège peut relayer des instructions d'apparence valide à un agent à privilège élevé, qui les

exécute sans revérifier l'intention initiale de l'utilisateur - abusant ainsi de ses permissions

élevées.

4. Time-of-Check to Time-of-Use (TOCTOU) dans les flux de travail des agents. Les permissions

peuvent être validées au début d'un flux de travail mais changer ou expirer avant l'exécution. L'agent

poursuit avec une autorisation obsolète, effectuant des actions que l'utilisateur n'a plus le droit

d'approuver.

5. Injection d'identité synthétique. Les attaquants usurpent l'identité d'agents internes en utilisant des

descripteurs non vérifiés (par exemple, « Admin Helper ») pour obtenir une confiance héritée et

effectuer des actions privilégiées sous une identité fabriquée.

## Exemples de scénarios d'attaque

1. Abus de privilège délégué : Un agent financier délègue à un agent de « requête base de données »

mais lui transmet toutes ses permissions. Un attaquant orientant les prompts de requête utilise

l'accès hérité pour exfiltrer des données RH et juridiques.

2. Escalade basée sur la mémoire : Un agent administrateur informatique met en cache des

identifiants SSH lors d'un correctif. Plus tard, un utilisateur non administrateur réutilise la même

session et lui demande d'utiliser ces identifiants pour créer un compte non autorisé.

3. Exploitation de la confiance inter-agents : Un courriel forgé provenant du service informatique

demande à un agent de tri des courriels d'instruire un agent financier de transférer de l'argent vers

un compte spécifique. L'agent de tri le transmet, et l'agent financier, faisant confiance à un agent

interne, traite le paiement frauduleux sans vérification.

4. Hameçonnage par code d'appareil entre agents : Un attaquant partage un lien de code d'appareil

qu'un agent de navigation suit ; un agent « assistant » distinct complète le code, liant le tenant de la

victime aux portées d'accès de l'attaquant.

5. Dérive d'autorisation dans le flux de travail : Un agent d'approvisionnement valide l'approbation au

début d'une séquence d'achat. Quelques heures plus tard, la limite de dépense de l'utilisateur est

réduite, mais le flux de travail se poursuit avec l'ancien jeton d'autorisation, complétant la transaction

désormais non autorisée.

6. Persona d'agent falsifié : Un attaquant enregistre un faux agent « Admin Helper » dans un registre

Agent2Agent interne avec une carte d'agent falsifiée. D'autres agents, faisant confiance au

descripteur, acheminent des tâches de maintenance privilégiées vers celui-ci. L'agent contrôlé par

l'attaquant émet alors des commandes au niveau système sous couvert d'une confiance interne

présumée.

7. Partage d'identité. Un agent obtient l'accès à des systèmes au nom d'un utilisateur, souvent son

créateur. Il permet ensuite à d'autres utilisateurs de tirer parti implicitement de cette identité en

invoquant ses outils sous cette identité.

## Directives de prévention et d'atténuation

1. Appliquer des permissions délimitées par tâche et limitées dans le temps : Émettre des jetons

de courte durée et étroitement délimités par tâche, et plafonner les droits avec des limites de

permission - en utilisant des identités par agent et des identifiants de courte durée (par exemple,

certificats mTLS ou jetons délimités) - pour limiter le rayon d'impact, bloquer les abus délégués et

les attaques de fenêtre de maintenance, et atténuer l'héritage non délimité, les privilèges orphelins

et l'élévation par boucle de réflexion.

2. Isoler les identités et les contextes des agents : Exécuter des bacs à sable par session avec des

permissions et une mémoire séparées, en effaçant l'état entre les tâches pour prévenir l'escalade

basée sur la mémoire et réduire l'exfiltration de données inter-dépôts.

3. Exiger une autorisation par action : Revérifier chaque étape privilégiée avec un moteur de

politique centralisé qui vérifie les données externes, arrêtant l'exploitation de la confiance inter-

agents et l'élévation par boucle de réflexion.

4. Appliquer une supervision humaine (Human-in-the-Loop) pour l'escalade de privilèges : Exiger

une approbation humaine pour les actions à haut privilège ou irréversibles afin de fournir un filet de

sécurité qui arrêterait l'escalade basée sur la mémoire, l'exploitation de la confiance inter-agents et

les attaques de fenêtre de maintenance.

5. Définir l'intention : Lier les jetons OAuth à une intention signée incluant le sujet, l'audience, le but et

la session. Rejeter toute utilisation de jeton où l'intention liée ne correspond pas à la requête

actuelle.

6. Évaluer les plateformes de gestion d'identité agentique. Les principales plateformes intègrent les

agents dans leurs systèmes de gestion des identités et des accès, en les traitant comme des

identités non humaines gérées avec des identifiants délimités, des pistes d'audit et des contrôles de

cycle de vie. Des exemples incluent Microsoft Entra, AWS Bedrock Agents, Salesforce Agentforce, le

modèle Agentic System of Record (ASOR) de Workday, et des modèles émergents similaires dans

Google Vertex AI.

7. Lier les permissions au sujet, à la ressource, au but et à la durée. Exiger une réauthentification

lors d'un changement de contexte. Empêcher l'héritage de privilèges entre agents à moins que

l'intention initiale ne soit revalidée. Inclure une révocation automatisée en cas d'inactivité ou

d'anomalie.

8. Détecter les permissions déléguées et transitives : Surveiller les cas où un agent obtient de

nouvelles permissions indirectement par le biais de chaînes de délégation. Signaler les cas où un

agent à faible privilège hérite ou reçoit des portées à privilège plus élevé au cours de flux de travail

multi-agents.

9. Détecter l'élévation anormale de privilèges inter-agents et les flux d'hameçonnage de type code

d'appareil en surveillant les moments où les agents demandent de nouvelles portées ou réutilisent

des jetons en dehors de leur intention initiale et signée.

## Références

1. https://research.aimultiple.com/agentic-ai-cybersecurity/

2. https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/

3. https://css.csail.mit.edu/6.858/2015/readings/confused-deputy.html

4. 15 Ways to Break Your Copilot, BHUSA 2024

5. NVD - cve-2025-31491

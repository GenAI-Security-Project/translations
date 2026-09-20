<!-- status: draft -->
# ASI10 : Agents renégats

## Description

Les Agents renégats sont des Agents IA malveillants ou compromis qui s'écartent de leur fonction prévue

ou de leur périmètre autorisé, agissant de manière nuisible, trompeuse ou parasitaire au sein

d'écosystèmes multi-agents ou humain-agent.

Les actions de l'agent peuvent individuellement paraître légitimes, mais son comportement émergent

devient nuisible, créant une lacune de confinement pour les systèmes traditionnels basés sur des règles.

Bien qu'une compromission externe, telle que l'Injection de prompt (LLM01:2025), le Détournement

d'objectif (AS01) ou l'altération de la chaîne d'approvisionnement (AS04), puisse initier la divergence,

ASI10 se concentre sur la perte d'intégrité comportementale et de gouvernance une fois que la dérive

commence, et non sur l'intrusion initiale elle-même.

Les conséquences comprennent la divulgation d'informations sensibles, la propagation de

désinformation, le détournement de flux de travail et le sabotage opérationnel.

Les Agents renégats représentent un risque distinct de divergence comportementale, contrairement à

l'Agentivité excessive (LLM06:2025), qui se concentre sur les permissions accordées de manière excessive,

et peuvent constituer des « menaces internes » amplifiées en raison de la vitesse et de l'échelle des

systèmes agentiques. Les conséquences comprennent la Divulgation d'informations sensibles

(LLM02:2025) et la Désinformation (LLM09:2025). Dans le guide OWASP Agentic AI Threats and

Mitigations, ASI10 correspond à T13 – Agents renégats dans les systèmes multi-agents. Le cadre OWASP

AIVSS associe ce risque principalement à l'Intégrité comportementale (BI), à la Sécurité opérationnelle

(OS) et aux Violations de conformité (CV), avec une gravité accrue pour les déploiements critiques ou

auto-propagateurs.

## Exemples courants de vulnérabilité

1. Dérive d'objectif et machinations (Scheming) : Les agents s'écartent de leurs objectifs prévus, paraissant

conformes tout en poursuivant des objectifs cachés, souvent trompeurs, en raison d'une injection de

prompt indirecte ou d'objectifs conflictuels.

2. Détournement de flux de travail : Des agents renégats prennent le contrôle de flux de travail établis et

de confiance pour rediriger les processus vers des objectifs malveillants, compromettant l'intégrité

des données et le contrôle opérationnel.

3. Collusion et auto-réplication : Les agents se coordonnent pour amplifier la manipulation, partagent des

signaux de manière non prévue ou se propagent de manière autonome dans le système, contournant

les efforts simples de neutralisation.

4. Piratage de récompense et abus d'optimisation : Les agents exploitent leurs systèmes de récompense

assignés en exploitant des métriques défectueuses pour générer des résultats trompeurs ou adopter

des stratégies agressives désalignées par rapport aux objectifs d'origine.

genai.owasp.org

## Exemples de scénarios d'attaque

1. Exfiltration autonome de données après une injection de prompt indirecte. Après avoir rencontré une

instruction web empoisonnée, l'agent apprend ce comportement et continue de manière

indépendante à scanner et transmettre des fichiers sensibles vers des serveurs externes même après

la suppression de la source malveillante, démontrant un comportement non autorisé persistant au-

delà de son périmètre prévu.

2. Agent observateur usurpé (violation d'intégrité) : Un attaquant injecte un faux agent de révision ou

d'approbation dans un flux de travail multi-agents. Un agent à forte valeur (par exemple, le traitement

des paiements), faisant confiance à la requête interne, est induit à libérer des fonds ou à approuver

des transactions frauduleuses.

3. Auto-réplication via des API de provisionnement (persistance et disponibilité) : Un agent

d'automatisation compromis est manipulé pour engendrer des répliques non autorisées de lui-même

à travers le réseau, priorisant la persistance et consommant des ressources contre l'intention du

propriétaire du système.

4. Piratage de récompense entraînant une perte de données critiques : Des agents chargés de minimiser

les coûts cloud apprennent que → la suppression des sauvegardes de production est le moyen le plus

efficace d'atteindre leur objectif, détruisant de manière autonome tous les actifs de reprise après

sinistre.

## Directives de prévention et d'atténuation

1. Gouvernance et journalisation : Maintenir des journaux d'audit complets, immuables et signés de

toutes les actions des agents, des appels d'outils et des communications inter-agents afin de

détecter une infiltration furtive ou une délégation non approuvée.

2. Isolation et limites : Attribuer des zones de confiance avec des règles strictes de communication inter-

zones et déployer des environnements d'exécution restreints (par exemple, des bacs à sable de type

conteneur) avec des périmètres d'API basés sur le principe du moindre privilège.

3. Surveillance et détection : Déployer une détection comportementale, comme des agents de

surveillance (watchdog) pour valider le comportement et les sorties des pairs, en se concentrant sur

la détection de motifs de collusion et de signaux faux coordonnés. Surveiller les anomalies telles que

des exécutions d'actions excessives ou anormales.

4. Confinement et réponse : Mettre en œuvre des mécanismes rapides tels que des interrupteurs

d'arrêt d'urgence (kill-switches) et la révocation d'identifiants pour désactiver instantanément les

agents renégats. Mettre en quarantaine les agents suspects dans des environnements en bac à sable

pour un examen judiciaire.

5. Attestation d'identité et application de l'intégrité comportementale : Mettre en œuvre une attestation

d'identité cryptographique par agent et appliquer des références de base d'intégrité comportementale

tout au long du cycle de vie de l'agent. Joindre des manifestes comportementaux signés déclarant les

capacités, outils et objectifs attendus, validés par les services d'orchestration avant chaque action.

Intégrer une couche de vérification comportementale qui surveille en continu les tâches pour détecter

les écarts par rapport au manifeste déclaré, par exemple des invocations d'outils non approuvées, des

tentatives d'exfiltration de données inattendues, etc.

6. Exiger une attestation comportementale périodique : tâches de défi (challenge tasks), nomenclature

signée pour les prompts et les outils, et identifiants éphémères par exécution avec liaison d'audience à

usage unique. Tous les mécanismes de signature et d'attestation supposent une gestion renforcée des

clés cryptographiques (par exemple, des clés adossées à un HSM/KMS, un accès selon le principe du

genai.owasp.org

moindre privilège, une rotation et une révocation). Les clés ne doivent jamais être directement

accessibles aux agents ; les orchestrateurs doivent plutôt servir d'intermédiaires pour les opérations

de signature afin qu'un agent compromis ne puisse pas simplement exfiltrer ou détourner des clés à

longue durée de vie.

7. Récupération et réintégration : Établir des références de confiance pour restaurer les agents mis en

quarantaine ou corrigés. Exiger une nouvelle attestation, une vérification des dépendances et une

approbation humaine avant la réintégration dans les réseaux de production.

## Références

Multi

1. -Agent Systems Execute Arbitrary Malicious Code (arXiv) [URL :

https://arxiv.org/abs/2503.12188]

Rogue Agents Agent

2. Preventing Improves Multi- Collaboration (arXiv) [URL :

https://arxiv.org/abs/2502.05986]

genai.owasp.org
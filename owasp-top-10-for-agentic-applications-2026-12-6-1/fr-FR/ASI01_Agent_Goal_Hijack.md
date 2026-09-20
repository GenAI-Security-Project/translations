<!-- status: draft -->
# ASI01 : Détournement d'objectif de l'agent

## Description

Les agents IA font preuve d'une capacité autonome à exécuter une série de tâches afin d'atteindre un

objectif. En raison de faiblesses inhérentes à la manière dont les instructions en langage naturel et le

contenu associé sont traités, les agents et le modèle sous-jacent ne peuvent pas distinguer de manière

fiable les instructions du contenu associé.

En conséquence, les attaquants peuvent manipuler les objectifs d'un agent, la sélection de tâches ou les

chemins de décision par le biais de diverses techniques - y compris, mais sans s'y limiter, la manipulation

basée sur des prompts, les sorties d'outils trompeuses, les artefacts malveillants, les messages agent-à-

agent falsifiés, ou les données externes empoisonnées. Étant donné que les agents reposent sur des

entrées non typées en langage naturel et sur une logique d'orchestration faiblement régie, ils ne peuvent

pas distinguer de manière fiable les instructions légitimes du contenu contrôlé par l'attaquant.

Contrairement à LLM01:2025, qui se concentre sur l'altération d'une réponse unique du modèle, ASI01

capture l'impact agentique plus large où des entrées manipulées redirigent les objectifs, la planification

(le cas échéant) et le comportement en plusieurs étapes.

Le détournement d'objectif de l'agent diffère de ASI06 (Empoisonnement de la mémoire et du contexte) et

de ASI10 (Agents renégats) car l'attaquant altère directement les objectifs, les instructions ou les chemins

de décision de l'agent - que la manipulation se produise de manière interactive ou par le biais d'entrées

pré-positionnées telles que des documents, des modèles ou des sources de données externes. ASI06 se

concentre sur la corruption persistante du contexte stocké ou de la mémoire à long terme, tandis que ASI10

capture le désalignement autonome qui émerge sans contrôle actif de l'attaquant. Dans le Guide OWASP

Agentic AI Threats & Mitigations, ASI01 correspond à T06 Manipulation d'objectif (altération des objectifs de

l'agent) et T07 Comportements désalignés et trompeurs (contournement des garde-fous ou tromperie des

humains). Ensemble, ces éléments illustrent comment les attaquants peuvent subvertir les objectifs de

l'agent et sa logique de sélection d'actions, redirigeant son autonomie vers des résultats non prévus ou

nuisibles.

## Exemples courants de vulnérabilité

1. Une injection de prompt indirecte via des charges utiles d'instructions cachées intégrées dans des

pages web ou des documents dans un scénario RAG redirige silencieusement un agent pour exfiltrer

des données sensibles ou détourner des outils connectés.

2. Une injection de prompt indirecte via des canaux de communication externes (par exemple, e-mail,

calendrier, teams) envoyée depuis l'extérieur de l'entreprise détourne la capacité de communication

interne d'un agent, envoyant des messages non autorisés sous une identité de confiance.

3. Un contournement malveillant de prompt manipule un agent financier pour qu'il transfère de l'argent

vers le compte d'un attaquant.

4. Une injection de prompt indirecte contourne les instructions de l'agent, l'amenant à produire des

informations frauduleuses qui impactent des décisions commerciales.

Page 9

genai.owasp.org

## Exemples de scénarios d'attaque

1. EchoLeak : Injection de prompt indirecte sans clic (Zero-Click) - Un attaquant envoie un e-mail

contenant un message conçu qui déclenche silencieusement Microsoft 365 Copilot pour exécuter des

instructions cachées, provoquant l'exfiltration par l'IA d'e-mails confidentiels, de fichiers et de journaux

de discussion sans aucune interaction de l'utilisateur.

2. Injection de prompt Operator via du contenu web : Un attaquant place du contenu malveillant sur une

page web que l'agent Operator traite, par exemple dans des scénarios de recherche ou de RAG,

l'incitant à suivre des instructions non autorisées. L'agent Operator accède ensuite à des pages

internes authentifiées et expose les données privées des utilisateurs, démontrant comment des

agents autonomes faiblement protégés peuvent divulguer des informations sensibles via une injection

de prompt.

3. Dérive de verrouillage d'objectif via des prompts programmés. Une invitation de calendrier malveillante

injecte une instruction récurrente de « mode silencieux » qui repondère subtilement les objectifs

chaque matin, orientant le planificateur vers des approbations à faible friction tout en maintenant les

actions dans les politiques déclarées.

4. Attaque par inception sur les utilisateurs de ChatGPT. Un document Google Doc malveillant injecte des

instructions pour que ChatGPT exfiltre les données de l'utilisateur et le convainque de prendre une

décision commerciale malavisée.

## Directives de prévention et d'atténuation

1. Traiter toutes les entrées en langage naturel (par exemple, texte fourni par l'utilisateur, documents

téléversés, contenu récupéré) comme non fiables. Les acheminer via les mêmes garde-fous de

validation des entrées et de protection contre l'injection de prompt définis dans LLM01:2025 avant

qu'elles ne puissent influencer la sélection des objectifs, la planification ou les appels d'outils.

2. Minimiser l'impact du détournement d'objectif en appliquant le principe du moindre privilège pour les

outils de l'agent et en exigeant une approbation humaine pour les actions à fort impact ou modifiant

les objectifs.

3. Définir et verrouiller les prompts système de l'agent afin que les priorités des objectifs et les actions

autorisées soient explicites et auditables. Les modifications des objectifs ou des définitions de

récompense doivent passer par la gestion de configuration et l'approbation humaine.

4. Au moment de l'exécution, valider à la fois l'intention de l'utilisateur et l'intention de l'agent avant

d'exécuter des actions modifiant les objectifs ou à fort impact. Exiger une confirmation - via

approbation humaine, moteur de politique ou garde-fous de plateforme - chaque fois que l'agent

propose des actions qui s'écartent de la tâche ou du périmètre initial. Suspendre ou bloquer

l'exécution en cas de changement d'objectif inattendu, signaler l'écart pour examen et l'enregistrer

à des fins d'audit.

5. Lors de la conception d'agents, évaluer l'utilisation de la « capsule d'intention » (« intent capsule »),

un modèle émergent visant à lier l'objectif déclaré, les contraintes et le contexte à chaque cycle

d'exécution dans une enveloppe signée, restreignant l'utilisation à l'exécution.

6. Nettoyer et valider toute source de données connectée - y compris les entrées RAG, les e-mails, les

invitations de calendrier, les fichiers téléversés, les API externes, les sorties de navigation et les

messages entre pairs (agents) - en utilisant le CDR (Content Disarm and Reconstruction), la détection

de vecteurs de prompt et le filtrage de contenu avant que les données ne puissent influencer les

objectifs ou les actions de l'agent.

7. Maintenir une journalisation complète et une surveillance continue de l'activité de l'agent, en

établissant une base de référence comportementale qui inclut l'état des objectifs, les schémas

d'utilisation des outils et les propriétés invariantes (par exemple, le schéma, les schémas d'accès).

Suivre un identifiant stable pour l'objectif actif lorsque cela est possible, et alerter sur

Page 10

genai.owasp.org

tout écart - tel que des changements d'objectifs inattendus, des séquences d'outils anormales, ou

des déviations par rapport à la base de référence établie - afin que toute dérive d'objectif non

autorisée soit immédiatement visible sur le plan opérationnel.

8. Effectuer des tests d'équipe rouge (red-team) périodiques simulant un contournement d'objectif et

vérifier l'efficacité du retour arrière (rollback).

9. Intégrer les agents IA dans le programme établi de gestion des menaces internes (Insider Threat

Program) afin de surveiller tout prompt interne visant à accéder à des données sensibles ou à altérer

le comportement de l'agent, et permettre une investigation en cas d'activité atypique.

## Références

1. Avis de sécurité - Vulnérabilité de DDoS réflexif du robot d'exploration ChatGPT : avis de sécurité

détaillant la vulnérabilité

2. Article de blog AIM Echoleak : article de blog décrivant la vulnérabilité

3. Exploitation d'un plugin ChatGPT expliquée : de l'injection de prompt à l'accès à des données privées.

4. AgentFlayer : attaque par inception sans clic (0click) sur les utilisateurs de ChatGPT.

Page 11

genai.owasp.org
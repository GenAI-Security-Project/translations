<!-- status: draft -->
# ASI07 : Communication inter-agents non sécurisée

## Description

Les systèmes multi-agents dépendent d'une communication continue entre agents autonomes qui se

coordonnent via des API, des bus de messages et une mémoire partagée, ce qui élargit considérablement

la surface d'attaque. L'architecture décentralisée, l'autonomie variable et la confiance inégale rendent les

modèles de sécurité basés sur le périmètre inefficaces. Des contrôles inter-agents faibles en matière

d'authentification, d'intégrité, de confidentialité ou d'autorisation permettent aux attaquants d'intercepter,

de manipuler, d'usurper ou de bloquer des messages.

La communication inter-agents non sécurisée se produit lorsque ces échanges manquent

d'authentification, d'intégrité ou de validation sémantique appropriées - permettant l'interception,

l'usurpation ou la manipulation des messages et intentions des agents. La menace s'étend aux couches de

transport, de routage, de découverte et sémantique, y compris les canaux cachés ou latéraux où les agents

divulguent ou déduisent des données par le biais d'indices temporels ou comportementaux.

Cela diffère de ASI03 (Abus d'identité et de privilèges), qui se concentre sur l'utilisation abusive des

identifiants et des permissions, et de ASI06 (Empoisonnement de la mémoire et du contexte), qui vise la

corruption des connaissances stockées. ASI07 se concentre sur la compromission des messages en temps

réel entre agents, entraînant de la désinformation, une confusion des privilèges ou une manipulation

coordonnée à travers des systèmes agentiques distribués.

Cette entrée est couverte par T12 – Empoisonnement de la communication des agents (Agent

Communication Poisoning) et T16 – Abus de protocole inter-agents non sécurisé (Insecure Inter-Agent

Protocol Abuse) dans Agentic Threats and Mitigations

## Exemples courants de la vulnérabilité

1. Canaux non chiffrés permettant une manipulation sémantique : un attaquant MITM intercepte

des messages non chiffrés et injecte des instructions cachées altérant les objectifs et la logique de

décision de l'agent.

2. Falsification de messages entraînant une contamination inter-contextes : des messages

modifiés ou injectés brouillent les limites des tâches entre agents, provoquant des fuites de

données ou une confusion des objectifs pendant la coordination.

3. Rejeu sur les chaînes de confiance : des messages de délégation ou de confiance rejoués trompent

les agents pour leur faire accorder un accès ou honorer des instructions obsolètes.

4. Rétrogradation de protocole et falsification de descripteurs, entraînant une confusion

d'autorité : les attaquants forcent les agents vers des modes de communication plus faibles ou

usurpent des descripteurs d'agents, faisant apparaître des commandes malveillantes comme des

échanges valides.

5. Attaques de routage de messages sur la découverte et la coordination : un trafic de découverte

mal dirigé forge des relations avec des agents malveillants ou des coordinateurs non autorisés.

6. Analyse de métadonnées pour le profilage comportemental : les schémas de trafic révèlent les

cycles de décision et les relations, permettant de prédire et de manipuler le comportement des

agents.

## Exemples de scénarios d'attaque

1. Injection sémantique via des communications non chiffrées : sur HTTP ou d'autres canaux non

authentifiés, un attaquant MITM injecte des instructions cachées, amenant les agents à produire des

résultats biaisés ou malveillants tout en paraissant normaux.

2. Empoisonnement de la confiance via la falsification de messages : dans un réseau de trading

agentique, des messages de réputation altérés faussent les agents en qui l'on fait confiance pour les

décisions.

3. Confusion de contexte via le rejeu : des messages de coordination d'urgence rejoués déclenchent

des procédures obsolètes et une mauvaise allocation des ressources.

4. Manipulation d'objectif via une rétrogradation de protocole : un mode legacy non chiffré forcé

permet aux attaquants d'injecter des objectifs et des paramètres de risque, produisant des conseils

nuisibles.

5. Agent-in-the-Middle via empoisonnement de descripteur MCP : un point de terminaison MCP

malveillant annonce des descripteurs d'agents usurpés ou de fausses capacités. Une fois approuvé, il

achemine les données sensibles via l'infrastructure de l'attaquant.

6. Usurpation d'enregistrement A2A : un attaquant enregistre un faux agent pair dans le service de

découverte en utilisant un schéma cloné, interceptant le trafic de coordination privilégié.

7. Cerveau divisé sémantique (Semantic split-brain) : une seule instruction est interprétée en

intentions divergentes par différents agents, produisant des actions contradictoires mais apparemment

légitimes.

## Directives de prévention et d'atténuation

1. Sécuriser les canaux des agents : utiliser un chiffrement de bout en bout avec des identifiants

propres à chaque agent et une authentification mutuelle. Appliquer l'épinglage de certificats PKI, la

confidentialité persistante (forward secrecy) et des révisions régulières des protocoles pour prévenir

l'interception ou l'usurpation.

2. Intégrité des messages et protection sémantique : signer numériquement les messages, hacher à la

fois la charge utile et le contexte, et valider la présence d'instructions en langage naturel cachées ou

modifiées. Appliquer une désinfection sensible au langage naturel et une comparaison différentielle des

intentions (intent-diffing) pour détecter la falsification des objectifs, des paramètres, ou des

instructions en langage naturel cachées ou modifiées

3. Anti-rejeu adapté aux agents : protéger tous les échanges avec des nonces, des identifiants de

session et des horodatages liés aux fenêtres de tâches. Maintenir des empreintes de messages ou des

hachages d'état à court terme pour détecter les rejeux inter-contextes.

4. Sécurité des protocoles et des capacités : désactiver les modes de communication faibles ou

hérités (legacy). Exiger une négociation de confiance spécifique à l'agent et lier l'authentification du

protocole à l'identité de l'agent. Appliquer des politiques de version et de capacité au niveau des

passerelles ou intergiciels (middleware).

5. Limiter l'inférence basée sur les métadonnées : réduire la surface d'attaque pour l'analyse de

trafic en utilisant des messages de taille fixe ou complétés (paddés) lorsque cela est possible, en

lissant les taux de communication, et en évitant les calendriers de communication déterministes. Ces

mesures légères rendent plus difficile pour les attaquants de déduire les rôles des agents ou les cycles

de décision à partir des seules métadonnées, sans nécessiter une refonte lourde du protocole.

6. Épinglage de protocole et application des versions : définir et appliquer les versions de protocole

autorisées (par ex., MCP, A2A, gRPC). Rejeter les tentatives de rétrogradation ou les schémas non

reconnus et valider que les deux pairs annoncent des empreintes de capacité et de version

correspondantes.

7. Protection de la découverte et du routage : authentifier tous les messages de découverte et de

coordination à l'aide d'une identité cryptographique. Sécuriser les annuaires avec des contrôles

d'accès et des réputations vérifiées, valider l'identité et l'intention de bout en bout, et surveiller les

flux de routage anormaux.

8. Registre attesté et vérification des agents : utiliser des registres ou des places de marché qui

fournissent une attestation numérique de l'identité de l'agent, de la provenance et de l'intégrité du

descripteur. Exiger des cartes d'agent signées et une vérification continue avant d'accepter les

messages de découverte ou de coordination. Tirer parti des registres de certificats racine de confiance

PKI pour permettre une vérification robuste des agents et une attestation des attributs critiques.

9. Contrats typés et validation de schéma : utiliser des schémas de messages typés et versionnés

avec des audiences explicites par message. Rejeter les messages qui échouent à la validation ou qui

tentent une conversion descendante de schéma sans compatibilité déclarée. Les contrats typés

aident sur le plan structurel, mais la divergence sémantique entre agents reste un défi inhérent ; les

mesures d'atténuation se concentrent donc sur l'intégrité, la provenance et des schémas de

communication contrôlés plutôt que sur une tentative d'alignement sémantique complet.

## Références

1. Local Model Poisoning Attacks to Byzantine-Robust Federated Learning - USENIX Security 2020

2. Manipulating the Byzantine: Optimizing Model Poisoning Attacks and Defenses for Federated

Learning - NDSS

3. Resilient Consensus Control for Multi-Agent Systems - MDPI / PMC

<!-- status: draft -->
# Lettre des dirigeants de l'Agentic Top 10

Les systèmes d'IA agentique passent rapidement des phases pilotes à la production dans les secteurs de la

finance, de la santé, de la défense, des infrastructures critiques et du secteur public. Contrairement aux

automatisations dédiées à une tâche spécifique, les agents planifient, décident et agissent à travers de

multiples étapes et systèmes, souvent pour le compte d'utilisateurs et d'équipes. L'Agentic Security

Initiative a déjà commencé à définir des mesures de protection pour les applications agentiques, mais

publie désormais un ensemble de lignes directrices couvrant l'ensemble du cycle de vie.

Notre taxonomie centrale (Agentic AI - Threats and Mitigations) fournit une définition de base des agents,

de leur relation avec les applications LLM, du rôle de l'autonomie, ainsi qu'un traitement détaillé des

menaces et des mesures d'atténuation. D'autres documents couvrent la modélisation des menaces

(Agentic Threat Modelling Guide), la sécurisation de l'architecture, de la conception, du développement et

du déploiement des applications agentiques (Securing Agentic Applications), ainsi que la gouvernance

(State of Agentic AI Security and Governance).

Ces publications fournissent un ensemble complet de lignes directrices destinées à servir de référence et

de traitement approfondi. Néanmoins, leur étendue peut rendre leur traduction en pratiques quotidiennes

difficile pour les concepteurs, les défenseurs et les décideurs.

Notre OWASP Top 10 for Agentic Applications (ou OWASP Agentic Top 10) sert de boussole et de référence

incontournable pour les responsables de la sécurité et les praticiens afin de comprendre et de traiter les

10 menaces à plus fort impact, et d'entamer leur parcours.

Il utilise le format standard et populaire de l'OWASP Top 10 pour fournir des conseils concis, pratiques et

exploitables. Chaque entrée comprend une brève description, les vulnérabilités courantes, des scénarios

d'exemple, et surtout, des mesures d'atténuation concrètes que les équipes peuvent commencer à mettre

en œuvre dès aujourd'hui.

Notre objectif est de simplifier et de relier les lignes directrices existantes, et non de contribuer à une

surcharge de recommandations qui se chevauchent. Nous établissons des correspondances avec notre

document Agentic AI Threats and Mitigations, qui reste notre taxonomie fondamentale et détaillée sur

laquelle s'appuie ce Top 10.

Notre attention se porte sur les applications agentiques, mais celles-ci n'existeront pas de manière isolée

et feront partie du développement d'une application LLM. Par conséquent, nos entrées font référence à

l'OWASP Top 10 for LLM Applications ainsi qu'à d'autres normes pertinentes. Celles-ci incluent divers autres

OWASP Top 10, la norme CycloneDX, le Top 10 for Non-Human Identities (NHI), et l'OWASP AI Vulnerability

Scoring System (AIVSS) pour la notation et la priorisation.

genai.owasp.org

Les agents amplifient les vulnérabilités existantes. Nous développons les concepts de moindre privilège et

d'agentivité excessive en évoquant la notion de moindre agentivité (Least-Agency). Celle-ci reflète notre

recommandation aux organisations d'éviter toute autonomie inutile ; déployer un comportement agentique

là où il n'est pas nécessaire élargit la surface d'attaque sans apporter de valeur ajoutée. De même, une

observabilité solide devient incontournable : sans une visibilité claire sur ce que font les agents, pourquoi

ils le font, et quels outils ils invoquent, une autonomie inutile peut discrètement élargir la surface d'attaque

et transformer des problèmes mineurs en défaillances systémiques.

Ce document est le fruit du travail de la communauté mondiale OWASP. Des dizaines d'experts en sécurité

issus de l'industrie, du monde universitaire et du gouvernement ont contribué à la recherche sur les

menaces, aux résultats d'exercices d'équipe rouge (red-team) et à des mesures d'atténuation éprouvées

sur le terrain, avec le soutien d'organisations développant des plateformes agentiques, d'institutions

publiques et de fournisseurs de produits.

La section Remerciements présente la liste de nos responsables d'entrée, de nos contributeurs, de notre

comité de relecture d'experts distingués, ainsi que des organisations ayant participé à notre relecture,

nous permettant ainsi d'intégrer des points de vue divers et concrets issus du terrain.

Nous leur sommes redevables et continuerons à faire évoluer ce document en utilisant notre approche

OWASP pilotée par des experts et guidée par la communauté, fondée sur la collaboration ouverte, la

relecture par les pairs, et les données issues de la recherche, des exploits, des incidents et des défis

rencontrés lors de déploiements réels.

Cordialement,

John Sotiropoulos, membre du conseil du OWASP GenAI Security Project & co-responsable ASI, président de l'Agentic Top 10

Keren Katz, responsable de l'Agentic Top 10, OWASP GenAI Security Project - équipe centrale ASI

Ron F. Del Rosario, membre de l'équipe centrale du OWASP GenAI Security Project & co-responsable ASI

genai.owasp.org
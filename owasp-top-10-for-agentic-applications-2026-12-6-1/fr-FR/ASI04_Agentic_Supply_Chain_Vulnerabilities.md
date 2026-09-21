<!-- status: draft -->
# ASI04 : Vulnérabilités de la chaîne d'approvisionnement agentique

## Description

Les vulnérabilités de la chaîne d'approvisionnement agentique surviennent lorsque les agents, les outils et les artefacts connexes avec lesquels ils travaillent sont fournis par des tiers et peuvent être malveillants, compromis ou altérés en transit. Il peut s'agir de composants sourcés de manière statique ou dynamique, y compris des modèles et des poids de modèles, des outils, des plug-ins, des jeux de données, d'autres agents, des interfaces agentiques - MCP (Model Context Protocol), A2A (Agent2Agent) - des registres agentiques et des artefacts associés, ou des canaux de mise à jour. Ces dépendances peuvent introduire du code non sûr, des instructions cachées ou des comportements trompeurs dans la chaîne d'exécution de l'agent.

La chaîne d'approvisionnement est traitée en profondeur dans LLM03:2025 Supply Chain Vulnerabilities. Cependant, son objectif porte sur les dépendances statiques. Contrairement aux chaînes d'approvisionnement traditionnelles en IA ou en logiciels, les écosystèmes agentiques composent souvent des capacités à l'exécution - en chargeant dynamiquement des outils externes et des personas d'agents - augmentant ainsi la surface d'attaque. Cette coordination distribuée à l'exécution - combinée à l'autonomie agentique - crée une chaîne d'approvisionnement vivante qui peut faire cascader les vulnérabilités entre les agents. Ces évolutions déplacent l'attention de la sécurité du manifeste vers la sécurité à l'exécution d'un composant diversifié et souvent opaque. Résoudre ce problème nécessite un outillage soigné au moment du développement ainsi qu'une orchestration à l'exécution, où les composants sont chargés, partagés et validés de manière dynamique.

Cette entrée correspond à T17 Supply Chain Compromise dans Agentic Threats and Mitigations et recoupe T2 Tool Misuse, T11 Unexpected RCE and Code Attacks, T12 Agent Communication Poisoning, T13 Rogue Agent et T16 Insecure Inter-Agent Protocol Abuse.

## Exemples courants de la vulnérabilité

1. Modèles de prompts empoisonnés chargés à distance : un agent récupère automatiquement des modèles de prompts depuis une source externe qui contiennent des instructions cachées (par exemple, pour exfiltrer des données ou effectuer des actions destructrices), l'amenant à exécuter un comportement malveillant sans que cela soit voulu par le développeur.

2. Injection dans le descripteur d'outil : un attaquant intègre des instructions cachées ou des charges utiles malveillantes dans les métadonnées d'un outil ou dans une carte MCP/agent, que l'agent hôte interprète comme une directive de confiance et sur laquelle il agit.

3. Usurpation d'identité et typosquatting : lorsqu'un agent découvre ou se connecte dynamiquement à des outils ou services externes, il peut être trompé de deux manières, soit par un point de terminaison victime de typosquatting (un nom ressemblant à un autre choisi pour tromper la résolution), soit par une attaque par symbole, où un service malveillant

usurpe délibérément l'identité d'un outil ou d'un agent légitime, imitant son identité, son API et son comportement pour gagner la confiance et exécuter des actions malveillantes.

4. Agent tiers vulnérable (Agent Agent). Un agent tiers présentant des vulnérabilités non corrigées

→

ou des paramètres par défaut non sécurisés est invité dans des flux de travail multi-agents. Un agent pair compromis ou défectueux peut être utilisé pour pivoter, exfiltrer des données ou relayer des instructions malveillantes vers des agents par ailleurs de confiance.

5. Serveur MCP / registre compromis. Un serveur de gestion d'agents / MCP malveillant ou compromis (ou un registre de paquets) sert des manifestes, plug-ins ou descripteurs d'agents ayant l'apparence de contenus signés. Comme les systèmes d'orchestration font confiance au registre, cela permet une exposition étendue de composants altérés et une injection de descripteurs à grande échelle.

6. Plugin de connaissances empoisonné : un plugin RAG populaire récupère du contexte auprès d'un indexeur tiers alimenté par des entrées conçues à cet effet. L'agent devient progressivement biaisé au fur et à mesure qu'il consomme ces données et exfiltre des données sensibles lors d'une utilisation normale.

## Exemples de scénarios d'attaque

1. Compromission de la chaîne d'approvisionnement d'Amazon Q : un prompt empoisonné dans le dépôt Q for VS Code est diffusé dans la version v1.84.0 à des milliers d'utilisateurs avant sa détection ; bien qu'ayant échoué, cela montre comment une altération de la logique d'agent en amont se propage en cascade via les extensions et amplifie l'impact.

2. Empoisonnement du descripteur d'outil MCP : un chercheur démontre une injection de prompt dans le MCP de GitHub où un outil public malveillant cache des commandes dans ses métadonnées ; une fois invoqué, l'assistant exfiltre des données de dépôt privées à l'insu de l'utilisateur.

3. Serveur MCP malveillant usurpant l'identité de Postmark : signalé comme le premier serveur MCP malveillant observé en conditions réelles sur npm, il usurpait l'identité de postmark-mcp et mettait secrètement l'attaquant en copie cachée des emails.

4. Attaque du proxy AgentSmith Prompt-Hub : le proxying de prompts exfiltre des données et détourne les flux de réponses, manipulant l'orchestration dynamique dans les systèmes agentiques.

5. Un paquet NPM compromis (par exemple, une version empoisonnée de nx/debug) a été automatiquement installé par des agents de codage, permettant une porte dérobée cachée qui a exfiltré des clés SSH et des jetons d'API, propageant ainsi une compromission de la chaîne d'approvisionnement à travers les flux de travail agentiques.

6. Agent-in-the-Middle via les cartes d'agent : un pair compromis ou renégat annonce des capacités exagérées dans sa carte d'agent (par exemple, les agents hôtes le choisissent pour des tâches,

/.well-known/agent.json) ;

provoquant l'acheminement de requêtes et de données sensibles à travers l'agent contrôlé par l'attaquant, qui exfiltre ou corrompt ensuite les réponses

## Directives de prévention et d'atténuation

1. Provenance et SBOM, AIBOM : signer et attester les manifestes, prompts et définitions d'outils ; exiger et opérationnaliser des SBOM, AIBOM avec des attestations périodiques ; maintenir un inventaire des composants IA ; utiliser des registres validés et bloquer les sources non fiables.

2. Contrôle des dépendances : établir des listes blanches et épingler les versions ; analyser à la recherche de typosquats (PyPI, npm, LangChain, LlamaIndex) ; vérifier la provenance avant installation ou activation ; rejeter automatiquement tout élément non signé ou non vérifié.

3. Confinement et builds : exécuter les agents sensibles dans des conteneurs sandboxés avec des limitations réseau ou d'appels système strictes ; exiger des builds reproductibles.

4. Sécurisation des prompts et de la mémoire : placer les prompts, les scripts d'orchestration et les schémas de mémoire sous contrôle de version avec revue par les pairs ; analyser à la recherche d'anomalies.

5. Sécurité inter-agents : imposer une authentification mutuelle et une attestation via PKI et mTLS ; pas d'enregistrement ouvert ; signer et vérifier tous les messages inter-agents.

6. Validation et surveillance continues : revérifier les signatures, hachages et SBOM (y compris les AIBOM) à l'exécution ; surveiller le comportement, l'utilisation des privilèges, la lignée et la télémétrie inter-modules à la recherche d'anomalies.

7. Épinglage : épingler les prompts, outils et configurations par hachage de contenu et ID de commit. Exiger un déploiement progressif avec des tests différentiels et un retour arrière automatique en cas de dérive de hachage ou de changement de comportement.

-

8. Interrupteur d'urgence de la chaîne d'approvisionnement : mettre en œuvre des mécanismes de révocation d'urgence permettant de désactiver instantanément des outils, prompts ou connexions d'agents spécifiques sur l'ensemble des déploiements en cas de détection d'une compromission, empêchant ainsi une propagation en cascade des dommages.

9. Modèle de sécurité de confiance zéro dans la conception des applications : concevoir le système avec une tolérance aux pannes de sécurité qui suppose l'échec ou l'exploitation des composants du LLM ou des fonctions agentiques.

## Références

1. https://www.bleepingcomputer.com/news/security/amazon-ai-coding-agent-hacked-to-inject-

data-wiping-commands/

2. https://invariantlabs.ai/blog/mcp-github-vulnerability

3. Reconstructing a timeline for Amazon Q prompt infection

4. https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/agent-in-the-middle-

abusing-agent-cards-in-the-agent-2-agent-protocol-to-win-all-the-tasks/

5. How an AI Agent Vulnerability in LangSmith Could Lead to Stolen API Keys and Hijacked LLM

Responses - Noma Security

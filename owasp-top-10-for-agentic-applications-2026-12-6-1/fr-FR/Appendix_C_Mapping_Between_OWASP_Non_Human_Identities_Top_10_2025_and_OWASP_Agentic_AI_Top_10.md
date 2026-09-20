<!-- status: draft -->
# Annexe C - Correspondance entre l'OWASP Non-Human Identities Top 10 (2025) et l'OWASP Agentic AI Top 10

Le tableau ci-dessous met en correspondance les risques de l'OWASP Non-Human Identities (NHI) Top 10

(2025) avec les entrées de l'OWASP Agentic AI Top 10 (ASI), les menaces et mitigations Agentic-AI (codes

T), et les catégories de risque fondamental AIVSS, afin de montrer l'alignement entre les risques centrés sur

l'identité et ceux centrés sur le comportement agentique.

ID de risque NHI / Brève description Entrées ASI Top Codes T Alignement
Titre 10 correspondantes / Menaces & AIVSS avec le
Mitigations risque
correspondantes fondamental

NHI1: Offboarding L'incapacité à ASI04 – T17 Compromission Attaques sur la
inapproprié désactiver ou Vulnérabilités de de la chaîne chaîne
supprimer les la chaîne d'approvisionnement d'approvisionnement
identités non d'approvisionnement · T2 Utilisation & les dépendances
humaines agentique abusive d'outils de l'agent
inutilisées
entraîne une
surface d'attaque
persistante.

Page 42

genai.owasp.org

NHI2: Fuite de Exposition de clés ASI02 – T6 Manipulation Utilisation de la
secrets API, jetons ou Utilisation abusive d'objectif · T1 mémoire &
certificats utilisés et exploitation Empoisonnement sensibilisation
par des identités des outils · ASI06 de la mémoire contextuelle
non humaines. – Empoisonnement
de la mémoire et
du contexte

NHI3: NHI tiers Les identités ASI04 – T12 Empoisonnement Attaques sur la
vulnérable tierces intégrées Vulnérabilités de de la communication chaîne
sont compromises la chaîne entre agents · T13 d'approvisionnement
et exploitées. d'approvisionnement Agents renégats & les dépendances
· ASI03 – Abus de l'agent
d'identité et de
privilèges

Page 42

genai.owasp.org

NHI4: Mécanismes ASI03 – Abus T16 Abus de Violation du
Authentification d'authentification d'identité et de protocole inter- contrôle d'accès
non sécurisée faibles ou privilèges · ASI07 agents non sécurisé de l'agent
obsolètes pour les – Communication
NHI. inter-agents non
sécurisée

NHI5: NHI Des identités non ASI02 – T2 Utilisation Violation du
surprivilégiée humaines se voient Utilisation abusive abusive des outils · contrôle d'accès
accorder des et exploitation T3 Compromission de l'agent
permissions des outils · ASI03 de privilèges
excessives. – Abus d'identité
et de privilèges

NHI6: Configurations ASI04 – T11 Attaques Interaction non
Configurations de CI/CD et cloud Vulnérabilités de d'exécution de code sécurisée de
déploiement mal configurées la chaîne inattendue (RCE) l'agent avec les
cloud non avec des d'approvisionnement systèmes critiques
sécurisées identifiants · ASI05 –
statiques. Exécution de code
inattendue (RCE)

NHI7: Secrets Les identifiants ou ASI06 – T4 Surcharge de la Utilisation de la
à longue durée clés avec une Empoisonnement mémoire · T12 mémoire &
de vie longue durée de de la mémoire et Empoisonnement sensibilisation
validité du contexte · de la mémoire contextuelle
augmentent le ASI08 – partagée
temps de présence Défaillances en
de l'attaquant. cascade

NHI8: Isolation La réutilisation ASI08 – T8 Répudiation & Défaillances en
des des NHI entre les Défaillances en Non-traçabilité · cascade de l'agent
environnements environnements de cascade · ASI07 – T12 Empoisonnement
développement, de Communication de la
test et de inter-agents non communication
production permet sécurisée entre agents
des mouvements
latéraux.

NHI9: La réutilisation de ASI08 – T5 Attaques Défaillances en
Réutilisation la même NHI à Défaillances en d'hallucination en cascade de l'agent
des NHI travers plusieurs cascade · ASI04 – cascade · T13
services amplifie Vulnérabilités de Agents renégats
l'impact d'une la chaîne
compromission. d'approvisionnement

NHI10: Des humains ASI09 – T10 Submersion de Non-traçabilité de
Utilisation des utilisant des Exploitation de la l'humain dans la l'agent /
NHI par des identifiants non confiance humain- boucle · T7 Manipulation
humains humains agent · ASI01 – Comportements humaine
entraînent une Détournement désalignés et
perte de d'objectif de trompeurs
responsabilité et l'agent
une utilisation
abusive des
privilèges.

Page 43

genai.owasp.org
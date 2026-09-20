<!-- status: draft -->
# Annexe A - Matrice de correspondance de sécurité OWASP Agentic AI

Correspondance croisée entre l'ASI Top 10, le LLM Top 10, les menaces et mesures d'atténuation de l'IA agentique, et les risques fondamentaux AIVSS

ASI ID / Titre OWASP LLM Top 10 Menaces de l'IA agentique & Risque fondamental AIVSS

(2025) Atténuations Alignement

ASI 01 – Détournement LLM01:2025 Injection T6 Manipulation d'objectif · T7 Objectif de l'agent &

d'objectif de l'agent de prompt · LLM06:2025 Comportements malveillants Manipulation d'instructions

Excessive Agency et trompeurs

ASI 02 – Utilisation abusive LLM06:2025 Excessive T2 Utilisation abusive d'outils · T4 IA agentique Utilisation abusive d'outils

et exploitation d'outils Agency Surcharge de ressources · T16

Abus de protocole inter-agent

non sécurisé

ASI 03 – Usurpation LLM01:2025 Injection T3 Violation de compromission Contrôle d'accès de l'agent

d'identité et abus de de prompt · LLM06:2025 de privilège

privilèges Excessive Agency ·

LLM02:2025 Divulgation

d'informations sensibles

ASI 04 – Vulnérabilités de LLM03:2025 T17 Compromission de la Chaîne d'approvisionnement &

la chaîne Vulnérabilités de la chaîne d'approvisionnement · T2 attaques de dépendance de l'agent

d'approvisionnement chaîne d'approvisionnement Utilisation abusive d'outils · T11

agentique RCE inattendue · T12

Empoisonnement de la

communication de l'agent · T13

Agent renégat · T16 Abus de

protocole inter-agent non sécurisé

ASI 05 – Exécution de LLM01:2025 Injection T11 RCE inattendue & Attaques sur les systèmes

code inattendue (RCE) de prompt · LLM05 Code Attaques d'interaction critiques de l'agent

Traitement incorrect

des sorties

ASI 06 – Empoisonnement LLM01:2025 Injection T1 Empoisonnement de la Utilisation de la mémoire &

de la mémoire et du contexte de prompt · LLM04:2025 mémoire · T4 Surcharge Sensibilisation contextuelle

Empoisonnement des données de mémoire · T6 Objectifs

Page 39

genai.owasp.org

et du modèle · rompus · T12 Empoisonnement

LLM08:2025 Vecteurs & de la mémoire partagée

Faiblesses des embeddings

ASI 07 – Communication LLM02:2025 Divulgation T12 Empoisonnement de la Mémoire de l'agent &

inter-agent non sécurisée d'informations sensibles · communication de l'agent · Manipulation du contexte

LLM06:2025 Excessive T16 Abus de protocole

Agency inter-agent non sécurisé

ASI 08 – Défaillances en LLM01:2025 Injection T5 Attaques par Défaillances en cascade

cascade de prompt · LLM04 Empoisonnement hallucination en cascade · T8 de l'agent

des données et du modèle · Répudiation &

LLM06:2025 Excessive non-traçabilité

Agency

ASI 09 – Exploitation de la LLM01:2025 Injection T7 Comportements Non-traçabilité de l'agent /

confiance humain-agent de prompt · LLM05:2025 malveillants et trompeurs · T8 Manipulation humaine

Traitement incorrect des Répudiation &

sorties · LLM06:2025 non-traçabilité · T10

Excessive Agency · Surcharge de l'humain dans

LLM09 Désinformation la boucle

ASI 10 – Agents renégats T13 Agents renégats dans Intégrité comportementale (BI)

LLM02:2025

Divulgation

les systèmes multi-agents · · Sécurité opérationnelle

d'informations sensibles

(OS) · Violations de

T14 Attaques humaines sur

LLM09:2025

conformité (CV)

les systèmes multi-agents · T15

Désinformation

Manipulation humaine

Remarques

Alignement avec le LLM Top 10 
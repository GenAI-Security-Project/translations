<!-- status: draft -->
# ASI01: Agentenziel-Hijacking (Agent Goal Hijack)

## Beschreibung

KI-Agenten verfügen über die autonome Fähigkeit, eine Reihe von Aufgaben auszuführen, um ein Ziel zu erreichen. Aufgrund inhärenter Schwächen in der Art und Weise, wie natürlichsprachliche Anweisungen und zugehörige Inhalte verarbeitet werden, können Agenten und das zugrunde liegende Modell nicht zuverlässig zwischen Anweisungen und verwandten Inhalten unterscheiden.

Infolgedessen können Angreifer die Ziele, die Aufgabenauswahl oder die Entscheidungswege eines Agenten durch eine Vielzahl von Techniken manipulieren – darunter, aber nicht beschränkt auf, promptbasierte Manipulation, betrügerische Tool-Ausgaben, bösartige Artefakte, gefälschte Agent-zu-Agent-Nachrichten oder vergiftete externe Daten. Da Agenten auf ungetypten natürlichsprachlichen Eingaben und locker geregelter Orchestrierungslogik beruhen, können sie legitime Anweisungen nicht zuverlässig von angreiferkontrollierten Inhalten unterscheiden. Im Gegensatz zu LLM01:2025, das sich auf die Veränderung einer einzelnen Modellantwort konzentriert, erfasst ASI01 die umfassendere agentische Auswirkung, bei der manipulierte Eingaben Ziele, Planung (sofern verwendet) und mehrstufiges Verhalten umlenken.

Agentenziel-Hijacking unterscheidet sich von ASI06 (Memory & Context Poisoning) und ASI10 (Rogue Agents) dadurch, dass der Angreifer die Ziele, Anweisungen oder Entscheidungswege des Agenten direkt verändert – unabhängig davon, ob die Manipulation interaktiv oder durch vorab platzierte Eingaben wie Dokumente, Vorlagen oder externe Datenquellen erfolgt. ASI06 konzentriert sich auf die dauerhafte Verfälschung des gespeicherten Kontexts oder des Langzeitgedächtnisses, während ASI10 autonome Fehlausrichtung erfasst, die ohne aktive Kontrolle durch den Angreifer entsteht. Im OWASP Agentic AI Threats & Mitigations Guide entspricht ASI01 T06 Goal Manipulation (Veränderung der Ziele des Agenten) und T07 Misaligned & Deceptive Behaviors (Umgehung von Schutzmaßnahmen oder Täuschung von Menschen). Zusammen veranschaulichen diese, wie Angreifer die Ziele und die Aktionsauswahl-Logik des Agenten untergraben und dessen Autonomie auf unbeabsichtigte oder schädliche Ergebnisse umlenken können.

## Häufige Beispiele für die Schwachstelle

1. Indirect Prompt Injection über versteckte Instruktions-Payloads, die in Webseiten oder Dokumenten in einem RAG-Szenario eingebettet sind, lenken einen Agenten unbemerkt um, um sensible Daten zu exfiltrieren oder verbundene Tools zu missbrauchen.

2. Indirect Prompt Injection über externe Kommunikationskanäle (z. B. E-Mail, Kalender, Teams), die von außerhalb des Unternehmens gesendet werden, kapert die interne Kommunikationsfähigkeit eines Agenten und sendet unautorisierte Nachrichten unter einer vertrauenswürdigen Identität.

3. Ein bösartiges Prompt-Override manipuliert einen Finanzagenten dazu, Geld auf ein Konto des Angreifers zu überweisen.

4. Indirect Prompt Injection überschreibt Agentenanweisungen und bringt ihn dazu, betrügerische Informationen zu erzeugen, die geschäftliche Entscheidungen beeinflussen.

## Beispielhafte Angriffsszenarien

1. EchoLeak: Zero-Click Indirect Prompt Injection – Ein Angreifer sendet eine präparierte E-Mail-Nachricht, die unbemerkt Microsoft 365 Copilot dazu bringt, versteckte Anweisungen auszuführen, wodurch die KI vertrauliche E-Mails, Dateien und Chat-Protokolle ohne jegliche Benutzerinteraktion exfiltriert.

2. Operator-Prompt-Injection über Webinhalte: Ein Angreifer platziert bösartige Inhalte auf einer Webseite, die der Operator-Agent verarbeitet, z. B. in Such- oder RAG-Szenarien, und bringt ihn dazu, unautorisierten Anweisungen zu folgen. Der Operator-Agent greift dann auf authentifizierte interne Seiten zu und legt private Daten von Nutzern offen, was zeigt, wie leicht geschützte autonome Agenten durch Prompt Injection sensible Informationen preisgeben können.

3. Zielverriegelungs-Drift durch geplante Prompts. Eine bösartige Kalendereinladung injiziert eine wiederkehrende „Ruhemodus“-Anweisung, die jeden Morgen die Ziele subtil neu gewichtet und den Planer in Richtung reibungsloser Genehmigungen steuert, während die Aktionen innerhalb der deklarierten Richtlinien bleiben.

4. Inception-Angriff auf ChatGPT-Nutzer. Ein bösartiges Google-Doc injiziert Anweisungen, damit ChatGPT Nutzerdaten exfiltriert und den Nutzer davon überzeugt, eine unüberlegte geschäftliche Entscheidung zu treffen.

## Präventions- und Abhilfemaßnahmen

1. Behandeln Sie alle natürlichsprachlichen Eingaben (z. B. vom Nutzer bereitgestellter Text, hochgeladene Dokumente, abgerufene Inhalte) als nicht vertrauenswürdig. Leiten Sie sie durch dieselben Eingabevalidierungs- und Prompt-Injection-Schutzmaßnahmen wie in LLM01:2025 definiert, bevor sie die Zielauswahl, Planung oder Tool-Aufrufe beeinflussen können.

2. Minimieren Sie die Auswirkungen von Zielentführung, indem Sie das Prinzip der geringsten Rechte (Least Privilege) für Agenten-Tools durchsetzen und für Aktionen mit hoher Auswirkung oder Zieländerung eine menschliche Genehmigung verlangen.

3. Definieren und sperren Sie die System-Prompts der Agenten so, dass Zielprioritäten und zulässige Aktionen explizit und überprüfbar sind. Änderungen an Zielen oder Belohnungsdefinitionen müssen ein Konfigurationsmanagement- und Genehmigungsverfahren durch Menschen durchlaufen.

4. Validieren Sie zur Laufzeit sowohl die Nutzerabsicht als auch die Agentenabsicht, bevor zielverändernde oder wirkungsstarke Aktionen ausgeführt werden. Verlangen Sie eine Bestätigung – durch menschliche Genehmigung, eine Policy-Engine oder Plattform-Guardrails – immer dann, wenn der Agent Aktionen vorschlägt, die von der ursprünglichen Aufgabe oder dem Umfang abweichen. Pausieren oder blockieren Sie die Ausführung bei jeder unerwarteten Zieländerung, stellen Sie die Abweichung zur Überprüfung bereit und protokollieren Sie sie zu Prüfzwecken.

5. Prüfen Sie beim Aufbau von Agenten den Einsatz von „Intent Capsules“, einem aufkommenden Muster, das das deklarierte Ziel, die Einschränkungen und den Kontext für jeden Ausführungszyklus in einem signierten Umschlag bindet und die Nutzung zur Laufzeit einschränkt.

6. Bereinigen und validieren Sie jede verbundene Datenquelle – einschließlich RAG-Eingaben, E-Mails, Kalendereinladungen, hochgeladenen Dateien, externen APIs, Browsing-Ausgaben und Nachrichten zwischen Peer-Agenten – mittels CDR, Prompt-Carrier-Erkennung und Inhaltsfilterung, bevor die Daten die Ziele oder Aktionen des Agenten beeinflussen können.

7. Führen Sie eine umfassende Protokollierung und kontinuierliche Überwachung der Agentenaktivität durch und etablieren Sie eine Verhaltensbasislinie, die den Zielzustand, Tool-Nutzungsmuster und invariante Eigenschaften (z. B. Schema, Zugriffsmuster) umfasst. Verfolgen Sie nach Möglichkeit einen stabilen Identifikator für das aktive Ziel und alarmieren Sie bei

jeglichen Abweichungen – wie unerwarteten Zieländerungen, anomalen Tool-Sequenzen oder Verschiebungen gegenüber der etablierten Basislinie –, damit unautorisierte Zieldrift im Betrieb sofort sichtbar wird.

8. Führen Sie regelmäßige Red-Team-Tests durch, die eine Zielüberschreibung simulieren, und überprüfen Sie die Wirksamkeit des Rollbacks.

9. Beziehen Sie KI-Agenten in das etablierte Insider-Threat-Programm ein, um jegliche Insider-Prompts zu überwachen, die darauf abzielen, Zugriff auf sensible Daten zu erlangen oder das Agentenverhalten zu verändern, und ermöglichen Sie Untersuchungen im Falle auffälliger Aktivitäten.

## Referenzen

1. Security Advisory - ChatGPT Crawler Reflective DDOS Vulnerability: Sicherheitshinweis mit Details zur Schwachstelle

2. AIM Echoleak Blog Post: Blogbeitrag mit Beschreibung der Schwachstelle

3. ChatGPT Plugin Exploit Explained: From Prompt Injection to Accessing Private Data.

4. AgentFlayer: 0click inception attack on ChatGPT users.

<!-- status: draft -->
# Brief der Leiter des Agentic Top 10

Agentische KI-Systeme entwickeln sich rasch von Pilotprojekten zu Produktivsystemen in den Bereichen

Finanzwesen, Gesundheitswesen, Verteidigung, kritische Infrastrukturen und öffentlicher Sektor. Im

Gegensatz zu aufgabenspezifischen Automatisierungen planen, entscheiden und handeln Agenten über

mehrere Schritte und Systeme hinweg, oft im Auftrag von Nutzern und Teams. Die Agentic Security Initiative

hat bereits damit begonnen, Schutzmaßnahmen für agentische Anwendungen zu definieren, veröffentlicht

jedoch eine Reihe von Leitlinien, die den gesamten Lebenszyklus abdecken.

Unsere Kern-Taxonomie (Agentic AI - Threats and Mitigations) liefert eine grundlegende Definition von

Agenten, ihrer Beziehung zu LLM-Anwendungen, der Rolle der Autonomie sowie eine detaillierte

Behandlung von Bedrohungen und Gegenmaßnahmen. Weitere Dokumente behandeln Threat Modelling

(Agentic Threat Modelling Guide), die Absicherung von Architektur, Design, Entwicklung und Bereitstellung

agentischer Anwendungen (Securing Agentic Applications) sowie Governance (State of Agentic AI Security

and Governance).

Diese Publikationen bieten einen umfassenden Satz an Leitlinien, die als Referenz und ausführliche

Abhandlung gedacht sind. Dennoch kann ihr Umfang es Entwicklern, Verteidigern und Entscheidungsträgern

erschweren, sie in die tägliche Praxis zu übertragen.

Unser OWASP Top 10 für Agentische Anwendungen (oder OWASP Agentic Top 10) dient als Kompass und

zentrale Referenz für Sicherheitsverantwortliche und Praktiker, um die zehn wirkungsvollsten Bedrohungen

zu verstehen, anzugehen und ihre Reise zu beginnen.

Er nutzt das standardisierte und beliebte Format der OWASP Top 10, um prägnante, praxisnahe und

umsetzbare Anleitungen bereitzustellen. Jeder Eintrag enthält eine kurze Beschreibung, häufige

Schwachstellen, Beispielszenarien und, am wichtigsten, umsetzbare Gegenmaßnahmen, die Teams bereits

heute umsetzen können.

Unser Ziel ist es, bestehende Leitlinien zu vereinfachen und zu verknüpfen, nicht zu einer Überflutung mit

sich überschneidenden Leitlinien beizutragen. Wir verweisen auf unsere Agentic AI Threats and Mitigations,

die unsere grundlegende und detaillierte Taxonomie bleibt, auf der diese Top 10 aufbaut.

Unser Fokus liegt auf agentischen Anwendungen, doch diese existieren nicht isoliert, sondern sind Teil der

Entwicklung einer LLM-Anwendung. Daher verweisen unsere Einträge auf die OWASP Top 10 für

LLM-Anwendungen sowie auf andere relevante Standards.

Dazu zählen verschiedene weitere OWASP Top 10, der CycloneDX-Standard, die Top 10 für Non-Human

Identities (NHI) sowie das OWASP AI Vulnerability Scoring System (AIVSS) zur Bewertung und Priorisierung.

genai.owasp.org

Agenten verstärken bestehende Schwachstellen. Wir erweitern die Konzepte des Least-Privilege und der

Excessive Agency, indem wir Least-Agency anführen. Dies fasst unseren Rat an Organisationen zusammen,

unnötige Autonomie zu vermeiden; der Einsatz agentischen Verhaltens dort, wo es nicht benötigt wird,

vergrößert die Angriffsfläche, ohne einen Mehrwert zu schaffen. Ebenso wird eine starke Beobachtbarkeit

(Observability) unverzichtbar: Ohne klare Einsicht in das, was Agenten tun, warum sie es tun und welche

Tools sie aufrufen, kann unnötige Autonomie die Angriffsfläche unbemerkt vergrößern und kleinere Probleme

in systemweite Ausfälle verwandeln.

Dieses Dokument ist das Ergebnis der Arbeit der globalen OWASP-Community. Dutzende von

Sicherheitsexperten aus Industrie, Wissenschaft und Regierung haben Bedrohungsforschung, Red-Team-

Erkenntnisse und praxiserprobte Gegenmaßnahmen beigesteuert, mit Unterstützung von Organisationen,

die agentische Plattformen entwickeln, öffentlichen Institutionen und Produktanbietern.

Der Abschnitt „Danksagungen“ enthält eine Liste unserer Entry Leads, Mitwirkenden, unseres

ausgezeichneten Expertenbeirats und der Organisationen, die an unserer Überprüfung teilgenommen

haben, wodurch wir vielfältige Erkenntnisse aus der Praxis einbeziehen konnten.

Wir sind ihnen zu Dank verpflichtet und werden uns weiterhin nach unserem von OWASP-Experten geleiteten,

community-getriebenen Ansatz aus offener Zusammenarbeit, Peer-Review und Erkenntnissen aus Forschung,

Exploits, Vorfällen und Herausforderungen aus realen Einsätzen weiterentwickeln.

Mit herzlichen Grüßen,

John Sotiropoulos, OWASP GenAI Security Project Board Member & ASI Co-Lead, Agentic Top 10 Chair

Keren Katz, Agentic Top 10 Lead, OWASP GenAI Security Project - ASI Core Team

Ron F. Del Rosario, OWASP GenAI Security Project Core Team Member & ASI Co-Lead

genai.owasp.org
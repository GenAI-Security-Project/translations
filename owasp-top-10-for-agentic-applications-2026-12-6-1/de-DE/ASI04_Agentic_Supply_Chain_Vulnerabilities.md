<!-- status: draft -->
# ASI04: Schwachstellen in der Agentic Supply Chain (Agentic Supply Chain Vulnerabilities)

## Beschreibung

Schwachstellen in der Agentic Supply Chain entstehen, wenn Agenten, Tools und zugehörige Artefakte, mit denen sie arbeiten, von Dritten bereitgestellt werden und böswillig, kompromittiert oder während der Übertragung manipuliert sein können. Dies können sowohl statisch als auch dynamisch bezogene Komponenten sein, einschließlich Modelle und Modellgewichte, Tools, Plug-ins, Datensätze, andere Agenten, agentische Schnittstellen – MCP (Model Context Protocol), A2A (Agent2Agent) – agentische Registries und zugehörige Artefakte oder Update-Kanäle. Diese Abhängigkeiten können unsicheren Code, versteckte Anweisungen oder täuschendes Verhalten in die Ausführungskette des Agenten einschleusen.

Die Supply Chain wird ausführlich in LLM03:2025 Supply Chain Vulnerabilities behandelt. Deren Fokus liegt jedoch auf statischen Abhängigkeiten. Im Gegensatz zu traditionellen KI- oder Software-Supply-Chains setzen agentische Ökosysteme Fähigkeiten häufig zur Laufzeit zusammen – indem sie externe Tools und Agent-Personas dynamisch laden – und vergrößern dadurch die Angriffsfläche. Diese verteilte Laufzeitkoordination – kombiniert mit agentischer Autonomie – schafft eine lebendige Supply Chain, die Schwachstellen kaskadenartig über Agenten hinweg verbreiten kann. Diese Verschiebungen verlagern den Fokus von der Manifest- hin zur Laufzeitsicherheit einer vielfältigen und oft undurchsichtigen Komponente. Die Bewältigung dieses Problems erfordert sorgfältiges Tooling zur Entwicklungszeit sowie Laufzeit-Orchestrierung, bei der Komponenten dynamisch geladen, geteilt und vertraut werden.

Dieser Eintrag ordnet sich T17 Supply Chain Compromise in Agentic Threats and Mitigations zu sowie übergreifend T2 Tool Misuse, T11 Unexpected RCE and Code Attacks, T12 Agent Communication Poisoning, T13 Rogue Agent und T16 Insecure Inter-Agent Protocol Abuse.

## Häufige Beispiele der Schwachstelle

1. Vergiftete Prompt-Templates, die remote geladen werden: Ein Agent ruft automatisch Prompt-Templates aus einer externen Quelle ab, die versteckte Anweisungen enthalten (z. B. um Daten zu exfiltrieren oder destruktive Aktionen auszuführen), was dazu führt, dass er böswilliges Verhalten ohne Absicht des Entwicklers ausführt.

2. Tool-Deskriptor-Injektion: Ein Angreifer bettet versteckte Anweisungen oder bösartige Payloads in die Metadaten eines Tools oder eine MCP-/Agent-Card ein, die der Host-Agent als vertrauenswürdige Anleitung interpretiert und danach handelt.

3. Impersonation und Typosquatting: Wenn ein Agent dynamisch externe Tools oder Dienste entdeckt oder sich mit ihnen verbindet, kann er auf zwei Arten getäuscht werden: durch einen typosquatteten Endpunkt (einen ähnlich aussehenden Namen, der gewählt wurde, um die Auflösung zu täuschen) oder durch einen Symbol-Angriff, bei dem ein bösartiger Dienst absichtlich

ein legitimes Tool oder einen legitimen Agenten imitiert, dessen Identität, API und Verhalten nachahmt, um Vertrauen zu gewinnen und bösartige Aktionen auszuführen.

4. Verwundbarer Drittanbieter-Agent (Agent → Agent). Ein Drittanbieter-Agent mit ungepatchten Schwachstellen oder unsicheren Standardeinstellungen wird in Multi-Agenten-Workflows eingebunden. Ein kompromittierter oder fehlerhafter Peer-Agent kann genutzt werden, um sich seitwärts zu bewegen (Pivoting), Daten zu leaken oder bösartige Anweisungen an ansonsten vertrauenswürdige Agenten weiterzuleiten.

5. Kompromittierter MCP-/Registry-Server. Ein bösartiger oder kompromittierter Agent-Management-/MCP-Server (oder eine Paket-Registry) liefert signiert aussehende Manifeste, Plug-ins oder Agent-Deskriptoren aus. Da Orchestrierungssysteme der Registry vertrauen, ermöglicht dies eine weitreichende Verbreitung manipulierter Komponenten und Deskriptor-Injektionen im großen Maßstab.

6. Vergiftetes Wissens-Plugin: Ein beliebtes RAG-Plugin ruft Kontext von einem Drittanbieter-Indexer ab, der mit präparierten Einträgen versehen wurde. Der Agent wird beim Verarbeiten dieser Daten allmählich verzerrt (biased) und exfiltriert bei normaler Nutzung sensible Daten.

## Beispiele für Angriffsszenarien

1. Amazon-Q-Supply-Chain-Kompromittierung: Ein vergifteter Prompt im Q-Repository für VS Code wird in Version 1.84.0 an Tausende ausgeliefert, bevor er entdeckt wird; obwohl er scheitert, zeigt er, wie Manipulationen der vorgelagerten Agent-Logik über Erweiterungen kaskadieren und die Auswirkungen verstärken.

2. MCP-Tool-Deskriptor-Vergiftung: Ein Forscher zeigt eine Prompt-Injection im MCP von GitHub, bei der ein bösartiges öffentliches Tool Befehle in seinen Metadaten versteckt; bei Aufruf exfiltriert der Assistent private Repository-Daten ohne Wissen des Nutzers.

3. Bösartiger MCP-Server, der Postmark imitiert: Berichtet als der erste in freier Wildbahn entdeckte bösartige MCP-Server auf npm, der postmark-mcp imitierte und heimlich E-Mails per BCC an den Angreifer sendete.

4. AgentSmith-Prompt-Hub-Proxy-Angriff: Prompt-Proxying exfiltriert Daten und kapert Antwortflüsse, wodurch die dynamische Orchestrierung in agentischen Systemen manipuliert wird.

5. Ein kompromittiertes NPM-Paket (z. B. eine vergiftete nx/debug-Release) wurde automatisch von Coding-Agenten installiert und ermöglichte eine versteckte Backdoor, die SSH-Schlüssel und API-Token exfiltrierte und dadurch eine Supply-Chain-Kompromittierung über agentische Workflows hinweg verbreitete.

6. Agent-in-the-Middle über Agent Cards: Ein kompromittierter oder betrügerischer Peer bewirbt übertriebene Fähigkeiten in seiner Agent Card (z. B. /.well-known/agent.json); dies veranlasst Host-Agenten, ihn für Aufgaben auszuwählen, wodurch sensible Anfragen und Daten über den angreiferkontrollierten Agenten geleitet werden, der daraufhin Antworten exfiltriert oder verfälscht

## Präventions- und Abhilfemaßnahmen

1. Herkunftsnachweis (Provenance) und SBOMs, AIBOMs: Manifeste, Prompts und Tool-Definitionen signieren und bescheinigen; SBOMs, AIBOMs mit periodischen Attestierungen verlangen und operationalisieren; ein Inventar der KI-Komponenten pflegen; kuratierte Registries verwenden und nicht vertrauenswürdige Quellen blockieren.

2. Dependency-Gatekeeping: Allowlisting und Pinning; auf Typosquats scannen (PyPI, npm, LangChain, LlamaIndex); Herkunft vor Installation oder Aktivierung verifizieren; unsignierte oder unverifizierte Komponenten automatisch ablehnen.

3. Containment und Builds: Sensible Agenten in sandboxed Containern mit strengen Netzwerk- oder Syscall-Beschränkungen ausführen; reproduzierbare Builds verlangen.

4. Sichere Prompts und Speicher: Prompts, Orchestrierungsskripte und Speicherschemata unter Versionskontrolle mit Peer-Review stellen; auf Anomalien scannen.

5. Sicherheit zwischen Agenten: Gegenseitige Authentifizierung und Attestierung über PKI und mTLS erzwingen; keine offene Registrierung; alle Inter-Agenten-Nachrichten signieren und verifizieren.

6. Kontinuierliche Validierung und Überwachung: Signaturen, Hashes und SBOMs (einschließlich AIBOMs) zur Laufzeit erneut prüfen; Verhalten, Privilegiennutzung, Herkunft (Lineage) und modulübergreifende Telemetrie auf Anomalien überwachen.

7. Pinning: Prompts, Tools und Konfigurationen per Content-Hash und Commit-ID fixieren. Ein gestaffeltes Rollout mit Differenzialtests und automatischem Rollback bei Hash-Abweichung oder Verhaltensänderung verlangen.

-

8. Supply-Chain-Notschalter (Kill Switch): Notfall-Widerrufsmechanismen implementieren, die bestimmte Tools, Prompts oder Agentenverbindungen über alle Deployments hinweg sofort deaktivieren können, wenn eine Kompromittierung erkannt wird, um weiteren kaskadierenden Schaden zu verhindern.

9. Zero-Trust-Sicherheitsmodell im Anwendungsdesign: Systeme mit Sicherheits-Fehlertoleranz entwerfen, die von einem Ausfall oder einer Ausnutzung von LLM- oder agentischen Funktionskomponenten ausgeht.

## Referenzen

1. https://www.bleepingcomputer.com/news/security/amazon-ai-coding-agent-hacked-to-inject-

data-wiping-commands/

2. https://invariantlabs.ai/blog/mcp-github-vulnerability

3. Reconstructing a timeline for Amazon Q prompt infection

4. https://www.trustwave.com/en-us/resources/blogs/spiderlabs-blog/agent-in-the-middle-

abusing-agent-cards-in-the-agent-2-agent-protocol-to-win-all-the-tasks/

5. How an AI Agent Vulnerability in LangSmith Could Lead to Stolen API Keys and Hijacked LLM

Responses - Noma Security

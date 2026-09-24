<!-- status: draft -->
# Приложение A — Матрица сопоставления безопасности OWASP Agentic AI

Перекрёстное сопоставление ASI Top 10, LLM Top 10, Agentic AI Threats & Mitigations и базовых рисков AIVSS

Идентификатор/название ASI Соответствие OWASP LLM Top 10 Agentic AI Threats & Mitigations Базовый риск AIVSS (2025)

ASI 01 – Захват цели агента LLM01:2025 Prompt Injection · LLM06:2025 Excessive Agency T6 Goal Manipulation · T7 Misaligned & Deceptive Behaviors Manipulation инструкций цели агента

ASI 02 – Злоупотребление инструментами и их эксплуатация LLM06:2025 Excessive Agency T2 Tool Misuse · T4 Resource Overload · T16 Insecure Inter-Agent Protocol Abuse Злоупотребление инструментами агентного ИИ

ASI 03 – Злоупотребление идентификацией и привилегиями LLM01:2025 Prompt Injection · LLM06:2025 Excessive Agency · LLM02:2025 Sensitive Info Disclosure T3 Privilege Compromise Нарушение контроля доступа агента

ASI 04 – Уязвимости цепочки поставок агентных систем LLM03:2025 Supply Chain Vulnerabilities T17 Supply Chain Compromise · T2 Tool Misuse · T11 Unexpected RCE · T12 Agent Comm Poisoning · T13 Rogue Agent · T16 Insecure Inter-Agent Protocol Abuse Атаки на цепочку поставок и зависимости агента

ASI 05 – Непредвиденное выполнение кода (RCE) LLM01:2025 Prompt Injection · LLM05 Improper Output Handling T11 Unexpected RCE & Code Attacks Небезопасное взаимодействие с критическими системами агента

ASI 06 – Отравление памяти и контекста LLM01:2025 Prompt Injection · LLM04:2025 Data & Model Poisoning · LLM08:2025 Vector & Embedding Weaknesses T1 Memory Poisoning · T4 Memory Overload · T6 Broken Goals · T12 Shared Memory Poisoning Использование памяти и контекстная осведомлённость

ASI 07 – Небезопасное взаимодействие между агентами LLM02:2025 Sensitive Information Disclosure · LLM06:2025 Excessive Agency T12 Agent Communication Poisoning · T16 Insecure Inter-Agent Protocol Abuse Манипуляция памятью и контекстом агента

ASI 08 – Каскадные сбои LLM01:2025 Prompt Injection · LLM04 Data & Model Poisoning · LLM06:2025 Excessive Agency T5 Cascading Hallucination Attacks · T8 Repudiation & Untraceability Каскадные сбои агента

ASI 09 – Эксплуатация доверия между человеком и агентом LLM01:2025 Prompt Injection · LLM05:2025 Improper Output Handling · LLM06:2025 Excessive Agency · LLM09 Misinformation T7 Misaligned & Deceptive Behaviors · T8 Repudiation & Untraceability · T10 Overwhelming Human in the Loop Невозможность отследить агента / манипуляция человеком

ASI 10 – Агенты, вышедшие из-под контроля LLM02:2025 Sensitive Information Disclosure · LLM09:2025 Misinformation T13 Rogue Agents in Multi-Agent Systems · T14 Human Attacks on Multi-Agent Systems · T15 Human Manipulation Поведенческая целостность (BI) · операционная безопасность (OS) · нарушения соответствия требованиям (CV)

Примечания

• Соответствие LLM Top 10: отражает базовые уязвимости LLM, распространённые на агентные системы.
• Agentic Threats & Mitigations (T1–T17): представляют собой детализированные пути атак, на которые ссылается структура ASI.
• Базовые риски AIVSS: соотносятся с количественными категориями оценки для приоритизации и ранжирования по серьёзности (например, BI, OS, CV).
• Ключевое наблюдение о пересечении: записи ASI часто сочетают несколько записей LLM — например, ASI01 объединяет LLM01:2025 (промпт) с LLM06 (автономность), — отражая то, как агентная автономность усиливает риски на уровне модели.

"""AI-901 domain 1: Identify AI concepts and capabilities (40–45%). Nine focused lessons.

Written for Microsoft Foundry and Foundry Tools. No AI-900 material is reused.
"""
from _ai901 import (AGENTS, CU, CU_ANALYZERS, DEPLOY, E, FILTER, FOUNDRY, GUIDE, IMAGES, LANG, ML, PRINCIPLES, PROMPT, RAI, SPEECH, VISION,
                    anim, cfg, chooser_checks, lab, qa)
from builder import lesson

anim("ai901-rai-core-sim", "Fairness, reliability and safety, privacy and security", ["AI901-1.1.1", "AI901-1.1.2", "AI901-1.1.3"], "Match concrete practices and concerns to the fairness, reliability and safety, and privacy and security principles.")
anim("ai901-rai-people-sim", "Inclusiveness, transparency and accountability", ["AI901-1.1.4", "AI901-1.1.5", "AI901-1.1.6"], "Match concrete practices and concerns to the inclusiveness, transparency and accountability principles.")
anim("ai901-genai-sim", "How a generative model produces text", ["AI901-1.2.1"], "Step through tokenisation, the context window, next-token sampling with temperature, top_p and max_output_tokens, and content filters; then match generative AI vocabulary.")
anim("ai901-model-sim", "Choosing a model by capability", ["AI901-1.2.2"], "Pick chat, reasoning, small, multimodal, embedding, image or speech models for each requirement, and balance capability against cost and speed.")
anim("ai901-deploy-sim", "Deployment types and configuration", ["AI901-1.2.3"], "Pick Global, Data Zone, Standard, Provisioned or Batch deployments for each requirement, and the setting that solves each deployment problem.")
anim("ai901-workload-sim", "AI workloads", ["AI901-1.3.1"], "Match scenarios to generative, agentic, text, speech, vision and extraction workloads, and decide between a model, an agent or a Foundry Tool.")
anim("ai901-text-sim", "Text analysis techniques", ["AI901-1.3.2"], "Run key phrase extraction, entity recognition, sentiment with opinion mining, PII redaction, summarization and language detection on sample texts.")
anim("ai901-speech-sim", "Speech recognition and synthesis", ["AI901-1.3.3"], "Pick Azure Speech features for each need and follow a voice pipeline from microphone to speaker.")
anim("ai901-vision-sim", "Computer vision, image generation and information extraction", ["AI901-1.3.4", "AI901-1.3.5"], "Pick captioning, detection, OCR, tagging, visual Q&A or image generation, and choose Extract, Classify or Generate for extracted fields.")

# ================================================================ 1.1.1–1.1.3
lesson(
    id="ai901-rai-fairness-safety-privacy", exam=E, title="Responsible AI: fairness, reliability and safety, privacy and security",
    objectives=["AI901-1.1.1", "AI901-1.1.2", "AI901-1.1.3"], minutes=35,
    objective="Describe considerations for fairness, reliability and safety, and privacy and security in an AI solution, and the practices that address them.",
    prereqs=["No prior AI knowledge needed"],
    foundation=[
        "AI systems make predictions and generate content that affects real people. Microsoft defines six principles for responsible AI; this lesson covers the first three.",
        "Fairness: the system should treat everyone fairly. A loan model shouldn't approve one group less often than a similar group without good reason.",
        "Reliability and safety: the system should work as intended, also in unusual situations, and fail safely instead of causing harm.",
        "Privacy and security: protect the data used to train and run the system, respect people's privacy, and defend against attacks.",
    ],
    engineer=[
        "Fairness risks: biased training data (under-represented groups), sensitive attributes or proxies (postcode standing in for ethnicity), and different quality of service (speech recognition that works worse for some accents). Harms include allocation (jobs, loans) and quality-of-service gaps.",
        "Fairness practices: review data for representation, compare selection and error rates across groups (for example with the Responsible AI dashboard's fairness assessment), remove or justify proxy features, and keep testing after changes.",
        "Reliability and safety risks: unexpected inputs, edge cases, model drift, hallucinations in generative AI, and harmful outputs. Practices: evaluate before release (Foundry evaluations for quality and safety), red-team with adversarial prompts, set content filters and guardrails, keep humans in the loop for high-impact decisions, monitor in production, and define a safe fallback.",
        "Privacy and security risks: personal data in training data, prompts or logs; data leakage; prompt injection and jailbreaks. Practices: collect only what you need and get consent, detect and redact PII (Azure Language PII detection), use Microsoft Entra ID and private networking, keep keys in Key Vault, and use Prompt Shields to detect direct and indirect prompt attacks.",
        "In Microsoft Foundry, prompts and completions sent to models are not used to train the foundation models, and data stays in your Azure tenant and chosen geography (see each service's data privacy documentation).",
    ],
    anim=("ai901-rai-core-sim", "Match practices and concerns to fairness, reliability and safety, and privacy and security."),
    diagram=([("data", "Training and grounding data", 0, 80, "storage"), ("fair", "Fairness: compare outcomes per group", 260, 0, "user"), ("rel", "Reliability & safety: evaluate, filter, monitor", 260, 110, "security"), ("priv", "Privacy & security: minimise, redact, protect", 260, 220, "security"), ("sys", "AI system in production", 540, 110, "ai")],
             [("data", "fair"), ("data", "priv"), ("fair", "sys"), ("rel", "sys"), ("priv", "sys")]),
    example=("A loan pre-screening assistant", ["A bank's model approves applicants from one postcode area far less often. The fairness assessment shows postcode acting as a proxy; the team removes it and re-tests error rates per group.",
                                                  "Before launch they red-team the chat assistant, set content filters and a 'transfer to a person' fallback, and redact account numbers from logs."]),
    config=cfg(["Foundry portal > Guardrails + controls: content filters and Prompt Shields.", "Foundry portal > Evaluation: run quality and safety evaluations on a model or agent.", "Open a model card to read intended uses and limitations."], from_saved="ai901-responsible-ai",
               perms=("Azure AI User to run evaluations; Azure AI Project Manager to change guardrails",)),
    lab=lab("Recognise which principle each practice supports.", ["Fairness, reliability and safety, privacy and security tab: answer every practice.", "Responsible AI tab: match each concern to a principle."],
            ["Comparing outcomes per group is fairness", "PII redaction is privacy"], chooser_checks("rai-core", "principle") + [("ai-principle-correct", "Matched a concern to its principle")],
            ["Treating accuracy alone as fairness", "Logging raw prompts that contain personal data"]),
    troubleshooting=[("A speech app works poorly for some accents.", "Unrepresentative training or test data (quality-of-service gap).", "Test with diverse speakers; use custom speech with representative data."),
                     ("Logs contain customers' card numbers.", "No PII handling before storage.", "Redact PII before logging and limit retention.")],
    comparisons=[("Fairness vs inclusiveness", "Fairness is equal treatment in outcomes; inclusiveness is designing so everyone can use the system."), ("Safety vs security", "Safety prevents the system causing harm; security protects it from attackers.")],
    misconceptions=[("Removing the sensitive attribute guarantees fairness.", "Proxies can carry the same bias."), ("A highly accurate model is safe.", "Rare failures and harmful outputs still need guardrails."), ("Data sent to Foundry models trains them.", "Your prompts aren't used to train foundation models.")],
    decisions=["Assess fairness on every release.", "Red-team and evaluate before production.", "Minimise and protect personal data end to end."],
    docs=[("What is Responsible AI?", RAI), ("Microsoft responsible AI principles", PRINCIPLES), ("Content filtering and Prompt Shields", FILTER), ("AI-901 study guide", GUIDE)],
)
qa("AI901-1.1.1", 2, "scenario", "A hiring model rejects more women than men with similar qualifications. Which principle is at risk, and what should you do first?", [("Fairness: compare selection and error rates by group and investigate the data", "Correct."), ("Transparency: add a disclaimer", "Doesn't fix the harm."), ("Reliability: add more servers", "Unrelated."), ("Privacy: encrypt the CVs", "Unrelated.")], "a", "Measure and mitigate unfair outcomes.", RAI)
qa("AI901-1.1.1", 2, "single", "Why can removing a sensitive attribute such as ethnicity fail to make a model fair?", [("Other features can act as proxies for it", "Correct."), ("Models ignore removed features anyway", "No."), ("It makes the model too accurate", "No."), ("It breaks content filters", "No.")], "a", "Proxies such as postcode can encode bias.", RAI)
qa("AI901-1.1.2", 2, "scenario", "A medical triage assistant must never give a confident answer when it is unsure. Which practice supports reliability and safety?", [("Define a fallback that escalates uncertain cases to a clinician", "Correct."), ("Raise the temperature", "More random."), ("Hide confidence scores", "Opposite of safe."), ("Remove logging", "Hurts monitoring.")], "a", "Fail safely with human oversight.", RAI)
qa("AI901-1.1.2", 2, "single", "Which activity tests a generative AI app's safety before release?", [("Red-teaming with adversarial and harmful prompts", "Correct."), ("Choosing a cheaper deployment", "Cost."), ("Adding more tokens to the context", "No."), ("Translating the UI", "Inclusiveness.")], "a", "Probe for failures deliberately.", FILTER)
qa("AI901-1.1.3", 2, "multiple", "Which TWO measures protect privacy and security in a generative AI app?", [("Detect and redact PII before storing transcripts", "Correct."), ("Use Prompt Shields to detect prompt-injection attacks", "Correct."), ("Store API keys in the source code", "Insecure."), ("Collect as much user data as possible", "Data minimisation instead.")], "ab", "Minimise data; defend against attacks.", FILTER)
qa("AI901-1.1.3", 1, "single", "Which principle is most directly concerned with protecting personal data used by an AI system?", [("Privacy and security", "Correct."), ("Inclusiveness", "No."), ("Fairness", "No."), ("Transparency", "No.")], "a", "Privacy and security.", RAI)

# ================================================================ 1.1.4–1.1.6
lesson(
    id="ai901-rai-inclusive-transparent-accountable", exam=E, title="Responsible AI: inclusiveness, transparency and accountability",
    objectives=["AI901-1.1.4", "AI901-1.1.5", "AI901-1.1.6"], minutes=30,
    objective="Describe considerations for inclusiveness, transparency and accountability in an AI solution.",
    prereqs=[("Fairness, reliability, privacy", "AI901-1.1.1", "ai901-rai-fairness-safety-privacy")],
    foundation=[
        "Inclusiveness: design AI so that everyone can benefit and take part, including people with disabilities, different languages, and limited connectivity.",
        "Transparency: people should know when they are dealing with AI, what it can and can't do, and, where possible, why it reached a result.",
        "Accountability: people, not the AI, are responsible for AI systems. Someone owns the system, decisions are governed, and humans can step in.",
    ],
    engineer=[
        "Inclusiveness practices: support assistive technologies (screen readers, captions, keyboard navigation), offer several input and output modes (speech, text, images), localise languages, design for low bandwidth, and test with diverse users including people with disabilities. Microsoft's inclusive design guidance applies.",
        "Transparency practices: disclose AI-generated content and AI interactions; document intended uses, capabilities and limitations (Microsoft publishes Transparency Notes for its AI services); provide explanations or contributing factors for decisions (interpretability); cite sources for grounded answers; add content credentials (provenance) to generated images.",
        "Accountability practices: name owners; set up governance (review boards, impact assessments, Microsoft's Responsible AI Standard as a model); keep audit logs; provide appeal or feedback channels; maintain human oversight with the ability to override or switch off; comply with laws and industry standards.",
        "These principles work together: a transparent system makes accountability possible; inclusive testing reveals fairness problems.",
    ],
    anim=("ai901-rai-people-sim", "Match practices and concerns to inclusiveness, transparency and accountability."),
    diagram=([("users", "Diverse users", 0, 80, "user"), ("inc", "Inclusiveness: accessible, multi-modal, multilingual", 250, 0, "user"), ("tr", "Transparency: disclose, document, explain", 250, 110, "service"), ("acc", "Accountability: owners, governance, oversight", 250, 220, "security"), ("sys", "AI system", 540, 110, "ai")],
             [("users", "inc"), ("inc", "sys"), ("tr", "users", "informs"), ("acc", "sys", "governs")]),
    example=("A city services chatbot", ["The city's assistant accepts voice and text in five languages and works with screen readers (inclusiveness).",
                                          "Every answer says it was AI-generated and links to its sources, and a published notice explains what it can't do (transparency). A named service owner reviews complaints monthly, and staff can disable it instantly (accountability)."]),
    config=cfg(["Foundry portal > model card: intended uses and limitations (transparency).", "Foundry portal > Monitoring and tracing: keep records of agent runs for review (accountability).", "Speech playground: test voice input and captions (inclusiveness)."], from_saved="ai901-responsible-ai",
               perms=("Azure AI User",)),
    lab=lab("Recognise which principle each practice supports.", ["Inclusiveness, transparency, accountability tab: answer every practice.", "Responsible AI tab: match each concern to a principle."],
            ["Disclosure and documented limits are transparency", "Owners and the ability to override are accountability"], chooser_checks("rai-people", "principle") + [("ai-principle-correct", "Matched a concern to its principle")],
            ["Hiding that answers are AI-generated", "No owner for an AI system in production"]),
    troubleshooting=[("Users don't realise answers come from AI and trust them blindly.", "No disclosure.", "Label AI-generated content and explain limitations."),
                     ("Nobody can say who approved an AI feature after an incident.", "No accountability process.", "Assign owners and require reviews for high-impact uses.")],
    comparisons=[("Transparency vs explainability", "Transparency includes disclosure and documentation; explainability is one part: why a specific result was produced."), ("Accountability vs reliability", "Accountability is about people and governance; reliability is about the system behaving correctly.")],
    misconceptions=[("Transparency means publishing the model's source code.", "It means people understand the system's use, limits and outputs."), ("If the AI made the decision, nobody is accountable.", "People and organisations remain accountable."), ("Inclusiveness only concerns accessibility.", "It also covers language, culture, connectivity and more.")],
    decisions=["Always disclose AI interactions.", "Publish what your system can and can't do.", "Name an owner and keep a human able to override."],
    docs=[("What is Responsible AI?", RAI), ("Microsoft responsible AI principles", PRINCIPLES), ("Transparency Notes for Azure AI services", ML + "azure/ai-foundry/responsible-ai/openai/transparency-note"), ("AI-901 study guide", GUIDE)],
)
qa("AI901-1.1.4", 2, "scenario", "A voice assistant only accepts spoken input. Which change most improves inclusiveness?", [("Also accept text input and provide captions for spoken output", "Correct."), ("Use a larger model", "No."), ("Lower the temperature", "No."), ("Add more logging", "No.")], "a", "Multiple input and output modes.", RAI)
qa("AI901-1.1.4", 1, "single", "Testing an app with people who use screen readers supports which principle?", [("Inclusiveness", "Correct."), ("Accountability", "No."), ("Privacy and security", "No."), ("Reliability and safety", "Partly, but primarily inclusiveness.")], "a", "Designing for all abilities.", RAI)
qa("AI901-1.1.5", 2, "scenario", "A news site publishes AI-written summaries. Which practice supports transparency?", [("Label summaries as AI-generated and link to the original articles", "Correct."), ("Hide the AI to avoid confusion", "Opposite."), ("Use a reasoning model", "No."), ("Encrypt the summaries", "Security.")], "a", "Disclose and cite sources.", RAI)
qa("AI901-1.1.5", 2, "single", "What does adding content credentials (provenance) to generated images support?", [("Transparency about how the image was created", "Correct."), ("Image quality", "No."), ("Faster generation", "No."), ("Fairness", "No.")], "a", "Provenance shows content is AI-generated.", IMAGES)
qa("AI901-1.1.6", 2, "scenario", "After an AI scheduling tool cancelled patient appointments by mistake, nobody knew who approved it. What was missing?", [("Accountability: named owners, governance and human oversight", "Correct."), ("A higher rate limit", "No."), ("Inclusiveness", "Different principle."), ("A bigger context window", "No.")], "a", "People are accountable for AI systems.", RAI)
qa("AI901-1.1.6", 1, "single", "Which practice demonstrates accountability?", [("Keeping audit logs and the ability for staff to override the system", "Correct."), ("Using a multimodal model", "No."), ("Translating the UI", "Inclusiveness."), ("Publishing a model card", "Transparency.")], "a", "Oversight and records.", RAI)

# ================================================================ 1.2.1
lesson(
    id="ai901-how-genai-works", exam=E, title="How generative AI models work",
    objectives=["AI901-1.2.1"], minutes=40,
    objective="Describe how generative AI models work: tokens, embeddings, attention, next-token prediction, the context window, sampling parameters, and why grounding matters.",
    prereqs=["No prior AI knowledge needed"],
    foundation=[
        "A large language model (LLM) is trained on huge amounts of text to predict the next piece of text. Given 'The cat sat on the', it predicts 'mat' is likely.",
        "Text is split into tokens: whole words or pieces of words, about 4 characters of English each. Models read and write tokens, and you pay per token.",
        "To answer, the model calculates a probability for every possible next token, picks one, adds it, and repeats until it's done. That's why answers stream word by word.",
        "Models aren't databases. They can produce fluent answers that are wrong ('hallucinations'). Grounding, which means giving the model your data in the prompt, makes answers more accurate.",
    ],
    engineer=[
        "Transformer architecture: tokens become embeddings (vectors that capture meaning); self-attention lets each token weigh every other token in the context; stacked layers produce a probability distribution over the vocabulary for the next token.",
        "Training: pre-training on large text corpora learns language patterns; instruction tuning and reinforcement learning from human feedback make chat models follow instructions and refuse unsafe requests. Fine-tuning adapts a model further with your examples.",
        "Context window: the maximum tokens (system prompt + history + grounding data + the answer) in one request. Exceed it and older content must be dropped or summarised. Input and output tokens are both billed.",
        "Sampling: temperature (higher = more random and creative; near 0 = most likely tokens, more consistent), top_p (sample only from the smallest set of tokens whose probabilities sum to p), max_output_tokens (caps the answer; finish reason 'length' means it was cut off). Adjust temperature or top_p, not both. Some reasoning models don't accept these and use a reasoning-effort setting instead.",
        "Multimodal generative models also accept or produce images and audio; image models generate pixels from text through diffusion or similar techniques.",
        "Grounding / retrieval-augmented generation (RAG): retrieve relevant content (often with embeddings and vector search) and add it to the prompt so the model answers from it, with citations.",
    ],
    anim=("ai901-genai-sim", "Step through tokenise, context window, sampling and filtering; then match generative AI vocabulary."),
    diagram=([("p", "Prompt (system + user)", 0, 80, "user"), ("tok", "Tokens → embeddings", 200, 80, "service"), ("att", "Transformer layers (attention)", 400, 80, "ai"), ("prob", "Next-token probabilities", 600, 80, "ai"), ("samp", "Sample (temperature, top_p)", 600, 210, "security"), ("out", "Output tokens, streamed", 400, 210, "user")],
             [("p", "tok"), ("tok", "att"), ("att", "prob"), ("prob", "samp"), ("samp", "out"), ("out", "att", "append and repeat")]),
    example=("Why the FAQ bot varied its answers", ["A company FAQ bot gave different wording each time and once invented a refund rule. With temperature 1.0 it sampled less likely tokens; with no grounding it relied on training data.",
                                                    "The team set temperature to 0.2, added the refund policy to the prompt (grounding), and raised max_output_tokens because long answers were ending with finish reason 'length'."]),
    config=cfg(["Foundry portal > Playground > Parameters: temperature, top_p, max tokens.", "Compare answers at temperature 0 and 1 for the same prompt.", "Watch the token counts in the response details."], from_saved="ai901-generative-models"),
    lab=lab("See how parameters and limits change generation.", ["How a model generates text tab: run the default, then each preset; set temperature to 0.", "Generative AI vocabulary tab: answer every description."],
            ["Temperature 0 is the most predictable", "finish_reason 'length' means truncated"],
            [("ai-completed", "Completed a generation"), ("ai-truncated", "Saw a truncated answer"), ("ai-temperature-zero", "Generated with temperature 0")] + chooser_checks("genai-terms", "term"),
            ["Raising temperature to fix wrong facts", "Ignoring the context window in long chats"]),
    troubleshooting=[("Answers stop mid-sentence.", "max_output_tokens reached (finish reason 'length').", "Raise the limit or ask for shorter answers."),
                     ("The model states false facts confidently.", "No grounding; hallucination.", "Add retrieved data to the prompt and ask for citations.")],
    comparisons=[("Generative model vs search engine", "A model generates text from patterns; search retrieves existing documents. RAG combines them."), ("Temperature vs top_p", "Both control randomness: temperature reshapes probabilities; top_p truncates the candidate list.")],
    misconceptions=[("Models look up answers in a database.", "They predict tokens from learned patterns."), ("Temperature 0 makes answers correct.", "It makes them more consistent, not more truthful."), ("One token equals one word.", "Tokens are often parts of words.")],
    decisions=["Use low temperature for factual tasks, higher for creative ones.", "Ground answers in your data for accuracy.", "Budget tokens: prompt size and answer length drive cost and latency."],
    docs=[("What is Microsoft Foundry?", FOUNDRY), ("Prompt engineering techniques", PROMPT), ("Retrieval augmented generation in Foundry", ML + "azure/ai-foundry/concepts/retrieval-augmented-generation"), ("AI-901 study guide", GUIDE)],
)
qa("AI901-1.2.1", 2, "single", "What is the context window of a model?", [("The maximum number of tokens (input and output) it can handle in one request", "Correct."), ("The time it takes to respond", "Latency."), ("The browser window of the playground", "No."), ("The training data date range", "Training cutoff.")], "a", "Input + output tokens.", PROMPT)
qa("AI901-1.2.1", 2, "single", "What do embeddings represent?", [("Text as vectors of numbers capturing meaning", "Correct."), ("Compressed images", "No."), ("Encrypted prompts", "No."), ("Billing records", "No.")], "a", "Vectors for similarity.", FOUNDRY)
qa("AI901-1.2.1", 3, "scenario", "A model must answer only from a 40-page HR handbook and cite the section. What is the best approach?", [("Retrieve relevant handbook passages and include them in the prompt (RAG) with instructions to cite", "Correct."), ("Set temperature to 2", "More random."), ("Use a smaller model", "Doesn't add knowledge."), ("Increase top_p", "Randomness, not knowledge.")], "a", "Grounding with retrieval.", ML + "azure/ai-foundry/concepts/retrieval-augmented-generation")

# ================================================================ 1.2.2
lesson(
    id="ai901-choose-model", exam=E, title="Choosing an AI model by capability",
    objectives=["AI901-1.2.2"], minutes=30,
    objective="Identify an appropriate AI model based on its capabilities: chat, reasoning, small, multimodal, embedding, image and speech models, and their trade-offs.",
    prereqs=[("How generative AI works", "AI901-1.2.1", "ai901-how-genai-works")],
    foundation=[
        "There's no single best model. Pick the one whose capabilities match your task, at a cost and speed you can accept.",
        "Chat models converse and write. Reasoning models think step by step for hard problems. Small language models are cheap and fast. Multimodal models accept images or audio. Embedding models turn text into vectors for search. Image models create pictures. Speech models transcribe or speak.",
        "The Foundry model catalog lists thousands of models from Microsoft, OpenAI, Meta, Mistral, DeepSeek and others, with model cards and benchmarks to compare them.",
    ],
    engineer=[
        "Large chat models (for example GPT-family models): broad language ability, instruction following, tool calling. Reasoning models: spend extra compute 'thinking' before answering; best for complex maths, code, planning; slower and more expensive per request.",
        "Small language models (for example Phi): lower cost and latency, can run on edge devices; good for focused tasks such as classification or extraction, often after fine-tuning.",
        "Multimodal models accept image (and some audio) input alongside text; some produce audio (realtime/voice models). Embedding models (for example text-embedding-3) produce vectors for semantic search, clustering and RAG. Image generation models (for example gpt-image-1) create and edit images.",
        "Selection criteria: required input and output modalities; quality on your task (benchmarks, leaderboards, your own evaluations); context window size; latency; cost per token; tool-calling and structured-output support; region and deployment-type availability; licence and data considerations; fine-tuning support.",
        "Model catalog: filter by task, publisher, inference task and deployment option; read the model card (intended use, limitations, training data); compare models in leaderboards; test in the playground before committing.",
    ],
    anim=("ai901-model-sim", "Pick a model type for each requirement, then balance capability against cost and speed."),
    diagram=([("task", "Your task: modality, quality, latency, cost", 0, 100, "user"), ("cat", "Foundry model catalog: cards, benchmarks", 260, 100, "storage"), ("chat", "Chat / reasoning", 520, 0, "ai"), ("slm", "Small model", 520, 80, "ai"), ("mm", "Multimodal", 520, 160, "ai"), ("emb", "Embedding / image / speech", 520, 240, "ai")],
             [("task", "cat"), ("cat", "chat"), ("cat", "slm"), ("cat", "mm"), ("cat", "emb")]),
    example=("An insurer's AI toolbox", ["Claim photos go to a multimodal model to describe damage. A small model classifies incoming emails by type at high volume and low cost.",
                                          "An embedding model powers search over policy documents, and a reasoning model is used only for complex fraud investigations where accuracy matters more than speed."]),
    config=cfg(["Foundry portal > Model catalog: filter by inference task (chat completion, embeddings, text to image).", "Open a model card; compare in Model leaderboards.", "Deploy two candidates and test the same prompts in the playground."], from_saved="ai901-generative-models"),
    lab=lab("Choose models by capability and trade-off.", ["Choose a model tab: answer every requirement.", "Capability vs cost and speed tab: answer every requirement."],
            ["Image input needs a multimodal model", "High-volume simple tasks suit small models"], chooser_checks("ai-model", "model type") + chooser_checks("model-tradeoff", "model"),
            ["Using a reasoning model for simple, high-volume tasks", "Using a chat model for vector search"]),
    troubleshooting=[("Responses are too slow and expensive for simple classification.", "Model too large for the task.", "Try a smaller model or fine-tune a small one."),
                     ("Model can't read attached images.", "Not a vision-capable model.", "Deploy a multimodal model.")],
    comparisons=[("Reasoning vs chat model", "Reasoning models think longer and are better at complex problems; chat models are faster and cheaper for everyday tasks."), ("Embedding vs chat model", "Embeddings produce vectors for search; chat models produce text.")],
    misconceptions=[("The biggest model is always best.", "Cost, latency and fit matter."), ("Embedding models answer questions.", "They produce vectors used for retrieval."), ("Benchmarks guarantee results on your data.", "Evaluate on your own tasks.")],
    decisions=["Start with a capable general model, then optimise to smaller models.", "Evaluate candidate models on your own data.", "Match modalities first."],
    docs=[("Explore the Foundry model catalog", ML + "azure/ai-foundry/how-to/model-catalog-overview"), ("What is Microsoft Foundry?", FOUNDRY), ("Model leaderboards and benchmarks", ML + "azure/ai-foundry/concepts/model-benchmarks"), ("AI-901 study guide", GUIDE)],
)
qa("AI901-1.2.2", 2, "scenario", "You need to classify 2 million short support tickets per day into 8 categories at the lowest cost. Which model choice is most appropriate?", [("A small language model, possibly fine-tuned", "Correct."), ("A large reasoning model", "Expensive and slow."), ("An image generation model", "Wrong modality."), ("A text-to-speech model", "Wrong modality.")], "a", "Small models suit simple high-volume tasks.", ML + "azure/ai-foundry/how-to/model-catalog-overview")
qa("AI901-1.2.2", 2, "single", "Where can you read a model's intended uses, limitations and training information in Foundry?", [("The model card in the model catalog", "Correct."), ("The rate limit settings", "No."), ("The Activity log", "No."), ("Cost analysis", "No.")], "a", "Model cards document models.", ML + "azure/ai-foundry/how-to/model-catalog-overview")

# ================================================================ 1.2.3
lesson(
    id="ai901-deployment-options", exam=E, title="Model deployment options and configuration parameters",
    objectives=["AI901-1.2.3"], minutes=35,
    objective="Identify appropriate deployment types (Global, Data Zone, Standard, Provisioned, Batch) and deployment and request parameters for a model in Microsoft Foundry.",
    prereqs=[("Choosing a model", "AI901-1.2.2", "ai901-choose-model")],
    foundation=[
        "Before you can call a model in Foundry, you deploy it: you give it a deployment name, choose a deployment type, and set limits.",
        "The deployment type decides where requests are processed and how you pay: pay per token (Standard types), reserved capacity (Provisioned), or cheap delayed processing (Batch).",
        "Parameters come in two kinds: deployment settings (name, version, rate limit, content filter) chosen once, and request parameters (temperature, top_p, max output tokens) sent with each call.",
    ],
    engineer=[
        "Global Standard: pay per token; requests may be processed in any Azure region with capacity; highest default quota; the usual starting point. Data at rest stays in your resource's geography.",
        "Data Zone Standard: pay per token; processing stays within a data zone (EU or US). Standard (regional): processing within the resource's region/geography.",
        "Provisioned (Global, Data Zone, Regional): reserve provisioned throughput units (PTU) for predictable latency and throughput; billed hourly for capacity (with reservations available), whether or not you use it.",
        "Batch (Global, Data Zone): submit large files of requests asynchronously; target turnaround 24 hours; about 50% lower cost than Global Standard; separate quota. Developer deployments are for evaluating fine-tuned models.",
        "Deployment settings: model and version, version upgrade policy (auto-update to default, or pin), deployment name (what code passes as model=), tokens-per-minute rate limit (from regional quota; also sets requests per minute), content filter configuration, and dynamic quota options.",
        "Request parameters: temperature, top_p, max_output_tokens, stop sequences, response format (structured output), tools; reasoning models may use reasoning effort instead of temperature.",
    ],
    anim=("ai901-deploy-sim", "Pick a deployment type for each requirement and the setting that fixes each deployment problem."),
    diagram=([("model", "Model + version", 0, 100, "ai"), ("dep", "Deployment: name, type, TPM, content filter", 240, 100, "service"), ("gs", "Global / Data Zone / Standard: pay per token", 520, 0, "service"), ("ptu", "Provisioned: reserved PTU", 520, 100, "service"), ("batch", "Batch: async, ~50% cheaper", 520, 200, "service"), ("app", "App calls model='deployment name'", 240, 240, "user")],
             [("model", "dep"), ("dep", "gs"), ("dep", "ptu"), ("dep", "batch"), ("app", "dep")]),
    example=("Three deployments, one model", ["A European bank deploys the same chat model three times: Data Zone Standard (EU) for its customer assistant, Data Zone Provisioned for its high-volume call-centre copilot that needs steady latency, and Global Batch for nightly classification of non-personal research documents.",
                                               "Each has a clear deployment name, a pinned model version and the strictest content filter for the customer-facing app."]),
    config=cfg(["Foundry portal > Models + endpoints > Deploy model: choose deployment type, name, version upgrade policy, TPM, content filter.", "Management center > Quota: see TPM quota per region and model."], from_saved="ai901-generative-models"),
    lab=lab("Choose deployment types and settings.", ["Deployment options and parameters tab: run the default, then each preset.", "Deployment settings tab: answer every situation."],
            ["Data residency → Data Zone or Standard", "Bulk async → Batch"], [("ai-deploy-correct", "Chose the right deployment type"), ("ai-deploy-wrong", "Saw a better option")] + chooser_checks("deploy-setting", "setting"),
            ["Using Global Standard when processing must stay in the EU", "Passing the model family name instead of the deployment name"]),
    troubleshooting=[("429 Too Many Requests.", "Rate limit (TPM) exceeded.", "Retry with backoff, raise TPM within quota, or use Provisioned."),
                     ("Behaviour changed overnight.", "Version auto-upgraded.", "Pin the model version.")],
    comparisons=[("Standard vs Provisioned", "Standard is pay-per-token with shared capacity; Provisioned reserves throughput for predictable performance."), ("Global vs Data Zone", "Global may process anywhere; Data Zone keeps processing in the EU or US.")],
    misconceptions=[("Global deployments store your data anywhere.", "Data at rest stays in your geography; only processing may be global."), ("Batch gives instant results.", "It's asynchronous with a 24-hour target."), ("model= is the model family name.", "It's your deployment name.")],
    decisions=["Start with Global Standard unless residency rules apply.", "Use Provisioned for steady, high, latency-sensitive load.", "Use Batch for large offline jobs."],
    docs=[("Deployment types", DEPLOY), ("Quotas and limits", ML + "azure/ai-foundry/openai/quotas-limits"), ("Content filter configuration", FILTER), ("AI-901 study guide", GUIDE)],
)
qa("AI901-1.2.3", 2, "scenario", "A call-centre copilot needs consistent low latency for a high, steady volume of requests. Which deployment type fits best?", [("Provisioned (reserved PTU)", "Correct."), ("Global Batch", "Asynchronous."), ("Developer", "Fine-tune evaluation."), ("Global Standard with the lowest TPM", "Shared, variable.")], "a", "Provisioned throughput gives predictable performance.", DEPLOY)
qa("AI901-1.2.3", 2, "single", "Which is a request-time parameter rather than a deployment setting?", [("max_output_tokens", "Correct."), ("Deployment type", "Deployment."), ("Rate limit (TPM)", "Deployment."), ("Version upgrade policy", "Deployment.")], "a", "Sent with each request.", PROMPT)

# ================================================================ 1.3.1
lesson(
    id="ai901-ai-workloads", exam=E, title="Common AI workloads: generative, agentic, text, speech, vision and extraction",
    objectives=["AI901-1.3.1"], minutes=30,
    objective="Identify scenarios for common AI workloads, including generative and agentic AI, text analysis, speech, computer vision and information extraction.",
    prereqs=["No prior AI knowledge needed"],
    foundation=[
        "Generative AI creates new content (text, code, images) from a prompt. Agentic AI goes further: an agent uses a model plus tools to take steps and complete a task.",
        "Text analysis finds meaning in text (sentiment, entities, topics). Speech turns speech into text and text into speech. Computer vision understands images and video.",
        "Information extraction pulls structured data (fields like invoice total, date) out of documents, images, audio and video.",
        "Microsoft Foundry provides models for generative and agentic AI, plus Foundry Tools (formerly Azure AI services): Azure Language, Speech, Vision, Translator and Content Understanding.",
    ],
    engineer=[
        "Generative AI scenarios: drafting emails and documents, summarising, answering questions over your data (RAG), writing code, creating images. Agentic AI scenarios: booking, ordering, research assistants, IT helpdesk automation: tasks needing tools, multiple steps and sometimes several agents.",
        "Text analysis scenarios: review sentiment, extracting entities from contracts, detecting and redacting PII, language detection, summarising long reports. Speech scenarios: captions, call transcription and analytics, voice assistants, reading text aloud, speech translation.",
        "Computer vision scenarios: image captions and tags for accessibility and search, object detection for retail shelves, OCR of receipts, visual inspection, answering questions about photos. Information extraction scenarios: invoices, forms, ID documents, call recordings, video indexing.",
        "Choosing the approach: a prompt to a generative model is flexible; a Foundry Tool gives task-specific, consistent results with confidence scores; an agent adds tools and actions. Many solutions combine them, for example speech-to-text, then a model, then text-to-speech.",
    ],
    anim=("ai901-workload-sim", "Match scenarios to AI workloads, and decide between a model, an agent or a Foundry Tool."),
    diagram=([("f", "Microsoft Foundry", 300, 0, "service"), ("gen", "Generative AI (models)", 0, 120, "ai"), ("agent", "Agentic AI (models + tools)", 180, 120, "ai"), ("text", "Text: Azure Language", 360, 120, "ai"), ("speech", "Speech: Azure Speech", 540, 120, "ai"), ("vision", "Vision: Azure Vision / multimodal", 180, 240, "ai"), ("cu", "Extraction: Content Understanding", 420, 240, "ai")],
             [("f", "gen"), ("f", "agent"), ("f", "text"), ("f", "speech"), ("f", "vision"), ("f", "cu")]),
    example=("A retailer's AI map", ["Marketing drafts product descriptions with a chat model (generative). A returns agent checks the order system and creates labels (agentic).",
                                     "Azure Language scores review sentiment; Azure Speech transcribes support calls; shelf cameras use object detection; Content Understanding reads supplier invoices."]),
    config=cfg(["Foundry portal > your project: explore Models, Agents, and Foundry Tools playgrounds (Language, Speech, Vision, Content Understanding)."], from_saved="ai901-workloads", perms=("Azure AI User",)),
    lab=lab("Match scenarios to workloads and approaches.", ["AI workloads tab: answer every scenario.", "Generative, agentic or a Foundry Tool? tab: answer every scenario."],
            ["Using tools to act is agentic", "Fields from documents is information extraction"], chooser_checks("ai-workload", "workload") + chooser_checks("agentic-or-not", "approach"),
            ["Calling any chatbot 'agentic'", "Using a generative model where a consistent prebuilt service fits better"]),
    troubleshooting=[("Chatbot can't actually book appointments.", "It has no tools.", "Build an agent with a booking function or API tool."),
                     ("Sentiment scores vary between runs.", "A generative prompt without fixed scoring.", "Use Azure Language sentiment for consistent scores.")],
    comparisons=[("Generative vs agentic AI", "Generative produces content; agentic plans and acts with tools."), ("Text analysis vs information extraction", "Text analysis finds meaning in text; extraction fills defined fields from documents and media.")],
    misconceptions=[("Every AI feature needs a large language model.", "Prebuilt Foundry Tools often fit better."), ("Agents are just chatbots.", "Agents call tools and take actions."), ("Computer vision only means faces.", "It covers captions, objects, OCR and more.")],
    decisions=["Identify the workload before choosing services.", "Prefer prebuilt tools for standard tasks needing consistency.", "Add agents only when actions or tools are needed."],
    docs=[("What is Microsoft Foundry?", FOUNDRY), ("Foundry Agent Service overview", AGENTS), ("Azure Language overview", LANG), ("Azure Speech overview", SPEECH), ("Content Understanding overview", CU)],
)
qa("AI901-1.3.1", 2, "scenario", "Live captions are needed for a company town hall. Which workload?", [("Speech (speech to text)", "Correct."), ("Computer vision", "No."), ("Information extraction", "No."), ("Agentic AI", "No tools needed.")], "a", "Speech recognition.", SPEECH)
qa("AI901-1.3.1", 2, "scenario", "A system must look at warehouse camera images and count pallets. Which workload?", [("Computer vision", "Correct."), ("Text analysis", "No."), ("Speech", "No."), ("Generative AI", "Not creating content.")], "a", "Understanding images.", VISION)

# ================================================================ 1.3.2
lesson(
    id="ai901-text-analysis", exam=E, title="Text analysis techniques",
    objectives=["AI901-1.3.2"], minutes=30,
    objective="Describe keyword (key phrase) extraction, entity detection, sentiment analysis and summarization, and related techniques such as PII detection and language detection.",
    prereqs=[("AI workloads", "AI901-1.3.1", "ai901-ai-workloads")],
    foundation=[
        "Key phrase (keyword) extraction lists the main topics in a text: 'battery life', 'screen'.",
        "Entity detection (named entity recognition, NER) finds and categorises things: people, places, organisations, products, dates, quantities.",
        "Sentiment analysis says whether text is positive, negative, neutral or mixed, with confidence scores. Opinion mining links feelings to specific things: 'battery: positive, screen: negative'.",
        "Summarization shortens text. Extractive summarization picks the most important sentences; abstractive summarization writes new sentences.",
    ],
    engineer=[
        "Azure Language in Foundry Tools provides prebuilt features: key phrase extraction, named entity recognition (categories and subcategories), entity linking (to Wikipedia entries), sentiment analysis with opinion mining (document- and sentence-level scores for positive, neutral, negative; label mixed), PII detection and redaction (text and conversations), language detection, extractive and abstractive summarization (documents and conversations), plus custom features (custom classification, custom NER, conversational language understanding).",
        "Outputs include confidence scores you can threshold. Inputs are sent as documents in batches with IDs and optional language hints.",
        "Alternatively, prompt a generative model to perform the same tasks with structured (JSON) output. Models are flexible (custom definitions, any wording) but less consistent and usually more expensive per item than prebuilt features.",
        "Common pipeline: detect language → redact PII → sentiment and key phrases → store results for dashboards.",
    ],
    anim=("ai901-text-sim", "Run each technique on sample texts and see the kind of output it returns."),
    diagram=([("doc", "Text document", 0, 120, "user"), ("kp", "Key phrases", 260, 0, "ai"), ("ner", "Entities (NER)", 260, 80, "ai"), ("sent", "Sentiment + opinions", 260, 160, "ai"), ("sum", "Summary", 260, 240, "ai"), ("out", "Structured results with confidence", 520, 120, "storage")],
             [("doc", "kp"), ("doc", "ner"), ("doc", "sent"), ("doc", "sum"), ("kp", "out"), ("ner", "out"), ("sent", "out"), ("sum", "out")]),
    example=("Understanding 50,000 reviews", ["A phone maker runs reviews through Azure Language: key phrases show 'battery life' and 'screen' dominate; opinion mining shows battery is positive and screen negative.",
                                              "NER pulls out model names and store locations; abstractive summarization gives product managers a one-paragraph digest per model each week."]),
    config=cfg(["Foundry portal > Language playground: paste text and try sentiment, NER, key phrases, PII and summarization.", "Note the confidence scores and categories in the JSON output."], from_saved="ai901-workloads", perms=("Azure AI User or Cognitive Services User",)),
    lab=lab("Recognise what each technique returns.", ["Run text analysis tab: try each sample with each technique; meet each need.", "Text analysis techniques tab: answer every task."],
            ["Opinion mining links sentiment to features", "PII detection redacts personal data"], [("ai-textrun-correct", "Matched a technique to a need"), ("ai-textrun-wrong", "Saw a mismatched technique")] + chooser_checks("ai-text", "technique"),
            ["Using key phrases to measure feelings", "Expecting extractive summaries to contain new sentences"]),
    troubleshooting=[("Sentiment is 'mixed' for most reviews.", "Reviews praise and criticise different features.", "Use opinion mining for aspect-level sentiment."),
                     ("Entities are missed in short texts.", "Wrong language or too little context.", "Pass the correct language hint; check confidence scores.")],
    comparisons=[("Key phrases vs entities", "Key phrases are main talking points; entities are categorised items (Person, Location)."), ("Extractive vs abstractive summarization", "Extractive selects existing sentences; abstractive writes new ones.")],
    misconceptions=[("Sentiment analysis only returns positive or negative.", "Also neutral and mixed, with scores."), ("NER and PII detection are the same.", "PII detection focuses on personal data and can redact it."), ("Summaries are always shorter extracts.", "Abstractive summaries rewrite.")],
    decisions=["Use prebuilt Azure Language features for consistent, scored results.", "Use a model with JSON output for custom definitions.", "Redact PII before storing text."],
    docs=[("Azure Language overview", LANG), ("Sentiment analysis and opinion mining", ML + "azure/ai-services/language-service/sentiment-opinion-mining/overview"), ("Named entity recognition", ML + "azure/ai-services/language-service/named-entity-recognition/overview"), ("Summarization overview", ML + "azure/ai-services/language-service/summarization/overview")],
)
qa("AI901-1.3.2", 2, "scenario", "You need the main talking points from thousands of survey comments, without sentiment. Which technique?", [("Key phrase extraction", "Correct."), ("Sentiment analysis", "Feelings."), ("Language detection", "Language only."), ("PII redaction", "Personal data.")], "a", "Key phrases list topics.", LANG)

# ================================================================ 1.3.3
lesson(
    id="ai901-speech-capabilities", exam=E, title="Speech recognition and speech synthesis",
    objectives=["AI901-1.3.3"], minutes=30,
    objective="Identify features and capabilities of speech recognition (speech to text) and speech synthesis (text to speech).",
    prereqs=[("AI workloads", "AI901-1.3.1", "ai901-ai-workloads")],
    foundation=[
        "Speech recognition (speech to text) turns spoken audio into written text: captions, transcripts, voice commands.",
        "Speech synthesis (text to speech) turns text into natural-sounding spoken audio: reading answers aloud, audiobooks, phone menus.",
        "Azure Speech in Foundry Tools does both, plus translation of speech and more. Multimodal models can also listen and speak directly.",
    ],
    engineer=[
        "Speech to text modes: real-time (streaming, for captions and voice assistants), fast transcription (quick synchronous file transcription), batch transcription (large volumes of stored audio, asynchronous). Features: automatic punctuation, language identification, speaker diarization (who spoke when), word-level timestamps, profanity filtering, phrase lists, and custom speech models trained with your audio and text for domain vocabulary and accents.",
        "Text to speech: neural and HD voices in many languages and styles; SSML (Speech Synthesis Markup Language) controls pronunciation, pauses, rate, pitch, volume and speaking style; custom voice (with approval) for a brand voice; text-to-speech avatars.",
        "Other speech capabilities: speech translation (speech to text or speech in other languages), pronunciation assessment (accuracy, fluency, prosody for language learning), keyword recognition, and Voice Live for low-latency voice agents.",
        "Responsible use: custom neural voice and some features require an application and approval; disclose synthetic voices.",
    ],
    anim=("ai901-speech-sim", "Pick Azure Speech features for each need, and follow a voice pipeline from microphone to speaker."),
    diagram=([("mic", "Microphone / audio file", 0, 100, "user"), ("stt", "Speech to text (real-time, fast, batch)", 240, 30, "ai"), ("feat", "Diarization, custom speech, translation", 240, 170, "ai"), ("text", "Text", 480, 100, "storage"), ("tts", "Text to speech (neural voice + SSML)", 700, 100, "ai"), ("spk", "Speaker", 920, 100, "user")],
             [("mic", "stt"), ("stt", "feat"), ("stt", "text"), ("text", "tts"), ("tts", "spk")]),
    example=("A pharmacy call line", ["Calls are transcribed in real time with a custom speech model that knows drug names; diarization separates pharmacist and caller; batch transcription processes archived calls overnight.",
                                       "The automated line answers in a neural voice; SSML spells out prescription numbers digit by digit and adds pauses."]),
    config=cfg(["Foundry portal > Speech playground: real-time speech to text, voice gallery, try SSML.", "Custom speech: upload audio + transcripts to train a domain model."], from_saved="ai901-text-speech", perms=("Cognitive Services Speech User or Azure AI User",)),
    lab=lab("Recognise speech features.", ["Speech capabilities tab: answer every need.", "Speech apps tab: run the voice pipeline and each preset."],
            ["Diarization identifies speakers", "SSML controls synthesis"], chooser_checks("speech-feature", "speech feature") + [("ai-speech-ok", "Ran a voice pipeline")],
            ["Using real-time recognition for 10,000 archived files", "Expecting SSML to improve recognition"]),
    troubleshooting=[("Product names are transcribed wrongly.", "General model doesn't know the vocabulary.", "Add a phrase list or train custom speech."),
                     ("Synthesised voice reads '2025' as a number, not a year.", "No SSML guidance.", "Use SSML say-as for dates or numbers.")],
    comparisons=[("Speech to text vs OCR", "Speech to text reads audio; OCR reads text in images."), ("Batch vs real-time transcription", "Batch processes stored files asynchronously; real-time streams live audio.")],
    misconceptions=[("Text to speech sounds robotic.", "Neural and HD voices are natural and expressive."), ("Speaker diarization identifies people by name.", "It separates speakers (Speaker 1, 2); identification needs extra steps."), ("SSML is for recognition.", "SSML controls synthesis.")],
    decisions=["Use batch transcription for archives.", "Add custom speech for specialist vocabulary.", "Use SSML for precise pronunciation."],
    docs=[("Azure Speech overview", SPEECH), ("Speech to text overview", ML + "azure/ai-services/speech-service/speech-to-text"), ("Text to speech overview", ML + "azure/ai-services/speech-service/text-to-speech"), ("SSML overview", ML + "azure/ai-services/speech-service/speech-synthesis-markup")],
)
qa("AI901-1.3.3", 2, "scenario", "A language-learning app must score how accurately students pronounce English sentences. Which feature?", [("Pronunciation assessment", "Correct."), ("Speaker diarization", "Who spoke."), ("Batch transcription", "Bulk files."), ("Custom voice", "Synthesis.")], "a", "Pronunciation assessment scores speech.", SPEECH)

# ================================================================ 1.3.4–1.3.5
lesson(
    id="ai901-vision-extraction", exam=E, title="Computer vision, image generation and information extraction",
    objectives=["AI901-1.3.4", "AI901-1.3.5"], minutes=35,
    objective="Identify features of computer vision and image-generation models, and techniques to extract information from text, images, audio and video.",
    prereqs=[("AI workloads", "AI901-1.3.1", "ai901-ai-workloads")],
    foundation=[
        "Computer vision lets software understand images: describe them, tag them, find objects, and read text in them (OCR).",
        "Image generation models do the opposite: they create new images from a text description, or edit existing ones.",
        "Information extraction pulls specific facts out of content: the total from an invoice, the speaker's main complaint from a call, the scenes in a video. Azure Content Understanding does this for documents, images, audio and video.",
    ],
    engineer=[
        "Vision capabilities: captioning (one sentence for the whole image; dense captions for regions), tagging, object detection (bounding boxes with labels), OCR / Read (printed and handwritten text with positions), people detection, smart cropping. Multimodal models add free-form visual question answering and reasoning about charts, screenshots and photos.",
        "Image generation (for example gpt-image-1): text-to-image, image editing with a reference image or mask, size and quality options; prompts and outputs pass content filters; outputs can include content credentials (C2PA provenance). DALL-E 3 has been retired in Foundry; use gpt-image models.",
        "Extraction techniques by modality: text: NER, key phrases, PII, custom extraction with prompts; documents: OCR + layout (tables, selection marks, structure) + fields; images: descriptions, detected objects and text; audio: transcription with diarization, then fields such as summary or sentiment; video: segmentation into scenes, key frames, transcripts and per-segment descriptions.",
        "Azure Content Understanding: analyzers (prebuilt such as prebuilt-invoice, prebuilt-imageSearch, prebuilt-audioSearch, prebuilt-videoSearch, or custom with a field schema). Field methods: Extract (documents only; value as it appears), Classify (pick from categories), Generate (create a value such as a summary). Results include confidence and grounding (where a value came from).",
        "Azure Document Intelligence remains available for classic form and document extraction with prebuilt and custom models.",
    ],
    anim=("ai901-vision-sim", "Pick vision capabilities and image generation for each need, and choose Extract, Classify or Generate for extracted fields."),
    diagram=([("img", "Image / video frame", 0, 60, "user"), ("vis", "Caption, tags, objects, OCR", 240, 0, "ai"), ("mm", "Multimodal model: ask about it", 240, 110, "ai"), ("gen", "Image generation: text → image", 240, 220, "ai"), ("cu", "Content Understanding: fields from docs, images, audio, video", 520, 110, "ai"), ("fields", "Fields + confidence + grounding", 780, 110, "storage")],
             [("img", "vis"), ("img", "mm"), ("img", "cu"), ("cu", "fields")]),
    example=("An insurer's claims pipeline", ["Customers upload damage photos: a multimodal model describes the damage; OCR reads the licence plate. Content Understanding extracts policy number and date from the claim PDF (Extract), classifies the claim type (Classify) and summarises the recorded phone call (Generate).",
                                               "Marketing uses gpt-image-1 to create illustrations for claim guides, labelled as AI-generated."]),
    config=cfg(["Foundry portal > Vision playgrounds (image analysis, OCR).", "Chat playground with a vision model: attach an image.", "Content Understanding in the Foundry portal: try prebuilt analyzers on sample files."], from_saved="ai901-content-understanding", perms=("Azure AI User or Cognitive Services User",)),
    lab=lab("Choose vision and extraction techniques.", ["Computer vision and image generation tab: answer every need.", "Content Understanding field methods tab: answer every field."],
            ["Object detection gives bounding boxes", "Extract is documents only"], chooser_checks("vision-task", "capability") + chooser_checks("cu-method", "field method"),
            ["Using captioning when positions of objects are needed", "Using Extract on audio"]),
    troubleshooting=[("OCR misses text in a photo.", "Low resolution or skewed image.", "Use higher-resolution, well-lit images."),
                     ("Extract field returns nothing for a video.", "Extract works on documents only.", "Use Generate or Classify for audio and video.")],
    comparisons=[("Captioning vs object detection", "Captions describe the image; detection locates objects with boxes."), ("Content Understanding vs Azure Language", "Content Understanding extracts schema fields across modalities; Language analyses text.")],
    misconceptions=[("OCR is the same as image captioning.", "OCR reads text; captioning describes scenes."), ("Generated images have no safeguards.", "Content filters and provenance credentials apply."), ("Extraction only works on documents.", "Also images, audio and video.")],
    decisions=["Use prebuilt analyzers first, then custom schemas.", "Route low-confidence fields to human review.", "Label AI-generated images."],
    docs=[("Content Understanding overview", CU), ("Content Understanding analyzers", CU_ANALYZERS), ("Vision-enabled chat models", VISION), ("Image generation (gpt-image-1)", IMAGES), ("Azure Vision overview", ML + "azure/ai-services/computer-vision/overview")],
)
qa("AI901-1.3.4", 2, "scenario", "A website needs one-sentence alt text for each product photo. Which capability?", [("Image captioning", "Correct."), ("Object detection", "Boxes."), ("Image generation", "Creates images."), ("OCR", "Reads text.")], "a", "Captioning describes the whole image.", ML + "azure/ai-services/computer-vision/overview")
qa("AI901-1.3.4", 2, "single", "Which statement about image generation in Foundry is correct?", [("Prompts and generated images pass through content filters", "Correct."), ("DALL-E 3 is the current recommended model", "Retired; use gpt-image."), ("It can only edit, not create, images", "It creates and edits."), ("Outputs can't be labelled", "Content credentials can be added.")], "a", "Safety applies to image generation.", IMAGES)
qa("AI901-1.3.5", 2, "scenario", "You need a summary and a sentiment label for each recorded support call. Which Content Understanding field methods apply?", [("Generate for the summary and Classify for the sentiment label", "Correct."), ("Extract for both", "Extract is document-only."), ("Classify for the summary", "Summaries are generated."), ("None: audio isn't supported", "Audio is supported.")], "a", "Generate creates values; Classify picks categories.", CU_ANALYZERS)
qa("AI901-1.3.5", 2, "single", "What does grounding information in a Content Understanding result show?", [("Where in the source content each extracted value came from", "Correct."), ("The model's training data", "No."), ("The deployment region", "No."), ("The price of the call", "No.")], "a", "Grounding supports review and trust.", CU)

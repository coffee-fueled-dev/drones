## Inspiration

While researching challenges to drone commercialization for this hackathon, I realized there is simply too much regulation for one human or even a small organization to practically manage. I also realized that the upcoming revisions to drone policy will cause significant operational changes, funding opportunities, and new product needs for operators

## What it does

Protologic ingests long, content-rich documents (like FAA proposed rules, waivers, and advisory circulars), extracts factual obligations, and maps them into a temporal knowledge graph.

- Users can ask natural questions through an agent interface: “What records must operators keep for BVLOS flights in August 2025?”
- Protologic returns precise obligations with policy references, not guesses.
- It supports time-based queries (as-of reasoning) and policy diffs questions.
- The result: compliance that’s human-approachable for operators, but also defensible for audits and insurers.

## How I built it

- LLM pipeline converts dense text into structured fact statements.
- I used Graphiti to store these facts as episodes in a temporal knowledge graph (Neo4j).
- Set up key domain entities and agent features in a convex backend

## Challenges I ran into

- It tool a lot of tinkering to get clean, unambiguous fact triples from legal text without losing nuance.
- Existing pilot-centric tools (AirData, Aloft, DroneLogbook) are closed, making it tough to integrate operator workflows directly.
- The ingestion and graph fact-mapping pipeline takes a long time to complete -- hours. Any failure modes cost lots of time.

## Accomplishments that I'm proud of

- I built a working ingestion-to-graph pipeline that turns a 200-page policy into queryable obligations.

## What I learned

- Existing drone compliance products are designed around pilots, but new legislation puts more obligation on operators and less on pilots. Operators need compliance solutions and have a lot to lose
- Regulatory tech tools are designed for lawyers and compliance officers, not business people wanting to understand their obligations in real time

## What’s next for Protologic

- Focus on drone operators, especially as Michigan’s Advanced Air Mobility Act and FAA BVLOS normalization take effect.
- Build job management tools for operators, so they can plan their operations and learn what they'll need to do to execute on time, and in compliance
- Add regulation tech features, like the ability to subscribe to policy updates that would impact their business operations
- Generalize beyond drones into other regulatory-heavy industries (energy, finance, healthcare) to gradually become a conversational, agentic “GitHub of evolving regulations.”
- Allow NGOs and advocacy groups to publish human-friendly summaries built on Protologic’s graph.
- (somewhere in the middle of all this) refactor some scrappy code I wrote to build the ingestion in pipeline in 48h. I want durable workflows that can autonomously ingest new regulation.

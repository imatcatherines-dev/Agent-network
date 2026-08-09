export async function GET() {
  return Response.json({
    agent: "Research",
    status: "online",
    service: "web-research"
  });
}

export async function POST(request) {
  try {
    const routerKey = request.headers.get("x-ai-router-key");

    if (
      !process.env.AI_ROUTER_KEY ||
      routerKey !== process.env.AI_ROUTER_KEY
    ) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Research is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const task =
      typeof body.task === "string"
        ? body.task.trim().slice(0, 2000)
        : "";

    if (!task) {
      return Response.json(
        { error: "A research task is required." },
        { status: 400 }
      );
    }

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          model: "gemini-3.6-flash",
          input:
            "Research the following request using current web information. " +
            "Give a concise, useful answer and rely on trustworthy sources.\n\n" +
            task,
          tools: [
            {
              type: "google_search"
            }
          ]
        })
      }
    );

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      return Response.json(
        {
          error: "Research provider failed.",
          details: data
        },
        { status: 502 }
      );
    }

    const steps = Array.isArray(data.steps)
      ? data.steps
      : [];

    let answer = "";
    const searches = [];
    const sources = [];

    for (const step of steps) {
      if (step.type === "google_search_call") {
        const queries = step.arguments?.queries;

        if (Array.isArray(queries)) {
          searches.push(...queries);
        }
      }

      if (
        step.type === "model_output" &&
        Array.isArray(step.content)
      ) {
        for (const block of step.content) {
          if (block.type !== "text") {
            continue;
          }

          if (typeof block.text === "string") {
            answer +=
              (answer ? "\n" : "") +
              block.text;
          }

          if (Array.isArray(block.annotations)) {
            for (const annotation of block.annotations) {
              if (
                annotation.type === "url_citation" &&
                typeof annotation.url === "string"
              ) {
                sources.push({
                  title: annotation.title || annotation.url,
                  url: annotation.url
                });
              }
            }
          }
        }
      }
    }

    const uniqueSources = Array.from(
      new Map(
        sources.map(source => [source.url, source])
      ).values()
    );

    return Response.json({
      agent: "Research",
      task,
      answer:
        answer ||
        "Research completed, but no text answer was returned.",
      searches,
      sources: uniqueSources
    });
  } catch (error) {
    return Response.json(
      {
        error: "Research failed.",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

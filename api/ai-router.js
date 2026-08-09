const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/interactions";

const agentNetworkTool = {
  type: "function",
  name: "search_agent_network",
  description:
    "Use the public Agent Network to find and route tasks to specialized AI agents.",
  parameters: {
    type: "object",
    properties: {
      task: {
        type: "string",
        description:
          "The task or capability needed from another AI agent."
      }
    },
    required: ["task"]
  }
};

function geminiHeaders() {
  return {
    "x-goog-api-key": process.env.GEMINI_API_KEY,
    "Content-Type": "application/json"
  };
}

export async function POST(request) {
  try {
    const routerKey = request.headers.get("x-ai-router-key");

if (!process.env.AI_ROUTER_KEY) {
  return Response.json(
    { error: "AI router authentication is not configured." },
    { status: 500 }
  );
}

if (routerKey !== process.env.AI_ROUTER_KEY) {
  return Response.json(
    { error: "Unauthorized." },
    { status: 401 }
  );
}
    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "Gemini configuration missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : typeof body.task === "string"
          ? body.task.trim()
          : "";

    if (!prompt) {
      return Response.json(
        { error: "A prompt is required." },
        { status: 400 }
      );
    }

    const firstResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        input: prompt,
        tools: [agentNetworkTool]
      })
    });

    const firstInteraction =
      await firstResponse.json();

    if (!firstResponse.ok) {
      return Response.json(
        {
          error: "Gemini request failed.",
          details: firstInteraction
        },
        { status: firstResponse.status }
      );
    }    const functionCall = Array.isArray(firstInteraction.steps)
      ? firstInteraction.steps.find(
          step => step.type === "function_call"
        )
      : null;

    if (!functionCall) {
      return Response.json({
        usedNetwork: false,
        answer:
          firstInteraction.output_text ||
          "Gemini did not use Agent Network.",
        interaction: firstInteraction
      });
    }

    const task =
      typeof functionCall.arguments?.task === "string"
        ? functionCall.arguments.task
        : prompt;

    const a2aResponse = await fetch(
      new URL("/api/a2a", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: crypto.randomUUID(),
          method: "SendMessage",
          params: {
            message: {
              messageId: crypto.randomUUID(),
              role: "ROLE_USER",
              parts: [
                {
                  text: task
                }
              ]
            }
          }
        })
      }
    );

    const networkResult =
      await a2aResponse.json();

    if (!a2aResponse.ok) {
      return Response.json(
        {
          error: "Agent Network request failed.",
          details: networkResult
        },
        { status: a2aResponse.status }
      );
    }    const finalResponse = await fetch(GEMINI_URL, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        model: "gemini-3.6-flash",
        previous_interaction_id: firstInteraction.id,
        tools: [agentNetworkTool],
        input: [
          {
            type: "function_result",
            name: functionCall.name,
            call_id: functionCall.id,
            result: [
              {
                type: "text",
                text: JSON.stringify(networkResult)
              }
            ]
          }
        ]
      })
    });

    const finalInteraction =
      await finalResponse.json();

    if (!finalResponse.ok) {
      return Response.json(
        {
          error: "Gemini final response failed.",
          details: finalInteraction
        },
        { status: finalResponse.status }
      );
    }

    const modelOutput =
      Array.isArray(finalInteraction.steps)
        ? [...finalInteraction.steps]
            .reverse()
            .find(step => step.type === "model_output")
        : null;

    const answer =
      Array.isArray(modelOutput?.content)
        ? modelOutput.content
            .filter(
              part =>
                part.type === "text" &&
                typeof part.text === "string"
            )
            .map(part => part.text)
            .join("\n")
        : "";

    return Response.json({
      usedNetwork: true,
      answer,
      networkResult
    });

  } catch (error) {
    return Response.json(
      {
        error: "AI router failed.",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

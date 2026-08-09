function getHeaders() {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    Accept: "application/json"
  };
}

export async function GET() {
  return Response.json({
    agent: "Genesis",
    status: "online",
    service: "task-routing"
  });
}

export async function POST(request) {
  try {
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SECRET_KEY
    ) {
      return Response.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const task =
      typeof body.task === "string"
        ? body.task.trim()
        : "";

    if (!task) {
      return Response.json(
        { error: "A task is required." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/agents` +
      `?select=id,name,endpoint,capabilities,status` +
      `&status=eq.active&limit=100`,
      {
        headers: getHeaders()
      }
    );

    const agents = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: "Could not read agent network.",
          details: agents
        },
        { status: response.status }
      );
    }
        const words = task
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word => word.length > 2);

    const ranked = agents
      .map(agent => {
        const capabilities = Array.isArray(agent.capabilities)
          ? agent.capabilities
          : [];

        const searchable = [
          agent.name,
          ...capabilities
        ]
          .join(" ")
          .toLowerCase();

        const score = words.reduce(
          (total, word) =>
            total + (searchable.includes(word) ? 1 : 0),
          0
        );

        return {
          ...agent,
          score
        };
      })
      .filter(agent => agent.score > 0)
      .sort((a, b) => b.score - a.score);

    const best = ranked[0] || null;
        let agentResponse = null;

    if (best && best.endpoint && best.name !== "Genesis") {
      const target = new URL(best.endpoint);

      const trusted =
        target.protocol === "https:" &&
        target.hostname === "agent-network-silk.vercel.app";

      if (!trusted) {
        return Response.json(
          {
            error: "Selected agent endpoint is not trusted.",
            selectedAgent: best
          },
          { status: 400 }
        );
      }

const delegated = await fetch(best.endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(target.pathname === "/api/research"
      ? { "x-ai-router-key": process.env.AI_ROUTER_KEY }
      : {})
  },
  body: JSON.stringify({
    task
  })
});      

      agentResponse = await delegated.json();
    }
        return Response.json({
      agent: "Genesis",
      task,
      routed: Boolean(best),
      bestMatch: best,
alternatives: ranked.slice(1, 5),
agentResponse
    });

  } catch (error) {
    return Response.json(
      {
        error: "Genesis routing failed.",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

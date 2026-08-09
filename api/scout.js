function getHeaders() {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    Accept: "application/json"
  };
}

export async function GET() {
  return Response.json({
    agent: "Scout",
    status: "online",
    service: "agent-search"
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const rawQuery =
  typeof body.query === "string"
    ? body.query
    : typeof body.task === "string"
      ? body.task
      : "";

const query = rawQuery.trim().toLowerCase();

    if (!query) {
      return Response.json(
        { error: "A search query is required." },
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
        { error: "Scout could not search the network." },
        { status: response.status }
      );
    }
        const matches = agents.filter(agent => {
      const capabilities = Array.isArray(agent.capabilities)
        ? agent.capabilities
        : [];

      const searchable = [
        agent.name,
        ...capabilities
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    return Response.json({
      agent: "Scout",
      query,
      count: matches.length,
      results: matches
    });

  } catch (error) {
    return Response.json(
      {
        error: "Scout search failed.",
        details: String(error)
      },
      { status: 500 }
          );
  }
}
    
  

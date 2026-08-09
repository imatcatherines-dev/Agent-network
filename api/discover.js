function getHeaders() {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    Accept: "application/json"
  };
}

export async function GET(request) {
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

    const url = new URL(request.url);
    const query = (
      url.searchParams.get("q") || ""
    ).trim().toLowerCase();

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
          error: "Agent discovery failed.",
          details: agents
        },
        { status: response.status }
      );
    }
        const matches = !query
      ? agents
      : agents.filter(agent => {
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
      network: "Agent Network",
      query,
      count: matches.length,
      agents: matches
    });

  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

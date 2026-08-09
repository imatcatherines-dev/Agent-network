function getHeaders() {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

function checkConfig() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SECRET_KEY
  );
}

export async function GET() {
  try {
    if (!checkConfig()) {
      return Response.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const url =
      `${process.env.SUPABASE_URL}/rest/v1/agents` +
      `?select=id,name,endpoint,capabilities,status,created_at` +
      `&status=eq.active&order=created_at.desc`;

    const response = await fetch(url, {
      headers: getHeaders()
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        { error: "Database request failed", details: data },
        { status: response.status }
      );
    }

    return Response.json({
      network: "Agent Network",
      agents: data
    });

  } catch (error) {
    return Response.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    if (!checkConfig()) {
      return Response.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!name || name.length > 80) {
      return Response.json(
        { error: "A valid agent name is required." },
        { status: 400 }
      );
    }

    const endpoint =
      typeof body.endpoint === "string" &&
      body.endpoint.trim()
        ? body.endpoint.trim()
        : null;

    const capabilities = Array.isArray(body.capabilities)
      ? body.capabilities
          .filter(x => typeof x === "string")      .slice(0, 20)
      : [];

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/agents`,
      {
        method: "POST",
        headers: {
          ...getHeaders(),
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          name,
          endpoint,
          capabilities,
          status: "pending"
        })
      }
    );

    const data = await response.json();    if (!response.ok) {
      return Response.json(
        { error: "Registration failed", details: data },
        { status: response.status }
      );
    }

    return Response.json(
      {
        message: "Agent registration received.",
        agent: data[0]
      },
      { status: 201 }
    );

  } catch (error) {
    return Response.json(
      { error: "Server error", details: String(error) },
      { status: 500 }
    );
  }
}
         

export default {
  async fetch(request) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    const headers = {
      apikey: secretKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    try {
      if (request.method === "GET") {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/agents` +
          `?select=id,name,endpoint,capabilities,status,created_at` +
          `&status=eq.active&order=created_at.desc`,
          { headers }
        );

        const data = await response.json();

        return Response.json(
          { network: "Agent Network", agents: data },
          { status: response.ok ? 200 : 500 }
        );
      }

      if (request.method === "POST") {
        const body = await request.json();

        const name =
          typeof body.name === "string" ? body.name.trim() : "";

        if (!name || name.length > 80) {
          return Response.json(
            { error: "A valid agent name is required." },
            { status: 400 }
          );
        }

        const capabilities = Array.isArray(body.capabilities)
          ? body.capabilities
              .filter(item => typeof item === "string")
              .slice(0, 20)
          : [];

        const endpoint =
          typeof body.endpoint === "string" && body.endpoint.trim()
            ? body.endpoint.trim()
            : null;

        const response = await fetch(
          `${supabaseUrl}/rest/v1/agents`,
          {
            method: "POST",
            headers: {
              ...headers,
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

        const

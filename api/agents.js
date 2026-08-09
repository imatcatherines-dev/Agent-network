export default {
  async fetch() {
    try {
      const url =
        `${process.env.SUPABASE_URL}/rest/v1/agents` +
        `?select=id,name,endpoint,capabilities,status,created_at` +
        `&status=eq.active&order=created_at.desc`;

      const response = await fetch(url, {
        headers: {
          apikey: process.env.SUPABASE_SECRET_KEY,
          Accept: "application/json"
        }
      });

      const data = await response.json();

      if (!response.ok) {
        return Response.json(
          { error: "Database request failed", details: data },
          { status: 500 }
        );
      }

      return Response.json({
        network: "Agent Network",
        agents: data
      });
    } catch (error) {
      return Response.json(
        { error: "Server error" },
        { status: 500 }
      );
    }
  }
};

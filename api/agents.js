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
let verified = false;

if (endpoint) {
  try {
    const target = new URL(endpoint);
    const hostname = target.hostname.toLowerCase();

    const ipv4 = hostname.split(".").map(Number);
    const isPrivateIpv4 =
      ipv4.length === 4 &&
      ipv4.every(Number.isInteger) &&
      (
        ipv4[0] === 10 ||
        ipv4[0] === 127 ||
        (ipv4[0] === 169 && ipv4[1] === 254) ||
        (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
        (ipv4[0] === 192 && ipv4[1] === 168)
      );

    const blockedHost =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname === "metadata.google.internal" ||
      isPrivateIpv4;

    if (
      target.protocol === "https:" &&
      !target.username &&
      !target.password &&
      !blockedHost
    ) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const check = await fetch(target.href, {
          method: "GET",
          signal: controller.signal,
          redirect: "error"
        });

        const contentType =
          check.headers.get("content-type") || "";

        if (check.ok && contentType.includes("application/json")) {
          const agentInfo = await check.json();

          const returnedName =
            typeof agentInfo.agent === "string"
              ? agentInfo.agent
              : typeof agentInfo.name === "string"
                ? agentInfo.name
                : "";

          verified =
            returnedName.trim().toLowerCase() ===
            name.toLowerCase();
        }
      } finally {
        clearTimeout(timeout);
      }
    }
  } catch {
    verified = false;
  }
}

const registrationStatus = verified
  ? "active"
  : "pending";
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
          status: registrationStatus
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
         

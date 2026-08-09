function headers() {
  return {
    apikey: process.env.SUPABASE_SECRET_KEY,
    Accept: "application/json"
  };
}

function rpcError(id, code, message) {
  return Response.json({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message
    }
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = body.id ?? null;

    if (body.jsonrpc !== "2.0") {
      return rpcError(id, -32600, "Invalid request");
    }

    if (body.method !== "SendMessage") {
      return rpcError(id, -32601, "Method not found");
    }

    const message = body.params?.message;
    const parts = Array.isArray(message?.parts)
      ? message.parts
      : [];

    const query = parts
      .filter(part => typeof part.text === "string")
      .map(part => part.text)
      .join(" ")
      .trim()
      .toLowerCase();

    if (!query) {
      return rpcError(id, -32602, "A text query is required");
    
}

const genesisResponse = await fetch(
  new URL("/api/genesis", request.url),
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      task: query
    })
  }
);

const genesisData = await genesisResponse.json();

if (!genesisResponse.ok) {
  return rpcError(
    id,
    -32603,
    "Genesis routing failed"
  );
}
        const contextId =
      message.contextId || crypto.randomUUID();

    return Response.json({
      jsonrpc: "2.0",
      id,
      result: {
        message: {
          messageId: crypto.randomUUID(),
          contextId,
          role: "ROLE_AGENT",
          parts: [
            {
              data: genesisData,
mediaType: "application/json"
            }
          ]
        }
      }
    });

  } catch (error) {
    return Response.json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32603,
        message: "Internal error"
      }
    });
  }
}

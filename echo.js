export async function GET() {
  return Response.json({
    agent: "Echo",
    status: "online",
    service: "echo"
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const task =
      typeof body.task === "string"
        ? body.task.trim()
        : "";

    return Response.json({
      agent: "Echo",
      received: task,
      response: task
        ? `Echo received: ${task}`
        : "Echo is online."
    });
  } catch (error) {
    return Response.json(
      {
        error: "Echo failed.",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

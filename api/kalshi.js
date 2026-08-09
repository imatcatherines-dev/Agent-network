export async function GET() {
  return Response.json({
    agent: "Kalshi",
    status: "online",
    service: "prediction-market-data"
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const task =
      typeof body.task === "string"
        ? body.task.trim().slice(0, 1000)
        : "";

    if (!task) {
      return Response.json(
        { error: "A task is required." },
        { status: 400 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response;

    try {
      response = await fetch(
        "https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=1000",
        {
          method: "GET",
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: "Kalshi market data request failed.",
          details: data
        },
        { status: 502 }
      );
    }

    const ignoredWords = new Set([
      "find",
      "show",
      "what",
      "which",
      "where",
      "when",
      "market",
      "markets",
      "kalshi",
      "prediction",
      "predictions",
      "about",
      "with",
      "from",
      "that",
      "this",
      "have",
      "will",
      "would",
      "could",
      "for",
      "the",
      "and",
      "are"
    ]);

    const words = task
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(
        word =>
          word.length > 2 &&
          !ignoredWords.has(word)
      );

    const markets = Array.isArray(data.markets)
      ? data.markets
      : [];

    const ranked = markets
      .map(market => {
        const searchable = [
          market.ticker,
          market.event_ticker,
          market.title,
          market.subtitle,
          market.yes_sub_title,
          market.no_sub_title
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const score = words.reduce(
          (total, word) =>
            total +
            (searchable.includes(word) ? 1 : 0),
          0
        );

        return {
          ticker: market.ticker,
          eventTicker: market.event_ticker,
          title: market.title,
          subtitle: market.subtitle,
          yesSubtitle: market.yes_sub_title,
          noSubtitle: market.no_sub_title,
          yesBid: market.yes_bid_dollars,
          yesAsk: market.yes_ask_dollars,
          noBid: market.no_bid_dollars,
          noAsk: market.no_ask_dollars,
          lastPrice: market.last_price_dollars,
          volume: market.volume_fp,
          openInterest: market.open_interest_fp,
          closeTime: market.close_time,
          score
        };
      })
      .filter(market => market.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return Response.json({
      agent: "Kalshi",
      task,
      count: ranked.length,
      markets: ranked
    });
  } catch (error) {
    return Response.json(
      {
        error: "Kalshi agent failed.",
        details: String(error)
      },
      { status: 500 }
    );
  }
}

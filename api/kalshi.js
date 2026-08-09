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

    const ignoredWords = new Set([
      "find", "show", "what", "which", "where", "when",
      "market", "markets", "kalshi", "prediction", "predictions",
      "about", "with", "from", "that", "this", "have", "will",
      "would", "could", "for", "the", "and", "are", "current"
    ]);

    const lowerTask = task.toLowerCase();

    const words = lowerTask
      .split(/[^a-z0-9]+/)
      .filter(word =>
        word.length > 2 &&
        !ignoredWords.has(word)
      );

    const searchTerms = new Set(words);

    if (lowerTask.includes("basketball")) {
      ["basketball", "nba", "wnba", "ncaab", "ncaa"].forEach(
        term => searchTerms.add(term)
      );
    }

    if (lowerTask.includes("football")) {
      ["football", "nfl", "ncaaf", "ncaa"].forEach(
        term => searchTerms.add(term)
      );
    }

    if (lowerTask.includes("baseball")) {
      ["baseball", "mlb"].forEach(
        term => searchTerms.add(term)
      );
    }

    if (lowerTask.includes("hockey")) {
      ["hockey", "nhl"].forEach(
        term => searchTerms.add(term)
      );
    }

    const sportsTerms = [
      "sports", "sport",
      "basketball", "nba", "wnba", "ncaab",
      "football", "nfl", "ncaaf",
      "baseball", "mlb",
      "hockey", "nhl",
      "soccer", "tennis", "golf"
    ];

    const isSportsTask = sportsTerms.some(term =>
      lowerTask.includes(term)
    );

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      10000
    );

    let markets = [];

    try {
      if (isSportsTask) {
        const seriesResponse = await fetch(
          "https://external-api.kalshi.com/trade-api/v2/series?category=Sports&include_volume=true",
          {
            signal: controller.signal
          }
        );

        const seriesData =
          await seriesResponse.json();

        if (!seriesResponse.ok) {
          return Response.json(
            {
              error: "Kalshi sports discovery failed.",
              details: seriesData
            },
            { status: 502 }
          );
        }

        const series =
          Array.isArray(seriesData.series)
            ? seriesData.series
            : [];

        const topSeries = series
          .map(item => {
            const searchable = [
              item.ticker,
              item.title,
              ...(Array.isArray(item.tags)
                ? item.tags
                : [])
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            const score =
              [...searchTerms].reduce(
                (total, term) =>
                  total +
                  (searchable.includes(term)
                    ? 1
                    : 0),
                0
              );

            return {
              ...item,
              score
            };
          })
          .filter(item => item.score > 0)
          .sort(
            (a, b) =>
              b.score - a.score
          )
          .slice(0, 6);

        const marketResponses =
          await Promise.all(
            topSeries.map(item =>
              fetch(
                "https://external-api.kalshi.com/trade-api/v2/markets" +
                  `?status=open&series_ticker=${encodeURIComponent(item.ticker)}` +
                  "&limit=1000",
                {
                  signal: controller.signal
                }
              )
            )
          );

        for (
          let i = 0;
          i < marketResponses.length;
          i++
        ) {
          const marketResponse =
            marketResponses[i];

          const marketData =
            await marketResponse.json();

          if (
            !marketResponse.ok ||
            !Array.isArray(marketData.markets)
          ) {
            continue;
          }

          const seriesInfo = topSeries[i];

          markets.push(
            ...marketData.markets.map(
              market => ({
                ...market,
                _seriesTitle:
                  seriesInfo.title,
                _seriesTags:
                  seriesInfo.tags
              })
            )
          );
        }
      } else {
        const response = await fetch(
          "https://external-api.kalshi.com/trade-api/v2/markets?status=open&limit=1000",
          {
            signal: controller.signal
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          return Response.json(
            {
              error:
                "Kalshi market data request failed.",
              details: data
            },
            { status: 502 }
          );
        }

        markets =
          Array.isArray(data.markets)
            ? data.markets
            : [];
      }
    } finally {
      clearTimeout(timeout);
    }

    const ranked = markets
      .map(market => {
        const searchable = [
          market.ticker,
          market.event_ticker,
          market.title,
          market.subtitle,
          market.yes_sub_title,
          market.no_sub_title,
          market._seriesTitle,
          ...(Array.isArray(
            market._seriesTags
          )
            ? market._seriesTags
            : [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const score =
          [...searchTerms].reduce(
            (total, term) =>
              total +
              (searchable.includes(term)
                ? 1
                : 0),
            0
          );

        return {
          ticker: market.ticker,
          eventTicker:
            market.event_ticker,
          title: market.title,
          subtitle: market.subtitle,
          yesSubtitle:
            market.yes_sub_title,
          noSubtitle:
            market.no_sub_title,
          yesBid:
            market.yes_bid_dollars,
          yesAsk:
            market.yes_ask_dollars,
          noBid:
            market.no_bid_dollars,
          noAsk:
            market.no_ask_dollars,
          lastPrice:
            market.last_price_dollars,
          volume: market.volume_fp,
          openInterest:
            market.open_interest_fp,
          closeTime:
            market.close_time,
          score
        };
      })
      .filter(
        market => market.score > 0
      )
      .sort(
        (a, b) => b.score - a.score
      )
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

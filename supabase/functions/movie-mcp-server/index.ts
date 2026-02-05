import "@supabase/functions-js/edge-runtime.d.ts";
import { McpServer } from "npm:@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import * as z from "npm:zod/v4";

const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";
const WIDGET_URI = "ui://widget/search_movies_widget.html";
const SKYBRIDGE_MIME = "text/html+skybridge";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version, last-event-id",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
};

const widgetHtml = String.raw`<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Movie Results</title>
    <style>
      body { font-family: ui-sans-serif, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 12px; background: #fafafa; color: #111; }
      .wrap { display: grid; gap: 10px; }
      .title { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
      .subtitle { margin: 0 0 10px 0; color: #555; font-size: 13px; }
      .error { border: 1px solid #f3b3b3; background: #fff2f2; color: #9c1d1d; border-radius: 10px; padding: 10px; font-size: 13px; }
      .card { display: grid; grid-template-columns: 70px 1fr; gap: 10px; border: 1px solid #e5e7eb; border-radius: 12px; background: white; padding: 10px; }
      .poster { width: 70px; height: 105px; object-fit: cover; border-radius: 8px; background: #e5e7eb; }
      .poster-empty { display: grid; place-items: center; color: #555; font-size: 11px; }
      .movie-title { margin: 0 0 4px 0; font-size: 16px; font-weight: 600; }
      .meta { margin: 0; color: #444; font-size: 13px; line-height: 1.4; }
      .empty { color: #666; font-size: 13px; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      const output = window.openai?.toolOutput || {};
      const movies = Array.isArray(output.movies) ? output.movies : [];
      const app = document.getElementById("app");

      const esc = (v) => String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");

      const cards = movies.map((m) => {
        const poster = m.posterUrl
          ? '<img class="poster" src="' + esc(m.posterUrl) + '" alt="Poster for ' + esc(m.title) + '" />'
          : '<div class="poster poster-empty">No Image</div>';
        return '<article class="card">' +
          poster +
          '<div>' +
            '<h3 class="movie-title">' + esc(m.title) + '</h3>' +
            '<p class="meta">Release Year: ' + esc(m.releaseYear) + '</p>' +
            '<p class="meta">Rating: ' + Number(m.rating || 0).toFixed(1) + '</p>' +
          '</div>' +
        '</article>';
      }).join("");

      app.innerHTML =
        '<div class="wrap">' +
          '<h2 class="title">Movie Results</h2>' +
          '<p class="subtitle">Query: ' + esc(output.query || "N/A") + '</p>' +
          (output.error ? '<div class="error">' + esc(output.error) + '</div>' : '') +
          (!output.error && movies.length === 0 ? '<p class="empty">No results to display.</p>' : '') +
          cards +
        '</div>';
    </script>
  </body>
</html>`;

const searchMoviesInputSchema = {
  query: z.string().describe("The movie title to search for"),
};

const tmdbSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      release_date: z.string().nullable().optional(),
      vote_average: z.number().nullable().optional(),
      poster_path: z.string().nullable().optional(),
    }),
  ),
});

const formatReleaseYear = (releaseDate?: string | null): string => {
  if (!releaseDate) return "N/A";
  const [year] = releaseDate.split("-");
  return year || "N/A";
};

const buildPosterUrl = (posterPath?: string | null): string | null => {
  if (!posterPath) return null;
  return `${TMDB_POSTER_BASE_URL}${posterPath}`;
};

const getServer = () => {
  const server = new McpServer({
    name: "movie-mcp-server",
    version: "1.0.0",
  });

  server.registerResource(
    "search_movies_widget",
    WIDGET_URI,
    {
      title: "Movie Search Results",
      description:
        "Displays TMDB movie search results with posters, release year, and rating.",
      mimeType: SKYBRIDGE_MIME,
      _meta: {
        "openai/widgetDescription":
          "A list of movie cards with title, release year, rating, and poster image.",
        "openai/widgetPrefersBorder": true,
        "openai/widgetCSP": {
          connect_domains: [],
          resource_domains: ["https://image.tmdb.org"],
        },
      },
    },
    async () => {
      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: SKYBRIDGE_MIME,
            text: widgetHtml,
          },
        ],
      };
    },
  );

  server.registerTool(
    "search_movies",
    {
      title: "Search Movies",
      description:
        "Search TMDB for movies by title and display the top results in a visual widget.",
      inputSchema: searchMoviesInputSchema,
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking": "Searching movies...",
        "openai/toolInvocation/invoked": "Movie results ready",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    async ({ query }) => {
      const apiKey = Deno.env.get("TMDB_API_KEY");
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "Movie search failed because TMDB_API_KEY is not configured.",
            },
          ],
          structuredContent: {
            query,
            movies: [],
            error: "TMDB API key is missing. Set TMDB_API_KEY and try again.",
          },
        };
      }

      try {
        const url = new URL(TMDB_SEARCH_URL);
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("query", query);
        url.searchParams.set("page", "1");
        url.searchParams.set("include_adult", "false");

        const response = await fetch(url);
        if (!response.ok) {
          return {
            content: [
              {
                type: "text",
                text: "Movie search failed due to an external API error.",
              },
            ],
            structuredContent: {
              query,
              movies: [],
              error: `TMDB request failed with status ${response.status}.`,
            },
          };
        }

        const parsed = tmdbSearchResponseSchema.parse(await response.json());
        const movies = parsed.results.slice(0, 3).map((movie) => ({
          id: movie.id,
          title: movie.title,
          releaseYear: formatReleaseYear(movie.release_date),
          rating: Number((movie.vote_average ?? 0).toFixed(1)),
          posterUrl: buildPosterUrl(movie.poster_path),
        }));

        if (movies.length === 0) {
          return {
            content: [{ type: "text", text: `No movies found for "${query}".` }],
            structuredContent: {
              query,
              movies: [],
              error: "No movies found for this query.",
            },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Found ${movies.length} movie result(s) for "${query}".`,
            },
          ],
          structuredContent: {
            query,
            movies,
          },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown network error";
        return {
          content: [
            {
              type: "text",
              text: "Movie search failed due to a network or parsing error.",
            },
          ],
          structuredContent: {
            query,
            movies: [],
            error: `Unable to fetch movie results right now: ${message}`,
          },
        };
      }
    },
  );

  return server;
};

const rewriteSupabasePath = (pathname: string): string => {
  const functionsMatch = pathname.match(/^\/functions\/v1\/[^/]+(\/.*)?$/);
  if (functionsMatch) return functionsMatch[1] || "/";

  const functionNameMatch = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (functionNameMatch?.[2]) return functionNameMatch[2] || "/";

  return pathname;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = rewriteSupabasePath(url.pathname);

  if (path !== "/mcp") {
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = getServer();
  await server.connect(transport);

  const response = await transport.handleRequest(req);
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});

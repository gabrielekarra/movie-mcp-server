import { MCPServer, object, text, widget } from "mcp-use/server";
import { z } from "zod";
import {
  searchMoviesInputSchema,
  searchMoviesWidgetPropsSchema,
  type MovieCard,
  type SearchMoviesInput,
} from "./src/features/search-movies/types.js";

const server = new MCPServer({
  name: "movie-mcp-server",
  title: "movie-mcp-server", // display name
  version: "1.0.0",
  description: "MCP server with OpenAI Apps SDK integration",
  baseUrl: process.env.MCP_URL || "http://localhost:3000", // Full base URL (e.g., https://myserver.com)
  favicon: "favicon.ico",
  websiteUrl: "https://mcp-use.com", // Can be customized later
  icons: [
    {
      src: "icon.svg",
      mimeType: "image/svg+xml",
      sizes: ["512x512"],
    },
  ],
});

/**
 * AUTOMATIC UI WIDGET REGISTRATION
 * All React components in the `resources/` folder are automatically registered as MCP tools and resources.
 * Just export widgetMetadata with description and Zod schema, and mcp-use handles the rest!
 *
 * It will automatically add to your MCP server:
 * - server.tool('get-brand-info')
 * - server.resource('ui://widget/get-brand-info')
 *
 * See docs: https://mcp-use.com/docs/typescript/server/ui-widgets
 */

/**
 * Add here your standard MCP tools, resources and prompts
 */

// Fruits data for the API
const fruits = [
  { fruit: "mango", color: "bg-[#FBF1E1] dark:bg-[#FBF1E1]/10" },
  { fruit: "pineapple", color: "bg-[#f8f0d9] dark:bg-[#f8f0d9]/10" },
  { fruit: "cherries", color: "bg-[#E2EDDC] dark:bg-[#E2EDDC]/10" },
  { fruit: "coconut", color: "bg-[#fbedd3] dark:bg-[#fbedd3]/10" },
  { fruit: "apricot", color: "bg-[#fee6ca] dark:bg-[#fee6ca]/10" },
  { fruit: "blueberry", color: "bg-[#e0e6e6] dark:bg-[#e0e6e6]/10" },
  { fruit: "grapes", color: "bg-[#f4ebe2] dark:bg-[#f4ebe2]/10" },
  { fruit: "watermelon", color: "bg-[#e6eddb] dark:bg-[#e6eddb]/10" },
  { fruit: "orange", color: "bg-[#fdebdf] dark:bg-[#fdebdf]/10" },
  { fruit: "avocado", color: "bg-[#ecefda] dark:bg-[#ecefda]/10" },
  { fruit: "apple", color: "bg-[#F9E7E4] dark:bg-[#F9E7E4]/10" },
  { fruit: "pear", color: "bg-[#f1f1cf] dark:bg-[#f1f1cf]/10" },
  { fruit: "plum", color: "bg-[#ece5ec] dark:bg-[#ece5ec]/10" },
  { fruit: "banana", color: "bg-[#fdf0dd] dark:bg-[#fdf0dd]/10" },
  { fruit: "strawberry", color: "bg-[#f7e6df] dark:bg-[#f7e6df]/10" },
  { fruit: "lemon", color: "bg-[#feeecd] dark:bg-[#feeecd]/10" },
];

// API endpoint for fruits data
server.get("/api/fruits", (c) => {
  return c.json(fruits);
});

// Brand Info Tool - Returns brand information
server.tool(
  {
    name: "get-brand-info",
    description:
      "Get information about the brand, including company details, mission, and values",
  },
  async () => {
    return object({
      name: "mcp-use",
      tagline: "Build MCP servers with UI widgets in minutes",
      description:
        "mcp-use is a modern framework for building Model Context Protocol (MCP) servers with automatic UI widget registration, making it easy to create interactive AI tools and resources.",
      founded: "2025",
      mission:
        "To simplify the development of MCP servers and make AI integration accessible for developers",
      values: [
        "Developer Experience",
        "Simplicity",
        "Performance",
        "Open Source",
        "Innovation",
      ],
      contact: {
        website: "https://mcp-use.com",
        docs: "https://mcp-use.com/docs",
        github: "https://github.com/mcp-use/mcp-use",
      },
      features: [
        "Automatic UI widget registration",
        "React component support",
        "Full TypeScript support",
        "Built-in HTTP server",
        "MCP protocol compliance",
      ],
    });
  }
);

const TMDB_SEARCH_URL = "https://api.themoviedb.org/3/search/movie";
const TMDB_POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500";

const tmdbSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      title: z.string(),
      release_date: z.string().nullable().optional(),
      vote_average: z.number().nullable().optional(),
      poster_path: z.string().nullable().optional(),
    })
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

const mapTmdbMovieToCard = (
  movie: z.infer<typeof tmdbSearchResponseSchema>["results"][number]
): MovieCard => ({
  id: movie.id,
  title: movie.title,
  releaseYear: formatReleaseYear(movie.release_date),
  rating: Number((movie.vote_average ?? 0).toFixed(1)),
  posterUrl: buildPosterUrl(movie.poster_path),
});

const buildSearchMoviesWidgetResponse = (
  props: z.infer<typeof searchMoviesWidgetPropsSchema>,
  modelMessage: string
) =>
  widget({
    props,
    output: text(modelMessage),
  });

const searchMoviesHandler = async ({ query }: SearchMoviesInput) => {
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return buildSearchMoviesWidgetResponse(
      {
        query,
        movies: [],
        error: "TMDB API key is missing. Set TMDB_API_KEY and try again.",
      },
      "Movie search failed because the TMDB API key is not configured."
    );
  }

  try {
    const url = new URL(TMDB_SEARCH_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("query", query);
    url.searchParams.set("page", "1");
    url.searchParams.set("include_adult", "false");

    const response = await fetch(url.toString());
    if (!response.ok) {
      let details = "";
      try {
        const body = await response.json();
        if (body?.status_message && typeof body.status_message === "string") {
          details = ` ${body.status_message}`;
        }
      } catch {
        // Ignore JSON parsing failures and use status code fallback.
      }

      return buildSearchMoviesWidgetResponse(
        {
          query,
          movies: [],
          error: `TMDB request failed with status ${response.status}.${details}`.trim(),
        },
        "Movie search failed due to an external API error."
      );
    }

    const payload = tmdbSearchResponseSchema.parse(await response.json());
    const movies = payload.results.slice(0, 3).map(mapTmdbMovieToCard);

    if (movies.length === 0) {
      return buildSearchMoviesWidgetResponse(
        {
          query,
          movies: [],
          error: "No movies found for this query.",
        },
        `No movies found for "${query}".`
      );
    }

    return buildSearchMoviesWidgetResponse(
      {
        query,
        movies,
      },
      `Found ${movies.length} movie result(s) for "${query}".`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";

    return buildSearchMoviesWidgetResponse(
      {
        query,
        movies: [],
        error: `Unable to fetch movie results right now: ${message}`,
      },
      "Movie search failed due to a network or parsing error."
    );
  }
};

server.tool(
  {
    name: "search_movies",
    description:
      "Search TMDB for movies by title and display the top results in a visual widget.",
    schema: searchMoviesInputSchema,
    widget: {
      name: "search_movies_widget",
      invoking: "Searching movies...",
      invoked: "Movie results ready",
    },
  },
  searchMoviesHandler
);

server.listen().then(() => {
  console.log(`Server running`);
});

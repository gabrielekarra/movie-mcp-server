import React from "react";
import { useWidget, type WidgetMetadata } from "mcp-use/react";
import "../styles.css";
import {
  searchMoviesWidgetPropsSchema,
  type SearchMoviesWidgetProps,
} from "../../src/features/search-movies/types";

export const widgetMetadata: WidgetMetadata = {
  title: "Movie Search Results",
  description:
    "Displays TMDB movie search results with posters, release year, and rating.",
  props: searchMoviesWidgetPropsSchema,
  exposeAsTool: false,
  metadata: {
    csp: {
      resourceDomains: ["https://image.tmdb.org"],
    },
    prefersBorder: true,
    widgetDescription:
      "A list of movie cards showing title, release year, vote average, and poster image.",
  },
};

const SearchMoviesWidget: React.FC = () => {
  const { props, isPending } = useWidget<SearchMoviesWidgetProps>();
  const movies = props.movies ?? [];

  if (isPending) {
    return (
      <div className="bg-surface-elevated border border-default rounded-2xl p-6">
        <p className="text-sm">Loading movie results...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-elevated border border-default rounded-2xl p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Movie Results</h2>
        <p className="text-sm">Query: {props.query || "N/A"}</p>
      </div>

      {props.error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {props.error}
        </div>
      ) : null}

      {!props.error && movies.length === 0 ? (
        <p className="text-sm">No results to display.</p>
      ) : null}

      <div className="space-y-3">
        {movies.map((movie) => (
          <article
            key={movie.id}
            className="flex gap-3 rounded-xl border border-default bg-surface p-3"
          >
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={`Poster for ${movie.title}`}
                className="h-24 w-16 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-24 w-16 shrink-0 rounded-md bg-surface-tertiary text-xs text-secondary flex items-center justify-center">
                No Image
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-base font-semibold leading-tight">
                {movie.title}
              </h3>
              <p className="text-sm mt-1">Release Year: {movie.releaseYear}</p>
              <p className="text-sm">Rating: {movie.rating.toFixed(1)}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default SearchMoviesWidget;

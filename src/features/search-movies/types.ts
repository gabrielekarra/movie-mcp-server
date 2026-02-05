import { z } from "zod";

export const searchMoviesInputSchema = z.object({
  query: z.string().min(1).describe("The movie title to search for"),
});

export type SearchMoviesInput = z.infer<typeof searchMoviesInputSchema>;

export const movieCardSchema = z.object({
  id: z.number(),
  title: z.string(),
  releaseYear: z.string(),
  rating: z.number(),
  posterUrl: z.string().nullable(),
});

export type MovieCard = z.infer<typeof movieCardSchema>;

export const searchMoviesWidgetPropsSchema = z.object({
  query: z.string().describe("The movie title that was searched"),
  movies: z.array(movieCardSchema).describe("Top movie search results from TMDB"),
  error: z.string().optional().describe("Error message if movie search fails"),
});

export type SearchMoviesWidgetProps = z.infer<
  typeof searchMoviesWidgetPropsSchema
>;

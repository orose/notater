import { createContext } from 'react';

export type OpenSearch = (query?: string) => void;

export const SearchContext = createContext<OpenSearch | null>(null);

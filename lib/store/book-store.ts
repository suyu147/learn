import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Book {
  id: string;
  title: string;
  pageCount: number;
  status: 'compiled' | 'compiling' | 'planning';
  coverGradient: string;
  createdAt: string;
}

interface BookState {
  books: Book[];
  addBook: (b: Book) => void;
  removeBook: (id: string) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set) => ({
      books: [],

      addBook: (b) =>
        set((state) => ({
          books: [...state.books, b],
        })),

      removeBook: (id) =>
        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
        })),

      updateBook: (id, updates) =>
        set((state) => ({
          books: state.books.map((b) =>
            b.id === id ? { ...b, ...updates } : b
          ),
        })),
    }),
    { name: 'sl-book-storage' }
  )
);

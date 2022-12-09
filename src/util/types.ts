export interface Schema {
  [key: string]:
    | "string"
    | "string?"
    | "boolean"
    | "boolean?"
    | "number"
    | "number?"
    | Schema;
}

export interface Document {
  [key: string]: PossibleTypes | Document;
}

export type PossibleTypes = string | boolean | number | null;

export interface Meta {
  key_index: Record<string, string[]>;
  table_index: Record<string, {
    schema: Schema | null;
    chunks: string[];
  }>;
}

export type Chunk = Record<string, Document>;

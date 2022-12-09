import {
  readChunk,
  readMeta,
  writeChunk,
  writeMeta,
} from "../util/fileOperations.ts";
import { Document, Meta } from "../util/types.ts";
import { validateSchema } from "../util/validateSchema.ts";

interface InsertOpts {
  maxDocumentsPerChunk: number;
}

function getValidChunk(
  directory: string,
  tenant: string,
  table: string,
  meta: Meta,
  maxDocumentsPerChunk: number,
) {
  // Check if there are any valid chunks just chilling
  for (const chunkName of meta.table_index[table].chunks) {
    const chunk = readChunk(directory, tenant, chunkName);
    if (Object.keys(chunk).length < maxDocumentsPerChunk) {
      return chunkName;
    }
  }

  // If there is not, make a new chunk
  const chunkName = crypto.randomUUID();
  meta.table_index[table].chunks.push(chunkName);
  writeChunk(directory, tenant, chunkName, {});
  return chunkName;
}

export function insert(
  directory: string,
  tenant: string,
  table: string,
  document: Document,
  opts: InsertOpts,
) {
  const meta = readMeta(directory, tenant);

  if (!Object.hasOwn(meta.table_index, table)) {
    throw `No table with name "${table}" to insert into`;
  }
  const schema = meta.table_index[table].schema;

  if (schema) {
    validateSchema(meta, document, schema);
  }

  const key = crypto.randomUUID();
  const chunkName = getValidChunk(
    directory,
    tenant,
    table,
    meta,
    opts.maxDocumentsPerChunk,
  );

  meta.key_index[key] = [table, chunkName];

  writeMeta(directory, tenant, meta);

  const chunk = readChunk(directory, tenant, chunkName);
  chunk[key] = document;
  writeChunk(directory, tenant, chunkName, chunk);

  return key;
}

export function bulkInsert(
  directory: string,
  tenant: string,
  table: string,
  documents: Document[],
  opts: InsertOpts,
) {
  const meta = readMeta(directory, tenant);

  if (!Object.hasOwn(meta.table_index, table)) {
    throw `No table with name "${table}" to insert into`;
  }
  const schema = meta.table_index[table].schema;
  const keys = [];

  let chunkName = getValidChunk(
    directory,
    tenant,
    table,
    meta,
    opts.maxDocumentsPerChunk,
  );
  let chunk = readChunk(directory, tenant, chunkName);

  for (const document of documents) {
    if (schema) {
      validateSchema(meta, document, schema);
    }

    const key = crypto.randomUUID();

    meta.key_index[key] = [table, chunkName];
    chunk[key] = document;

    // if chunk is full, get a new valid chunk to start writing into
    if (Object.keys(chunk).length >= opts.maxDocumentsPerChunk) {
      writeChunk(directory, tenant, chunkName, chunk);
      chunkName = getValidChunk(
        directory,
        tenant,
        table,
        meta,
        opts.maxDocumentsPerChunk,
      );
      chunk = readChunk(directory, tenant, chunkName);
    }

    keys.push(key);
  }

  writeChunk(directory, tenant, chunkName, chunk);
  writeMeta(directory, tenant, meta);

  return keys;
}

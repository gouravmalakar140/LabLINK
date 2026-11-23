import fs from 'fs/promises';
import path from 'path';
import type { LabLinkStoreData } from '../src/types/lablink.ts';
import { createSeedData, formatLocalIsoDate } from './seed.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILENAME = 'lablink-store.json';

function resolveSafeStorePath(): string {
  const resolved = path.resolve(DATA_DIR, STORE_FILENAME);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Invalid store path resolution');
  }
  return resolved;
}

let writeQueue: Promise<void> = Promise.resolve();
let memoryCache: LabLinkStoreData | null = null;

async function writeStoreAtomic(data: LabLinkStoreData): Promise<void> {
  memoryCache = data;
  try {
    const targetPath = resolveSafeStorePath();
    const tempPath = `${targetPath}.tmp`;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tempPath, targetPath);
  } catch {
    // Graceful fallback to in-memory cache on read-only container filesystems
  }
}

export async function readStore(): Promise<LabLinkStoreData> {
  if (memoryCache) {
    return memoryCache;
  }

  const targetPath = resolveSafeStorePath();
  try {
    const raw = await fs.readFile(targetPath, 'utf-8');
    const parsed = JSON.parse(raw) as LabLinkStoreData;
    if (!Array.isArray(parsed.stations) || !Array.isArray(parsed.requests)) {
      throw new Error('Corrupt store shape');
    }
    memoryCache = parsed;
    return parsed;
  } catch {
    const seeded = createSeedData(formatLocalIsoDate());
    await mutateStore(async () => seeded);
    return memoryCache ?? seeded;
  }
}

export async function mutateStore<T>(
  updater: (current: LabLinkStoreData) => Promise<T> | T
): Promise<{ store: LabLinkStoreData; result: T }> {
  let result!: T;
  let nextStore!: LabLinkStoreData;

  const task = writeQueue.then(async () => {
    let current = memoryCache;
    if (!current) {
      const targetPath = resolveSafeStorePath();
      try {
        const raw = await fs.readFile(targetPath, 'utf-8');
        const parsed = JSON.parse(raw) as LabLinkStoreData;
        if (Array.isArray(parsed.stations) && Array.isArray(parsed.requests)) {
          current = parsed;
        }
      } catch {
        current = null;
      }
    }

    if (!current) {
      current = createSeedData(formatLocalIsoDate());
    }

    const maybeNew = await updater(current);
    if (
      maybeNew &&
      typeof maybeNew === 'object' &&
      'stations' in maybeNew &&
      'requests' in maybeNew &&
      Array.isArray((maybeNew as unknown as LabLinkStoreData).stations)
    ) {
      nextStore = maybeNew as unknown as LabLinkStoreData;
    } else {
      nextStore = current;
    }
    result = maybeNew;
    await writeStoreAtomic(nextStore);
  });

  writeQueue = task.catch(() => {});
  await task;
  return { store: nextStore, result };
}

export async function resetStore(): Promise<LabLinkStoreData> {
  const seeded = createSeedData(formatLocalIsoDate());
  await mutateStore(() => seeded);
  return memoryCache ?? seeded;
}

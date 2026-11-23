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

async function writeStoreAtomic(data: LabLinkStoreData): Promise<void> {
  const targetPath = resolveSafeStorePath();
  const tempPath = `${targetPath}.tmp`;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempPath, targetPath);
}

export async function readStore(): Promise<LabLinkStoreData> {
  const targetPath = resolveSafeStorePath();
  try {
    const raw = await fs.readFile(targetPath, 'utf-8');
    const parsed = JSON.parse(raw) as LabLinkStoreData;
    if (!Array.isArray(parsed.stations) || !Array.isArray(parsed.requests)) {
      throw new Error('Corrupt store shape');
    }
    return parsed;
  } catch {
    const seeded = createSeedData(formatLocalIsoDate());
    await mutateStore(async () => seeded);
    return seeded;
  }
}

export async function mutateStore<T>(
  updater: (current: LabLinkStoreData) => Promise<T> | T
): Promise<{ store: LabLinkStoreData; result: T }> {
  let result!: T;
  let nextStore!: LabLinkStoreData;

  const task = writeQueue.then(async () => {
    const targetPath = resolveSafeStorePath();
    let current: LabLinkStoreData;
    try {
      const raw = await fs.readFile(targetPath, 'utf-8');
      current = JSON.parse(raw) as LabLinkStoreData;
      if (!Array.isArray(current.stations) || !Array.isArray(current.requests)) {
        current = createSeedData(formatLocalIsoDate());
      }
    } catch {
      current = createSeedData(formatLocalIsoDate());
    }

    const maybeNew = await updater(current);
    // If updater returned a full store object when initializing, handle cleanly
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
  return seeded;
}
